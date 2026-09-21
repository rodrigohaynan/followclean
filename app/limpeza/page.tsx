import Link from "next/link";
import { ArrowLeft, HardDrive, LayoutDashboard, UsersRound } from "lucide-react";
import { CleanupManager } from "@/components/cleanup-manager";

export default function LimpezaPage() {
  return (
    <main className="min-h-screen pb-8 sm:pb-16">
      <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:flex-nowrap sm:px-6 sm:py-6">
        <Link href="/" className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm sm:h-10 sm:w-10 sm:rounded-2xl"><UsersRound size={21} /></div>
          <div className="min-w-0">
            <p className="text-base font-black tracking-tight sm:text-lg">FollowClean</p>
            <p className="text-[11px] text-slate-500 sm:text-xs">Fila inteligente</p>
          </div>
        </Link>
        <Link href="/dashboard" aria-label="Voltar ao painel" title="Voltar ao painel" className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold shadow-sm sm:px-4">
          <LayoutDashboard size={17} className="sm:hidden" /><ArrowLeft size={16} className="hidden sm:block" /><span className="hidden sm:inline">Dashboard</span>
        </Link>
      </header>

      <section className="mx-auto max-w-6xl px-4 pt-4 sm:px-6 sm:pt-8">
        <div className="mb-4 flex flex-col gap-3 sm:mb-8 sm:gap-4 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-600 sm:text-sm sm:tracking-[0.16em]">Limpeza inteligente</p>
            <h1 className="mt-1.5 text-[clamp(1.5rem,6vw,2.25rem)] font-black leading-tight tracking-[-0.035em] text-slate-950 sm:mt-2 sm:text-4xl">Regras, protegidos e fila de revisão</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:mt-3 sm:text-base sm:leading-7">Aplique as regras e revise cada conta antes de decidir. Os perfis protegidos ficam fora da fila.</p>
          </div>
          <div className="inline-flex w-fit max-w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm sm:px-4 sm:py-3">
            <HardDrive size={16} className="shrink-0 text-emerald-600" /> Regras salvas neste dispositivo
          </div>
        </div>
        <CleanupManager />
      </section>
    </main>
  );
}
