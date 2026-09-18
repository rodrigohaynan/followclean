"use client";

import { useEffect } from "react";

export function AndroidOAuthReturn({ handoff }: { handoff: string }) {
  const deepLink = `followclean://oauth/complete?handoff=${encodeURIComponent(handoff)}`;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.location.href = deepLink;
    }, 250);

    return () => window.clearTimeout(timer);
  }, [deepLink]);

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
          A autorização foi concluída. O Android deve abrir o aplicativo
          automaticamente para finalizar a conexão.
        </p>
        <a
          href={deepLink}
          className="mt-7 inline-flex w-full items-center justify-center rounded-xl bg-slate-950 px-5 py-3.5 text-sm font-black text-white"
        >
          Abrir FollowClean
        </a>
        <p className="mt-4 text-xs leading-5 text-slate-500">
          Se aparecer uma confirmação do Android, escolha abrir no FollowClean.
        </p>
      </section>
    </main>
  );
}
