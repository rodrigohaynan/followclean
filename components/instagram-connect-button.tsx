"use client";

import { useState } from "react";

declare global {
  interface Window {
    FollowCleanAndroid?: {
      postMessage?: (value: string) => void;
    };
  }
}

export function InstagramConnectButton({ officialEnabled = true }: { officialEnabled?: boolean }) {
  const [personalOpen, setPersonalOpen] = useState(false);

  function connect() {
    if (!officialEnabled) return;
    const bridge = window.FollowCleanAndroid;
    if (bridge?.postMessage) {
      bridge.postMessage(JSON.stringify({ type: "START_OAUTH" }));
      return;
    }

    window.location.href = "/api/instagram/connect";
  }

  return (
    <div className="w-full max-w-sm space-y-3 md:w-auto">
      <button
        type="button"
        onClick={connect}
        disabled={!officialEnabled}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {officialEnabled ? "Conectar conta profissional" : "Conta profissional indisponível"}
      </button>

      <button
        type="button"
        onClick={() => setPersonalOpen((current) => !current)}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-5 py-3 font-black text-blue-800"
      >
        Usar conta pessoal
      </button>

      {personalOpen ? (
        <form
          action="/api/instagram/personal-profile"
          method="post"
          className="rounded-2xl border border-blue-200 bg-white p-4 text-left shadow-sm"
        >
          <label htmlFor="personal-instagram-username" className="text-sm font-black text-slate-950">
            Usuário da conta pessoal
          </label>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Não é necessário transformar a conta em profissional. O FollowClean usa o nome apenas para separar o histórico deste perfil neste dispositivo; a análise continua baseada na exportação oficial do Instagram.
          </p>
          <div className="mt-3 flex gap-2">
            <div className="flex min-h-11 flex-1 items-center rounded-xl border border-slate-200 bg-slate-50 px-3">
              <span className="text-slate-400">@</span>
              <input
                id="personal-instagram-username"
                name="username"
                type="text"
                required
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                pattern="[A-Za-z0-9._]{1,30}"
                placeholder="seuusuario"
                className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm font-semibold text-slate-900 outline-none"
              />
            </div>
            <button
              type="submit"
              className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-black text-white"
            >
              Usar
            </button>
          </div>
          <p className="mt-3 text-[11px] leading-5 text-amber-700">
            Modo pessoal: sem API profissional da Meta e sem sincronização em nuvem. Importação, comparação, lista protegida e scanner continuam locais.
          </p>
        </form>
      ) : null}
    </div>
  );
}
