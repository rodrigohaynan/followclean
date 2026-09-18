"use client";

import { useEffect } from "react";

export function AndroidOAuthStoredReturn() {
  const deepLink = "followclean://oauth/complete";
  const intentLink =
    "intent://oauth/complete#Intent;scheme=followclean;package=br.com.followclean.app;end";

  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.location.href = deepLink;
    }, 700);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main className="min-h-screen px-6 py-16">
      <section className="mx-auto max-w-xl rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <div className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
          Instagram autorizado
        </div>

        <h1 className="mt-5 text-3xl font-black tracking-tight text-slate-950">
          Autorização concluída
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-600">
          Sua conta já foi autorizada. Volte para o aplicativo FollowClean:
          ele buscará esta autorização no servidor e concluirá o login
          automaticamente.
        </p>

        <a
          href={deepLink}
          className="mt-7 inline-flex w-full items-center justify-center rounded-xl bg-slate-950 px-5 py-3.5 text-sm font-black text-white"
        >
          Abrir FollowClean
        </a>

        <button
          type="button"
          onClick={() => {
            window.location.href = intentLink;
          }}
          className="mt-3 inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-black text-slate-700"
        >
          Tentar abertura alternativa
        </button>

        <p className="mt-5 text-xs leading-5 text-slate-500">
          Se nenhum botão abrir o aplicativo, abra o FollowClean pela tela de
          aplicativos recentes. Não é necessário autorizar o Instagram de novo.
        </p>
      </section>
    </main>
  );
}
