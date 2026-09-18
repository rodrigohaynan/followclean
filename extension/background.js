const PROCESS_LIMIT = 50;
const NAVIGATION_TIMEOUT_MS = 18000;
const BETWEEN_PROFILES_MS = 10000;

let timer = null;
let timeoutTimer = null;

function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase().replace(/^@/, "");
}

async function getState() {
  const stored = await chrome.storage.local.get([
    "followcleanQueue",
    "followcleanResults",
    "followcleanBatch",
    "followcleanFailures"
  ]);

  return {
    queue: Array.isArray(stored.followcleanQueue) ? stored.followcleanQueue.map(normalizeUsername).filter(Boolean) : [],
    results: stored.followcleanResults || {},
    failures: stored.followcleanFailures || {},
    batch: stored.followcleanBatch || {
      running: false,
      currentUsername: null,
      processedThisRun: 0,
      startedAt: null,
      tabId: null,
      lastMessage: "Parado"
    }
  };
}

async function saveBatch(patch) {
  const state = await getState();
  const batch = { ...state.batch, ...patch, updatedAt: new Date().toISOString() };
  await chrome.storage.local.set({ followcleanBatch: batch });
  return batch;
}

function clearTimers() {
  if (timer) clearTimeout(timer);
  if (timeoutTimer) clearTimeout(timeoutTimer);
  timer = null;
  timeoutTimer = null;
}

async function nextPending() {
  const { queue, results, failures } = await getState();
  return queue.find((username) => !results[username] && !failures[username]) || null;
}

async function ensureWorkerTab(username, existingTabId) {
  const url = `https://www.instagram.com/${encodeURIComponent(username)}/`;

  if (existingTabId) {
    try {
      const tab = await chrome.tabs.get(existingTabId);
      if (tab?.id) {
        await chrome.tabs.update(tab.id, { url, active: false });
        return tab.id;
      }
    } catch {}
  }

  const tab = await chrome.tabs.create({ url, active: false });
  return tab.id;
}

async function stopBatch(message = "Pausado") {
  clearTimers();
  await saveBatch({
    running: false,
    currentUsername: null,
    lastMessage: message
  });
}

async function markFailure(username, reason) {
  const state = await getState();
  state.failures[username] = {
    username,
    reason,
    updatedAt: new Date().toISOString()
  };
  await chrome.storage.local.set({ followcleanFailures: state.failures });
}

async function scheduleNext(delay = BETWEEN_PROFILES_MS) {
  clearTimers();
  timer = setTimeout(() => {
    void processNext();
  }, delay);
}

async function processNext() {
  const state = await getState();
  if (!state.batch.running) return;

  if ((state.batch.processedThisRun || 0) >= PROCESS_LIMIT) {
    await stopBatch(`Lote concluído: ${PROCESS_LIMIT} perfis verificados. Inicie outro lote para continuar.`);
    return;
  }

  const username = await nextPending();
  if (!username) {
    await stopBatch("Fila concluída ou sem perfis pendentes.");
    return;
  }

  const tabId = await ensureWorkerTab(username, state.batch.tabId);

  await saveBatch({
    running: true,
    currentUsername: username,
    tabId,
    lastMessage: `Verificando @${username}...`
  });

  timeoutTimer = setTimeout(async () => {
    const latest = await getState();
    if (!latest.batch.running || latest.batch.currentUsername !== username) return;

    await markFailure(username, "timeout");
    await saveBatch({
      processedThisRun: (latest.batch.processedThisRun || 0) + 1,
      lastMessage: `Não foi possível ler @${username}. Seguindo para o próximo.`
    });
    await scheduleNext();
  }, NAVIGATION_TIMEOUT_MS);
}

async function startBatch() {
  clearTimers();
  const state = await getState();

  await chrome.storage.local.set({ followcleanFailures: {} });
  await saveBatch({
    running: true,
    currentUsername: null,
    processedThisRun: 0,
    startedAt: new Date().toISOString(),
    tabId: state.batch.tabId || null,
    lastMessage: `Lote iniciado. Máximo de ${PROCESS_LIMIT} perfis por execução.`
  });

  await processNext();
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== "object") return;

  if (message.type === "FOLLOWCLEAN_START_BATCH") {
    void startBatch().then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message.type === "FOLLOWCLEAN_PAUSE_BATCH") {
    void stopBatch("Pausado pelo usuário.").then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message.type === "FOLLOWCLEAN_GET_STATUS") {
    void getState().then((state) => sendResponse({ ok: true, batch: state.batch }));
    return true;
  }

  if (message.type === "FOLLOWCLEAN_PROFILE_CAPTURED") {
    const username = normalizeUsername(message.username);
    if (!username) return;

    void (async () => {
      clearTimeout(timeoutTimer);
      timeoutTimer = null;

      const state = await getState();
      if (!state.batch.running) return;

      const processed = (state.batch.processedThisRun || 0) + 1;
      await saveBatch({
        processedThisRun: processed,
        currentUsername: null,
        lastMessage: `@${username}: ${Number(message.followersCount || 0).toLocaleString("pt-BR")} seguidores capturados.`
      });
      await scheduleNext();
    })();

    sendResponse({ ok: true });
    return true;
  }

  if (message.type === "FOLLOWCLEAN_BLOCKED") {
    void stopBatch(
      "O Instagram exibiu uma tela de login, verificação ou bloqueio. A fila foi pausada para não insistir."
    ).then(() => sendResponse({ ok: true }));
    return true;
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  void (async () => {
    const state = await getState();
    if (state.batch.tabId === tabId && state.batch.running) {
      await stopBatch("A aba de verificação foi fechada. Lote pausado.");
    }
  })();
});
