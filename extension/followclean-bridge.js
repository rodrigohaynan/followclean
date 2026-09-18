(() => {
  const WEB_SOURCE = "followclean-web";
  const EXT_SOURCE = "followclean-extension";

  function post(type, payload = {}) {
    window.postMessage({ source: EXT_SOURCE, type, ...payload }, "*");
  }

  function normalizeUsernames(value) {
    if (!Array.isArray(value)) return [];
    return [...new Set(
      value
        .filter((item) => typeof item === "string")
        .map((item) => item.trim().toLowerCase().replace(/^@/, ""))
        .filter(Boolean)
    )];
  }

  async function sendResults() {
    const stored = await chrome.storage.local.get([
      "followcleanResults",
      "followcleanQueue",
      "followcleanQueueUpdatedAt"
    ]);

    const results = Object.values(stored.followcleanResults || {});
    post("RESULTS", {
      results,
      queueTotal: Array.isArray(stored.followcleanQueue)
        ? stored.followcleanQueue.length
        : 0,
      queueUpdatedAt: stored.followcleanQueueUpdatedAt || null
    });
  }

  window.addEventListener("message", async (event) => {
    if (event.source !== window) return;
    const message = event.data;
    if (!message || message.source !== WEB_SOURCE) return;

    if (message.type === "PING") {
      post("READY");
      return;
    }

    if (message.type === "SET_QUEUE") {
      const queue = normalizeUsernames(message.usernames);
      await chrome.storage.local.set({
        followcleanQueue: queue,
        followcleanQueueUpdatedAt: new Date().toISOString()
      });
      post("QUEUE_SAVED", { total: queue.length });
      return;
    }

    if (message.type === "GET_RESULTS") {
      await sendResults();
      return;
    }

    if (message.type === "CLEAR_QUEUE") {
      await chrome.storage.local.remove([
        "followcleanQueue",
        "followcleanQueueUpdatedAt"
      ]);
      post("QUEUE_SAVED", { total: 0 });
    }
  });

  post("READY");
})();
