const NAVIGATION_TIMEOUT_MS = 25_000;
const BETWEEN_PROFILES_MS = 35_000;
const COOLDOWN_EVERY = 100;
const COOLDOWN_MS = 5 * 60_000;

const NEXT_ALARM = "followclean-next";
const TIMEOUT_ALARM = "followclean-timeout";
// Legacy global followcleanQueue / Results / Batch / Failures remain untouched
// as recovery archives. Version 0.4.3 reads only account-scoped keys.
const ACTIVE_ACCOUNT_KEY = "followcleanV2ActiveAccount";
const SCOPED_KEYS = [
  "followcleanQueue", "followcleanForcedRechecks", "followcleanResults",
  "followcleanBatch", "followcleanFailures", "followcleanCloudAuth",
  "followcleanQueueUpdatedAt"
];

function scopedName(ownerId, key) {
  return `followcleanV2:${ownerId}:${key}`;
}

async function getActiveAccount() {
  const stored = await chrome.storage.local.get(ACTIVE_ACCOUNT_KEY);
  const account = stored[ACTIVE_ACCOUNT_KEY];
  if (!account || !/^[a-zA-Z0-9_-]{1,100}$/.test(account.ownerId || "") ||
      !/^[a-z0-9._]{1,30}$/.test(account.username || "")) return null;
  return account;
}

async function getScoped(keys, ownerId = null) {
  const id = ownerId || (await getActiveAccount())?.ownerId;
  if (!id) return {};
  const stored = await chrome.storage.local.get(keys.map((key) => scopedName(id, key)));
  return Object.fromEntries(keys.map((key) => [key, stored[scopedName(id, key)]]));
}

async function setScoped(data, ownerId = null) {
  const id = ownerId || (await getActiveAccount())?.ownerId;
  if (!id) throw new Error("Abra o FollowClean conectado para vincular a extensão.");
  await chrome.storage.local.set(Object.fromEntries(
    Object.entries(data).map(([key, value]) => [scopedName(id, key), value])
  ));
}

async function removeScoped(keys, ownerId = null) {
  const id = ownerId || (await getActiveAccount())?.ownerId;
  if (!id) return;
  await chrome.storage.local.remove(keys.map((key) => scopedName(id, key)));
}

async function bindAccount(account) {
  if (!account || !/^[a-zA-Z0-9_-]{1,100}$/.test(account.ownerId || "") ||
      !/^[a-z0-9._]{1,30}$/.test(account.username || "")) {
    throw new Error("Conta Instagram não identificada.");
  }
  const old = await getActiveAccount();
  if (old?.ownerId !== account.ownerId) {
    // No old queue is run automatically after switching accounts. Global
    // pre-0.4.3 keys are preserved but never imported into a new account.
    await clearAlarms();
    if (old) {
      await setScoped({
        followcleanBatch: {
          ...(await getScoped(["followcleanBatch"], old.ownerId)).followcleanBatch,
          running: false, currentUsername: null, tabId: null,
          lastMessage: "Conta alterada; verificação pausada para evitar mistura."
        }
      }, old.ownerId);
    }
  }
  await chrome.storage.local.set({
    [ACTIVE_ACCOUNT_KEY]: {
      ownerId: account.ownerId, username: account.username,
      updatedAt: new Date().toISOString()
    }
  });
  const state = await getState();
  return { account: await getActiveAccount(), batch: state.batch,
    queueTotal: state.queue.length, capturedTotal: Object.keys(state.results).length };
}

function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase().replace(/^@/, "");
}

async function ensureDeviceId() {
  const stored = await chrome.storage.local.get(["followcleanDeviceId"]);
  if (stored.followcleanDeviceId) return stored.followcleanDeviceId;

  const deviceId =
    typeof crypto?.randomUUID === "function"
      ? crypto.randomUUID()
      : "device-" + Date.now() + "-" + Math.random().toString(36).slice(2);

  await chrome.storage.local.set({ followcleanDeviceId: deviceId });
  return deviceId;
}

async function getState() {
  const account = await getActiveAccount();
  const stored = await getScoped(SCOPED_KEYS, account?.ownerId);
  return {
    account,
    queue: Array.isArray(stored.followcleanQueue)
      ? stored.followcleanQueue.map(normalizeUsername).filter(Boolean)
      : [],
    forcedRechecks: Array.isArray(stored.followcleanForcedRechecks)
      ? stored.followcleanForcedRechecks.map(normalizeUsername).filter(Boolean)
      : [],
    results: stored.followcleanResults || {},
    failures: stored.followcleanFailures || {},
    cloudAuth: account ? stored.followcleanCloudAuth || null : null,
    deviceId: stored.followcleanDeviceId || (await ensureDeviceId()),
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
  const batch = {
    ...state.batch,
    ...patch,
    updatedAt: new Date().toISOString()
  };
  await setScoped({ followcleanBatch: batch }, state.account?.ownerId);
  return batch;
}

async function clearAlarms() {
  await Promise.allSettled([
    chrome.alarms.clear(NEXT_ALARM),
    chrome.alarms.clear(TIMEOUT_ALARM)
  ]);
}

async function scheduleNext(delay = BETWEEN_PROFILES_MS) {
  await chrome.alarms.clear(NEXT_ALARM);
  await chrome.alarms.create(NEXT_ALARM, { when: Date.now() + delay });
}

async function scheduleTimeout() {
  await chrome.alarms.clear(TIMEOUT_ALARM);
  await chrome.alarms.create(TIMEOUT_ALARM, {
    when: Date.now() + NAVIGATION_TIMEOUT_MS
  });
}

async function nextPendingLocal() {
  const { account, queue, results, failures, forcedRechecks } = await getState();
  if (!account) return null;
  const forced = new Set(forcedRechecks);
  return (
    queue.find((username) => {
      if (forced.has(username)) return true;
      const result = results[username];
      const validResult = result && Number(result.parserVersion || 0) >= 2;
      return !validResult && !failures[username];
    }) || null
  );
}

async function cloudRequest(path, options = {}) {
  const state = await getState();
  const cloud = state.cloudAuth;

  if (!state.account || !cloud?.configured || !cloud?.token ||
      cloud.ownerId !== state.account.ownerId) {
    return { enabled: false, ok: false, data: null };
  }

  try {
    const response = await fetch(
      "https://followclean.netlify.app" + path,
      {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + cloud.token,
          ...(options.headers || {})
        }
      }
    );

    const data = await response.json().catch(() => null);
    return { enabled: true, ok: response.ok, data };
  } catch {
    return { enabled: true, ok: false, data: null };
  }
}

async function claimNextCloud(deviceId) {
  return cloudRequest("/api/cleanup/cloud/claim", {
    method: "POST",
    body: JSON.stringify({ deviceId })
  });
}

async function reportCloudResult(payload) {
  return cloudRequest("/api/cleanup/cloud/result", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

async function resolveNextUsername(state) {
  // Forced reviews are a local session even when the user's regular cloud
  // checkpoint is enabled: cloud-verified rows must not suppress the review.
  if (state.batch.forceRecheckMode) {
    return { mode: "local", retry: false, username: await nextPendingLocal() };
  }
  if (state.cloudAuth?.configured && state.cloudAuth?.token) {
    const claimed = await claimNextCloud(state.deviceId);

    if (!claimed.ok) {
      return {
        mode: "cloud",
        retry: true,
        anotherDevice: claimed.data?.error === "another_device_active",
        username: null
      };
    }

    return {
      mode: "cloud",
      retry: false,
      username: normalizeUsername(claimed.data?.item?.username || "")
    };
  }

  return {
    mode: "local",
    retry: false,
    username: await nextPendingLocal()
  };
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
  const state = await getState();
  await clearAlarms();

  if (state.cloudAuth?.configured && state.cloudAuth?.token && state.deviceId) {
    await cloudRequest("/api/cleanup/cloud/release", {
      method: "POST",
      body: JSON.stringify({ deviceId: state.deviceId })
    });
  }

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
  await setScoped({ followcleanFailures: state.failures }, state.account?.ownerId);
}

async function clearFailure(username) {
  const state = await getState();
  if (!state.failures[username]) return;
  delete state.failures[username];
  await setScoped({ followcleanFailures: state.failures }, state.account?.ownerId);
}

async function finishCurrentProfile({
  username,
  status,
  followersCount = null,
  parserVersion = null,
  reason = null
}) {
  await chrome.alarms.clear(TIMEOUT_ALARM);

  const state = await getState();
  const processed = (state.batch.processedThisRun || 0) + 1;

  if (!state.forcedRechecks.includes(username) && state.cloudAuth?.configured && state.cloudAuth?.token) {
    await reportCloudResult({
      deviceId: state.deviceId,
      username,
      status,
      followersCount,
      parserVersion,
      reason
    });
  }

  if (state.forcedRechecks.includes(username)) {
    await setScoped({
      followcleanForcedRechecks: state.forcedRechecks.filter((value) => value !== username)
    }, state.account?.ownerId);
  }
  await saveBatch({
    processedThisRun: processed,
    currentUsername: null,
    lastMessage:
      status === "verified"
        ? `@${username}: ${Number(followersCount || 0).toLocaleString("pt-BR")} seguidores capturados.`
        : `@${username} está indisponível. Movido para a lista separada.`
  });

  const cooldown =
    processed > 0 && processed % COOLDOWN_EVERY === 0
      ? COOLDOWN_MS
      : BETWEEN_PROFILES_MS;

  if (cooldown === COOLDOWN_MS) {
    await saveBatch({
      lastMessage:
        `${processed.toLocaleString("pt-BR")} perfis verificados nesta sessão. ` +
        "Pausa preventiva de 5 minutos antes de continuar."
    });
  }

  await scheduleNext(cooldown);
}

async function processNext() {
  const state = await getState();
  if (!state.account || !state.batch.running) return;

  const next = await resolveNextUsername(state);

  if (next.retry) {
    await saveBatch({
      lastMessage: next.anotherDevice
        ? "Outro computador está verificando esta conta. Este dispositivo aguardará 2 minutos antes de tentar assumir a fila."
        : "Sincronização em nuvem indisponível no momento. Nova tentativa em 1 minuto."
    });
    await scheduleNext(next.anotherDevice ? 120_000 : 60_000);
    return;
  }

  const username = next.username;
  if (!username) {
    await stopBatch(
      next.mode === "cloud"
        ? "Fila em nuvem concluída ou sem perfis pendentes."
        : "Fila concluída ou sem perfis pendentes."
    );
    return;
  }

  const tabId = await ensureWorkerTab(username, state.batch.tabId);

  await saveBatch({
    running: true,
    currentUsername: username,
    tabId,
    lastMessage:
      `Verificando @${username} · ${(state.batch.processedThisRun || 0) + 1}º perfil desta sessão`
  });

  await scheduleTimeout();
}

async function handleTimeout() {
  const state = await getState();
  if (!state.batch.running || !state.batch.currentUsername) return;

  const username = normalizeUsername(state.batch.currentUsername);
  await markFailure(username, "timeout");

  await finishCurrentProfile({
    username,
    status: "unavailable",
    reason: "timeout"
  });
}

async function startBatch(forceRecheckMode = false) {
  const state = await getState();
  if (!state.account) return { ok: false, error: "Conecte o Instagram no site FollowClean." };
  if (!state.queue.length) return { ok: false, error: "Fila vazia para esta conta. Importe a exportação da conta atual e envie a fila novamente." };
  await clearAlarms();
  await saveBatch({
    running: true,
    forceRecheckMode,
    currentUsername: null,
    processedThisRun: 0,
    startedAt: new Date().toISOString(),
    tabId: state.batch.tabId || null,
    lastMessage:
      state.cloudAuth?.configured
        ? "Verificação contínua iniciada com checkpoint em nuvem."
        : "Verificação contínua iniciada neste navegador."
  });

  await processNext();
  return { ok: true };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== "object") return;

  if (message.type === "FOLLOWCLEAN_UNBIND") {
    if (!sender.tab?.url?.startsWith("https://followclean.netlify.app/")) {
      sendResponse({ ok: false });
      return false;
    }
    void (async () => {
      const old = await getActiveAccount();
      if (old) await bindAccount({ ...old });
      await clearAlarms();
      if (old) {
        const record = await getScoped(["followcleanBatch"], old.ownerId);
        await setScoped({ followcleanBatch: {
          ...record.followcleanBatch, running: false, currentUsername: null,
          tabId: null, lastMessage: "Sessão encerrada. Entre no FollowClean para vincular esta extensão."
        } }, old.ownerId);
      }
      await chrome.storage.local.remove(ACTIVE_ACCOUNT_KEY);
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (message.type === "FOLLOWCLEAN_SET_QUEUE") {
    if (!sender.tab?.url?.startsWith("https://followclean.netlify.app/")) {
      sendResponse({ ok: false, error: "Origem inválida." });
      return false;
    }
    void (async () => {
      const state = await getState();
      if (!state.account || state.account.ownerId !== message.ownerId) {
        sendResponse({ ok: false, error: "Conta diferente. Atualize o FollowClean." });
        return;
      }
      if (state.batch.running) {
        sendResponse({ ok: false, error: "Pause o lote antes de substituir a fila." });
        return;
      }
      const queue = [...new Set((Array.isArray(message.usernames) ? message.usernames : [])
        .map(normalizeUsername).filter((v) => /^[a-z0-9._]{1,30}$/.test(v) && !v.startsWith("__deleted__")))];
      await setScoped({
        followcleanQueue: queue,
        followcleanForcedRechecks: message.forceRecheck ? queue : [],
        followcleanQueueUpdatedAt: new Date().toISOString()
      }, state.account.ownerId);
      sendResponse({ ok: true, total: queue.length });
    })().catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "FOLLOWCLEAN_BIND_ACCOUNT") {
    const allowed = sender.tab?.url?.startsWith("https://followclean.netlify.app/");
    if (!allowed) {
      sendResponse({ ok: false, error: "Vinculação permitida somente no FollowClean." });
      return false;
    }
    void bindAccount(message.account)
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "FOLLOWCLEAN_GET_STATE") {
    void getState().then((state) => sendResponse({
      ok: true, account: state.account, queue: state.queue,
      results: state.results, failures: state.failures,
      cloudConfigured: Boolean(state.cloudAuth?.configured),
      batch: state.batch
    }));
    return true;
  }

  if (message.type === "FOLLOWCLEAN_START_BATCH") {
    void (async () => {
      const state = await getState();
      if (message.ownerId && message.ownerId !== state.account?.ownerId) {
        return { ok: false, error: "Conta alterada. Atualize o FollowClean." };
      }
      return startBatch(Boolean(message.forceRecheck));
    })().then(sendResponse);
    return true;
  }

  if (message.type === "FOLLOWCLEAN_PAUSE_BATCH") {
    void stopBatch("Pausado pelo usuário. O progresso salvo será mantido.")
      .then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message.type === "FOLLOWCLEAN_GET_STATUS") {
    void getState().then((state) =>
      sendResponse({
        ok: true,
        batch: state.batch,
        account: state.account,
        cloudConfigured: Boolean(
          state.cloudAuth?.configured && state.cloudAuth?.token
        )
      })
    );
    return true;
  }

  if (message.type === "FOLLOWCLEAN_PROFILE_UNAVAILABLE") {
    const username = normalizeUsername(message.username);
    if (!username) return;

    void (async () => {
      const state = await getState();
      if (!state.account || !state.batch.running ||
          sender.tab?.id !== state.batch.tabId ||
          username !== state.batch.currentUsername) return;

      await markFailure(username, message.reason || "unavailable");
      await finishCurrentProfile({
        username,
        status: "unavailable",
        reason: message.reason || "unavailable"
      });
    })();

    sendResponse({ ok: true });
    return true;
  }

  if (message.type === "FOLLOWCLEAN_PROFILE_CAPTURED") {
    const username = normalizeUsername(message.username);
    if (!username) return;

    void (async () => {
      const state = await getState();
      if (!state.account || !state.batch.running ||
          sender.tab?.id !== state.batch.tabId ||
          username !== state.batch.currentUsername) return;

      await clearFailure(username);
      await finishCurrentProfile({
        username,
        status: "verified",
        followersCount: Number(message.followersCount || 0),
        parserVersion: Number(message.parserVersion || 2)
      });
    })();

    sendResponse({ ok: true });
    return true;
  }

  if (message.type === "FOLLOWCLEAN_BLOCKED") {
    void stopBatch(
      "O Instagram exibiu login, verificação ou bloqueio. A verificação foi pausada automaticamente."
    ).then(() => sendResponse({ ok: true }));
    return true;
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === NEXT_ALARM) {
    void processNext();
  } else if (alarm.name === TIMEOUT_ALARM) {
    void handleTimeout();
  }
});

chrome.runtime.onStartup.addListener(() => {
  void (async () => {
    const state = await getState();
    if (state.batch.running) {
      await saveBatch({
        lastMessage: "Chrome reiniciado. Retomando a fila salva..."
      });
      await scheduleNext(2_000);
    }
  })();
});

chrome.runtime.onInstalled.addListener(() => {
  void (async () => {
    await ensureDeviceId();
    // The previous release stored an unscoped queue and might have left an
    // alarm running. Stop it without touching its original saved records.
    await clearAlarms();
  })();
});

chrome.tabs.onRemoved.addListener((tabId) => {
  void (async () => {
    const state = await getState();
    if (state.batch.tabId === tabId && state.batch.running) {
      await stopBatch(
        "A aba de verificação foi fechada. O progresso foi salvo e a execução foi pausada."
      );
    }
  })();
});

void (async () => {
  const state = await getState();
  if (state.account && state.batch.running) {
    const alarms = await chrome.alarms.getAll();
    const hasNext = alarms.some((alarm) => alarm.name === NEXT_ALARM);
    const hasTimeout = alarms.some((alarm) => alarm.name === TIMEOUT_ALARM);

    if (!hasNext && !hasTimeout) {
      await scheduleNext(2_000);
    }
  }
})();
