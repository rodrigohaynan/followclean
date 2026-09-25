async function loadState() {
  const stored = await chrome.runtime.sendMessage({ type: "FOLLOWCLEAN_GET_STATE" });
  const account = stored?.account || null;
  const queue = account && Array.isArray(stored.queue) ? stored.queue : [];
  const results = account ? stored.results || {} : {};
  const failures = account ? stored.failures || {} : {};
  const cloudConfigured = Boolean(account && stored.cloudConfigured);
  document.getElementById("accountName").textContent =
    account ? "Conta vinculada: @" + account.username :
      "Nenhuma conta vinculada. Abra o FollowClean com a conta desejada.";
  const pending = queue.filter((username) => {
    const result = results[username];
    const validResult = result && Number(result.parserVersion || 0) >= 2;
    return !validResult && !failures[username];
  });
  const batch = account ? stored.batch || {
    running: false,
    processedThisRun: 0,
    currentUsername: null,
    lastMessage: "Parado"
  } : {
    running: false, processedThisRun: 0, currentUsername: null,
    lastMessage: "Entre no FollowClean com a conta desejada; a fila antiga está preservada separadamente."
  };

  document.getElementById("queueTotal").textContent = queue.length;
  document.getElementById("capturedTotal").textContent =
    Object.keys(results).length;
  document.getElementById("pendingTotal").textContent = pending.length;

  const batchStatus = document.getElementById("batchStatus");
  const batchMessage = document.getElementById("batchMessage");
  const batchProgress = document.getElementById("batchProgress");
  const startBatch = document.getElementById("startBatch");
  const pauseBatch = document.getElementById("pauseBatch");

  batchStatus.textContent = batch.running
    ? batch.currentUsername
      ? "@" + batch.currentUsername
      : "Em execução"
    : "Parado";
  batchMessage.textContent = batch.lastMessage || "Parado";
  batchProgress.style.width = batch.running ? "100%" : "0%";
  startBatch.disabled =
    !account || batch.running || (!cloudConfigured && pending.length === 0);
  pauseBatch.disabled = !batch.running;

  const cloudStatus = document.getElementById("cloudStatus");
  if (cloudStatus) {
    cloudStatus.textContent = cloudConfigured
      ? "Checkpoint em nuvem ativo para @" + account.username
      : account ? "Somente @" + account.username + " neste navegador" :
        "Vincule sua conta no site antes de iniciar a verificação";
  }

  const next = pending[0];
  const usernameEl = document.getElementById("nextUsername");
  const hintEl = document.getElementById("nextHint");
  const button = document.getElementById("openNext");

  if (!next) {
    usernameEl.textContent = !account ? "Conta não vinculada" : cloudConfigured
      ? "Fila em nuvem"
      : queue.length
        ? "Fila concluída"
        : "Fila vazia";
    hintEl.textContent = !account
      ? "Abra o FollowClean e conecte a conta correta. Dados antigos não serão carregados automaticamente."
      : cloudConfigured
      ? "Ao iniciar, a extensão buscará o próximo perfil pendente salvo na nuvem."
      : queue.length
        ? "Volte ao FollowClean e sincronize os resultados."
        : "Envie a fila pela página Limpeza do FollowClean.";
    button.disabled = true;
    button.dataset.username = "";
    return;
  }

  usernameEl.textContent = "@" + next;
  hintEl.textContent =
    "Abra o perfil e aguarde alguns segundos para a contagem ser capturada.";
  button.disabled = false;
  button.dataset.username = next;
}

async function openInstagramProfile(username) {
  const url = `https://www.instagram.com/${encodeURIComponent(username)}/`;
  const tabs = await chrome.tabs.query({
    url: ["https://www.instagram.com/*"]
  });

  if (tabs.length && tabs[0].id) {
    await chrome.tabs.update(tabs[0].id, { url, active: true });
    return;
  }

  await chrome.tabs.create({ url, active: true });
}

document.getElementById("openNext").addEventListener("click", async (event) => {
  const username = event.currentTarget.dataset.username;
  if (!username) return;
  await openInstagramProfile(username);
  window.close();
});

document.getElementById("openFollowClean").addEventListener("click", async () => {
  await chrome.tabs.create({
    url: "https://followclean.netlify.app/limpeza",
    active: true
  });
  window.close();
});

chrome.storage.onChanged.addListener(() => loadState());
loadState();


document.getElementById("startBatch").addEventListener("click", async () => {
  const response = await chrome.runtime.sendMessage({
    type: "FOLLOWCLEAN_START_BATCH"
  });
  if (response?.ok) await loadState();
});

document.getElementById("pauseBatch").addEventListener("click", async () => {
  const response = await chrome.runtime.sendMessage({
    type: "FOLLOWCLEAN_PAUSE_BATCH"
  });
  if (response?.ok) await loadState();
});
