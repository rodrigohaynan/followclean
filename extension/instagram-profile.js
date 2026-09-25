(() => {
  const PARSER_VERSION = 2;
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
  let lastUnavailableSignature = "";

  function currentUsername() {
    const segment = location.pathname.split("/").filter(Boolean)[0];
    if (!segment) return null;
    const normalized = segment.toLowerCase();
    if (RESERVED.has(normalized)) return null;
    return normalized;
  }

  function normalizedText(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ");
  }

  function hasScaleUnit(raw) {
    const text = normalizedText(raw);
    return /(?:^|\s|\d)(?:k|mil|milhao|milhão|milhoes|milhões|m|mi|million|millions|b|bilhao|bilhão|bilhoes|bilhões|billion|billions|thousand)(?:\s|$|\b)/i.test(text);
  }

  function detectMultiplier(raw) {
    const text = normalizedText(raw);

    if (/(?:\b|\d)(b|bilhao|bilhão|bilhoes|bilhões|billion|billions)\b/i.test(text)) {
      return 1_000_000_000;
    }
    if (/(?:\b|\d)(m|mi|milhao|milhão|milhoes|milhões|million|millions)\b/i.test(text)) {
      return 1_000_000;
    }
    if (/(?:\b|\d)(k|mil|thousand)\b/i.test(text)) {
      return 1_000;
    }
    return 1;
  }

  function parseScaledNumber(token, multiplier) {
    let normalized = token.replace(/\s/g, "");

    if (multiplier === 1) {
      const digits = normalized.replace(/\D/g, "");
      if (!digits) return null;
      const value = Number.parseInt(digits, 10);
      return Number.isFinite(value) ? value : null;
    }

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

  function parseHumanCount(raw) {
    if (!raw) return null;
    const text = normalizedText(raw);
    const token = text.match(/[\d.,]+/)?.[0];
    if (!token) return null;

    return parseScaledNumber(token, detectMultiplier(text));
  }

  function fromMetaDescription() {
    const meta =
      document.querySelector('meta[property="og:description"]') ||
      document.querySelector('meta[name="description"]');
    const content = meta?.getAttribute("content") || "";

    const match = content.match(
      /([\d.,]+(?:\s*(?:k|m|b|mil|mi|milhao|milhão|milhoes|milhões|thousand|million|millions|billion|billions|bilhao|bilhão|bilhoes|bilhões))?)\s+(?:followers|seguidores)/i
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
        link.getAttribute("title") ||
        "";
      const text = link.textContent || "";

      const parsedTitle = parseHumanCount(title);
      const parsedText = parseHumanCount(text);

      // Alguns layouts do Instagram retornam title="22" enquanto o texto
      // visível mostra "22 mil". Quando houver uma unidade abreviada ou por
      // extenso no texto visível, ela sempre tem prioridade sobre o title.
      if (hasScaleUnit(text) && typeof parsedText === "number") {
        return parsedText;
      }

      if (typeof parsedTitle === "number") return parsedTitle;
      if (typeof parsedText === "number") return parsedText;
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

  function detectUnavailableReason() {
    const username = currentUsername();
    if (username?.startsWith("__deleted__")) return "deleted_username";

    const text = normalizedText(
      [document.title, document.body?.innerText || ""].join(" ")
    );

    const unavailablePhrases = [
      "sorry, this page isn't available",
      "page isn't available",
      "the link you followed may be broken",
      "esta página não está disponível",
      "esta pagina nao esta disponivel",
      "página não disponível",
      "pagina nao disponivel",
      "o link que você seguiu pode estar quebrado",
      "o link que voce seguiu pode estar quebrado",
      "user not found",
      "usuário não encontrado",
      "usuario nao encontrado"
    ];

    if (unavailablePhrases.some((phrase) => text.includes(phrase))) {
      return "unavailable";
    }

    return null;
  }

  async function reportUnavailable(username, reason) {
    const signature = `${username}:${reason}`;
    if (signature === lastUnavailableSignature) return;
    lastUnavailableSignature = signature;

    try {
      await chrome.runtime.sendMessage({
        type: "FOLLOWCLEAN_PROFILE_UNAVAILABLE",
        username,
        reason
      });
    } catch {}
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

    const unavailableReason = detectUnavailableReason();
    if (unavailableReason) {
      await reportUnavailable(username, unavailableReason);
      return;
    }

    const followersCount =
      fromMetaDescription() ?? fromVisibleProfileHeader();

    if (typeof followersCount !== "number") return;

    const signature = `${username}:${followersCount}:v${PARSER_VERSION}`;
    if (signature === lastSavedSignature) return;
    lastSavedSignature = signature;

    // Only the background worker can write to the account-scoped database.
    // A profile opened under the wrong account or outside this account's queue
    // must never be persisted in a shared global results map.
    try {
      await chrome.runtime.sendMessage({
        type: "FOLLOWCLEAN_PROFILE_CAPTURED",
        username,
        followersCount,
        parserVersion: PARSER_VERSION
      });
    } catch {}
  }

  capture();
  setTimeout(capture, 1500);
  setTimeout(capture, 4000);
  setTimeout(capture, 7000);

  const observer = new MutationObserver(() => {
    clearTimeout(window.__followcleanCaptureTimer);
    window.__followcleanCaptureTimer = setTimeout(capture, 700);
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
})();
