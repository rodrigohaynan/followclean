"use client";

import { useEffect, useMemo } from "react";

export function AndroidOAuthReturn({ handoff }: { handoff: string }) {
  const urls = useMemo(() => {
    const encoded = encodeURIComponent(handoff);
    const deepLink = `followclean://oauth/complete?handoff=${encoded}`;
    const intentLink =
      `intent://oauth/complete?handoff=${encoded}` +
      `#Intent;scheme=followclean;package=br.com.followclean.app;end`;

    return { deepLink, intentLink };
  }, [handoff]);

  function openApp() {
    // No Chrome Android, intent:// com package explícito é mais confiável
    // que um esquema customizado puro para abrir um APK instalado.
    window.location.href = urls.intentLink;
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        window.location.href = urls.intentLink;
      } catch {
        // O botão abaixo continua disponível para uma tentativa com gesto do usuário.
      }
    }, 500);

    return () => window.clearTimeout(timer);
  }, [urls.intentLink]);

  return (
    <main className="min-h-screen px-6 py-16">
      <section className="mx-auto max-w-xl rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <div className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
          Instagram autorizado
        </div>

        <h1 className="mt-5 text-3xl font-black tracking-tight text-slate-950">
          Voltando ao FollowClean
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-600">
          A autorização foi concluída. Toque no botão abaixo para retornar ao
          aplicativo e finalizar a conexão.
        </p>

        <button
          type="button"
          onClick={openApp}
          className="mt-7 inline-flex w-full items-center justify-center rounded-xl bg-slate-950 px-5 py-3.5 text-sm font-black text-white"
        >
          Abrir FollowClean
        </button>

        <a
          href={urls.deepLink}
          className="mt-3 inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-black text-slate-700"
        >
          Tentar abertura alternativa
        </a>

        <p className="mt-4 text-xs leading-5 text-slate-500">
          Se o Android perguntar qual aplicativo usar, escolha FollowClean.
        </p>
      </section>
    </main>
  );
}
