(() => {
  const WEB_SOURCE = "followclean-web";
  const EXT_SOURCE = "followclean-extension";
  let active = null;
  let checking = null;

  function post(type, payload = {}) {
    window.postMessage({ source: EXT_SOURCE, type,
      ownerId: active?.ownerId || null, ...payload }, "*");
  }

  function validOwner(account) {
    return account && /^[a-zA-Z0-9_-]{1,100}$/.test(account.id || "") &&
      /^[a-z0-9._]{1,30}$/.test(account.username || "");
  }

  async function verifyAndBind() {
    if (checking) return checking;
    checking = (async () => {
      let account = null;
      try {
        const response = await fetch("/api/cleanup/cloud/token", {
          credentials: "same-origin", cache: "no-store"
        });
        if (response.ok) {
          const payload = await response.json();
          if (validOwner(payload.account)) {
            account = {
              ownerId: payload.account.id,
              username: payload.account.username.toLowerCase()
            };
          }
        }
      } catch {}

      if (!account) {
        active = null;
        await chrome.runtime.sendMessage({ type: "FOLLOWCLEAN_UNBIND" });
        post("ACCOUNT_REQUIRED");
        return null;
      }

      if (!active || active.ownerId !== account.ownerId ||
          active.username !== account.username) {
        const bound = await chrome.runtime.sendMessage({
          type: "FOLLOWCLEAN_BIND_ACCOUNT", account
        });
        if (!bound?.ok) {
          active = null;
          post("ACCOUNT_REQUIRED", { message: bound?.error || "Falha ao vincular a conta." });
          return null;
        }
        active = account;
        post("READY", { accountUsername: account.username });
      }
      return account;
    })().finally(() => { checking = null; });
    return checking;
  }

  function normalizeUsernames(value) {
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter((item) => typeof item === "string")
      .map((item) => item.trim().toLowerCase().replace(/^@/, ""))
      .filter((item) => /^[a-z0-9._]{1,30}$/.test(item) && !item.startsWith("__deleted__")))];
  }

  async function sendResults() {
    const account = await verifyAndBind();
    if (!account) return;
    const response = await chrome.runtime.sendMessage({ type: "FOLLOWCLEAN_GET_STATE" });
    if (!response?.ok || response.account?.ownerId !== account.ownerId) return;
    post("RESULTS", {
      results: Object.values(response.results || {}),
      queueTotal: response.queue?.length || 0,
      batch: response.batch || null,
      failures: Object.values(response.failures || {}),
      cloud: { configured: false, accountUsername: account.username }
    });
  }

  window.addEventListener("message", async (event) => {
    if (event.source !== window) return;
    const message = event.data;
    if (!message || message.source !== WEB_SOURCE) return;
    const account = await verifyAndBind();
    if (!account || (message.ownerId && message.ownerId !== account.ownerId)) return;

    if (message.type === "PING") {
      post("READY", { accountUsername: account.username });
      return;
    }
    // Cloud authentication is intentionally not copied to the extension while
    // legacy cloud queues are being isolated; scans run on this account's local queue.
    if (message.type === "SET_CLOUD_AUTH") {
      post("CLOUD_AUTH_SAVED", { configured: false, accountUsername: account.username });
      return;
    }
    if (message.type === "SET_QUEUE" || message.type === "SET_QUEUE_AND_START") {
      const queue = normalizeUsernames(message.usernames);
      const response = await chrome.runtime.sendMessage({
        type: "FOLLOWCLEAN_SET_QUEUE", ownerId: account.ownerId,
        usernames: queue, forceRecheck: Boolean(message.forceRecheck)
      });
      if (!response?.ok) {
        post("BATCH_ACTION", { action: "queue", ok: false, error: response?.error });
        return;
      }
      post("QUEUE_SAVED", { total: queue.length });
      if (message.type === "SET_QUEUE_AND_START") {
        const start = await chrome.runtime.sendMessage({
          type: "FOLLOWCLEAN_START_BATCH", ownerId: account.ownerId,
          forceRecheck: Boolean(message.forceRecheck)
        });
        post("BATCH_ACTION", { action: "start", ok: Boolean(start?.ok), error: start?.error });
      }
      await sendResults();
      return;
    }
    if (message.type === "GET_RESULTS") {
      await sendResults();
      return;
    }
    if (message.type === "START_BATCH" || message.type === "PAUSE_BATCH") {
      const response = await chrome.runtime.sendMessage({
        type: message.type === "START_BATCH" ? "FOLLOWCLEAN_START_BATCH" : "FOLLOWCLEAN_PAUSE_BATCH",
        ownerId: account.ownerId
      });
      post("BATCH_ACTION", { action: message.type, ok: Boolean(response?.ok), error: response?.error });
      await sendResults();
      return;
    }
    if (message.type === "CLEAR_QUEUE") {
      await chrome.runtime.sendMessage({
        type: "FOLLOWCLEAN_SET_QUEUE", ownerId: account.ownerId, usernames: []
      });
      await sendResults();
    }
  });

  // The popup must revalidate the current first-party session before it
  // exposes Start/Manual controls; a cached account from yesterday is unsafe.
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "FOLLOWCLEAN_VERIFY_ACCOUNT") return;
    void verifyAndBind().then((account) => {
      sendResponse({ ok: Boolean(account), ownerId: account?.ownerId || null });
    }).catch(() => sendResponse({ ok: false }));
    return true;
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !active) return;
    if (Object.keys(changes).some((name) => name.startsWith("followcleanV2:" + active.ownerId + ":"))) {
      void sendResults();
    }
  });

  // Refresh the browser session when returning from the Instagram/Meta login.
  window.addEventListener("focus", () => { void verifyAndBind().then(sendResults); });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) void verifyAndBind().then(sendResults);
  });
  void verifyAndBind().then(sendResults);
})();