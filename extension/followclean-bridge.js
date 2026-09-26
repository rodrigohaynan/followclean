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
      "followcleanQueueUpdatedAt",
      "followcleanBatch",
      "followcleanFailures",
      "followcleanCloudAuth",
      "followcleanDeviceId"
    ]);

    const results = Object.values(stored.followcleanResults || {});
    post("RESULTS", {
      results,
      queueTotal: Array.isArray(stored.followcleanQueue)
        ? stored.followcleanQueue.length
        : 0,
      queueUpdatedAt: stored.followcleanQueueUpdatedAt || null,
      batch: stored.followcleanBatch || null,
      failures: Object.values(stored.followcleanFailures || {}),
      cloud: stored.followcleanCloudAuth
        ? {
            configured: Boolean(stored.followcleanCloudAuth.configured),
            accountUsername: stored.followcleanCloudAuth.accountUsername || null,
            deviceId: stored.followcleanDeviceId || null
          }
        : null
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

    if (message.type === "SET_CLOUD_AUTH") {
      const token =
        typeof message.token === "string" ? message.token : "";
      const configured = Boolean(message.configured && token);
      const accountUsername =
        typeof message.accountUsername === "string"
          ? message.accountUsername
          : null;

      if (configured) {
        await chrome.storage.local.set({
          followcleanCloudAuth: {
            configured: true,
            token,
            accountUsername,
            updatedAt: new Date().toISOString()
          }
        });
      } else {
        await chrome.storage.local.remove(["followcleanCloudAuth"]);
      }

      post("CLOUD_AUTH_SAVED", { configured, accountUsername });
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

    if (message.type === "SET_QUEUE_AND_START") {
      const queue = normalizeUsernames(message.usernames);
      await chrome.storage.local.set({
        followcleanQueue: queue,
        followcleanQueueUpdatedAt: new Date().toISOString()
      });
      post("QUEUE_SAVED", { total: queue.length });

      const response = await chrome.runtime.sendMessage({
        type: "FOLLOWCLEAN_START_BATCH"
      });
      post("BATCH_ACTION", {
        action: "start",
        ok: Boolean(response?.ok)
      });
      await sendResults();
      return;
    }

    if (message.type === "GET_RESULTS") {
      await sendResults();
      return;
    }

    if (message.type === "START_BATCH") {
      const response = await chrome.runtime.sendMessage({
        type: "FOLLOWCLEAN_START_BATCH"
      });
      post("BATCH_ACTION", {
        action: "start",
        ok: Boolean(response?.ok)
      });
      await sendResults();
      return;
    }

    if (message.type === "PAUSE_BATCH") {
      const response = await chrome.runtime.sendMessage({
        type: "FOLLOWCLEAN_PAUSE_BATCH"
      });
      post("BATCH_ACTION", {
        action: "pause",
        ok: Boolean(response?.ok)
      });
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

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    if (
      changes.followcleanResults ||
      changes.followcleanBatch ||
      changes.followcleanQueue ||
      changes.followcleanFailures ||
      changes.followcleanCloudAuth
    ) {
      void sendResults();
    }
  });

  post("READY");
})();
