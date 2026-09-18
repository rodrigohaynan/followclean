"use client";

declare global {
  interface Window {
    FollowCleanAndroid?: {
      postMessage?: (value: string) => void;
    };
  }
}

export function InstagramConnectButton() {
  function connect() {
    const bridge = window.FollowCleanAndroid;
    if (bridge?.postMessage) {
      bridge.postMessage(JSON.stringify({ type: "START_OAUTH" }));
      return;
    }

    window.location.href = "/api/instagram/connect";
  }

  return (
    <button
      type="button"
      onClick={connect}
      className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 font-black text-white"
    >
      Conectar Instagram
    </button>
  );
}
