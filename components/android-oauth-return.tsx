"use client";

import { useState } from "react";

export function AndroidOAuthReturn({ handoff }: { handoff: string }) {
  const [message, setMessage] = useState(
    "A autorização foi concluída. Toque no botão abaixo para voltar ao aplicativo.",
  );

  const clipboardValue = `FCAUTH:${handoff}`;
  const intentLink =
    "intent://oauth/complete#Intent;scheme=followclean;package=br.com.followclean.app;end";

  async function copyAuthorization() {
    try {
      await navigator.clipboard.writeText(clipboardValue);
      setMessage(
        "Autorização copiada. Agora abra o FollowClean; o aplicativo concluirá o login automaticamente.",
      );
      return true;
    } catch {
      try {
        const textarea = document.createElement("textarea");
        textarea.value = clipboardValue;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const copied = document.execCommand("copy");
        textarea.remove();

        if (copied) {
          setMessage(
            "Autorização copiada. Agora abra o FollowClean; o aplicativo concluirá o login automaticamente.",
          );
          return true;
        }
      } catch {
        // handled below
      }

      setMessage(
        "Não foi possível copiar automaticamente. Toque novamente em Copiar autorização e permita o acesso à área de transferência.",
      );
      return false;
    }
  }

  async function copyAndOpenApp() {
    const copied = await copyAuthorization();
    if (!copied) return;

    window.setTimeout(() => {
      window.location.href = intentLink;
    }, 180);
  }

  return (
    <main className="min-h-screen px-6 py-16">
      <section className="mx-auto max-w-xl rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <div className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
          Instagram autorizado
        </div>

        <h1 className="mt-5 text-3xl font-black tracking-tight text-slate-950">
          Finalizar no FollowClean
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-600">{message}</p>

        <button
          type="button"
          onClick={copyAndOpenApp}
          className="mt-7 inline-flex w-full items-center justify-center rounded-xl bg-slate-950 px-5 py-3.5 text-sm font-black text-white"
        >
          Copiar autorização e abrir FollowClean
        </button>

        <button
          type="button"
          onClick={() => void copyAuthorization()}
          className="mt-3 inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-black text-slate-700"
        >
          Somente copiar autorização
        </button>

        <p className="mt-5 text-xs leading-5 text-slate-500">
          Se o Android não abrir o aplicativo automaticamente, abra o FollowClean
          pela tela de aplicativos recentes. A autorização copiada será detectada
          pelo APK.
        </p>
      </section>
    </main>
  );
}
