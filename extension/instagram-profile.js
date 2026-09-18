(() => {
  const RESERVED = new Set([
    "accounts",
    "direct",
    "explore",
    "reels",
    "reel",
    "p",
    "stories",
    "about",
    "developer",
    "legal"
  ]);

  let lastSavedSignature = "";

  function currentUsername() {
    const segment = location.pathname.split("/").filter(Boolean)[0];
    if (!segment) return null;
    const normalized = segment.toLowerCase();
    if (RESERVED.has(normalized)) return null;
    return normalized;
  }

  function parseHumanCount(raw) {
    if (!raw) return null;
    const text = String(raw)
      .trim()
      .toLowerCase()
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ");

    let multiplier = 1;
    if (/\b(k|mil|thousand)\b/.test(text)) multiplier = 1_000;
    if (/\b(m|mi|million|millions|milhão|milhoes|milhões)\b/.test(text)) {
      multiplier = 1_000_000;
    }
    if (/\b(b|billion|billions|bilhão|bilhoes|bilhões)\b/.test(text)) {
      multiplier = 1_000_000_000;
    }

    const token = text.match(/[\d.,]+/)?.[0];
    if (!token) return null;

    if (multiplier > 1) {
      let normalized = token;
      if (normalized.includes(",") && normalized.includes(".")) {
        const lastComma = normalized.lastIndexOf(",");
        const lastDot = normalized.lastIndexOf(".");
        const decimal = lastComma > lastDot ? "," : ".";
        normalized = normalized
          .replace(decimal === "," ? /\./g : /,/g, "")
          .replace(decimal, ".");
      } else if (normalized.includes(",")) {
        normalized = normalized.replace(",", ".");
      }

      const value = Number.parseFloat(normalized);
      return Number.isFinite(value) ? Math.round(value * multiplier) : null;
    }

    const digits = token.replace(/\D/g, "");
    if (!digits) return null;
    const value = Number.parseInt(digits, 10);
    return Number.isFinite(value) ? value : null;
  }

  function fromMetaDescription() {
    const meta =
      document.querySelector('meta[property="og:description"]') ||
      document.querySelector('meta[name="description"]');
    const content = meta?.getAttribute("content") || "";

    const match = content.match(
      /([\d.,]+(?:\s*(?:k|m|b|mil|mi|thousand|million|millions|milhão|milhoes|milhões))?)\s+(?:followers|seguidores)/i
    );
    return match ? parseHumanCount(match[1]) : null;
  }

  function fromVisibleProfileHeader() {
    const followerLinks = [
      ...document.querySelectorAll(
        'a[href*="/followers/"], a[href$="/followers"]'
      )
    ];

    for (const link of followerLinks) {
      const title =
        link.querySelector("[title]")?.getAttribute("title") ||
        link.getAttribute("title");
      const exact = parseHumanCount(title);
      if (typeof exact === "number") return exact;

      const text = link.textContent || "";
      const parsed = parseHumanCount(text);
      if (typeof parsed === "number") return parsed;
    }

    const candidates = [...document.querySelectorAll("header li, header span")];
    for (const node of candidates) {
      const text = (node.textContent || "").trim();
      if (!/(followers|seguidores)/i.test(text)) continue;
      const parsed = parseHumanCount(text);
      if (typeof parsed === "number") return parsed;
    }

    return null;
  }

  async function capture() {
    if (
      location.pathname.startsWith("/accounts/") ||
      location.pathname.startsWith("/challenge/") ||
      location.pathname.startsWith("/checkpoint/")
    ) {
      try {
        await chrome.runtime.sendMessage({ type: "FOLLOWCLEAN_BLOCKED" });
      } catch {}
      return;
    }

    const username = currentUsername();
    if (!username) return;

    const followersCount =
      fromMetaDescription() ?? fromVisibleProfileHeader();

    if (typeof followersCount !== "number") return;

    const signature = `${username}:${followersCount}`;
    if (signature === lastSavedSignature) return;
    lastSavedSignature = signature;

    const stored = await chrome.storage.local.get(["followcleanResults"]);
    const results = stored.followcleanResults || {};
    results[username] = {
      username,
      followersCount,
      dataSource: "extension",
      updatedAt: new Date().toISOString(),
      profileUrl: location.href
    };

    await chrome.storage.local.set({ followcleanResults: results });

    try {
      await chrome.runtime.sendMessage({
        type: "FOLLOWCLEAN_PROFILE_CAPTURED",
        username,
        followersCount
      });
    } catch {}
  }

  capture();
  setTimeout(capture, 1500);
  setTimeout(capture, 4000);

  const observer = new MutationObserver(() => {
    clearTimeout(window.__followcleanCaptureTimer);
    window.__followcleanCaptureTimer = setTimeout(capture, 700);
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
})();
