async function loadState() {
  const stored = await chrome.storage.local.get([
    "followcleanQueue",
    "followcleanResults"
  ]);

  const queue = Array.isArray(stored.followcleanQueue)
    ? stored.followcleanQueue
    : [];
  const results = stored.followcleanResults || {};
  const pending = queue.filter((username) => !results[username]);

  document.getElementById("queueTotal").textContent = queue.length;
  document.getElementById("capturedTotal").textContent =
    Object.keys(results).length;
  document.getElementById("pendingTotal").textContent = pending.length;

  const next = pending[0];
  const usernameEl = document.getElementById("nextUsername");
  const hintEl = document.getElementById("nextHint");
  const button = document.getElementById("openNext");

  if (!next) {
    usernameEl.textContent = queue.length
      ? "Fila concluída"
      : "Fila vazia";
    hintEl.textContent = queue.length
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
