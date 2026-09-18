"use client";

import { useEffect, useMemo } from "react";

export function AndroidOAuthReturn({ handoff }: { handoff: string }) {
  const urls = useMemo(() => {
    const encoded = encodeURIComponent(handoff);

    // Usamos um HTTPS App Link como destino do intent. Ele corresponde ao
    // intent-filter do APK e é mais confiável no Chrome Android do que um
    // esquema customizado puro.
    const appLink =
      `https://followclean.netlify.app/app/oauth/complete?handoff=${encoded}`;

    const fallback =
      `https://followclean.netlify.app/conectar/android-retorno?handoff=${encoded}`;

    const intentLink =
      `intent://followclean.netlify.app/app/oauth/complete?handoff=${encoded}` +
      `#Intent;scheme=https;package=br.com.followclean.app;` +
      `S.browser_fallback_url=${encodeURIComponent(fallback)};end`;

    return { appLink, fallback, intentLink };
  }, [handoff]);

  function openApp() {
    window.location.href = urls.intentLink;
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.location.href = urls.intentLink;
    }, 700);

    return () => window.clearTimeout(timer);
  }, [urls.intentLink]);

  return (
    <main className="min-h-screen px-6 py-16">
      <section className="mx-auto max-w-xl rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <div className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
          Instagram autorizado
        </div>

        <h1 className="mt-5 text-3xl font-black tracking-tight text-slate-950">
          Voltar para o FollowClean
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-600">
          A autorização foi concluída. Toque em <strong>Abrir FollowClean</strong>
          para finalizar a conexão dentro do aplicativo.
        </p>

        <button
          type="button"
          onClick={openApp}
          className="mt-7 inline-flex w-full items-center justify-center rounded-xl bg-slate-950 px-5 py-3.5 text-sm font-black text-white"
        >
          Abrir FollowClean
        </button>

        <a
          href={urls.appLink}
          className="mt-3 inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-black text-slate-700"
        >
          Tentar pelo link do aplicativo
        </a>

        <p className="mt-4 text-xs leading-5 text-slate-500">
          Se o Android perguntar onde abrir o link, escolha FollowClean.
        </p>
      </section>
    </main>
  );
}
