import Link from "next/link";
import { ArrowLeft, LayoutDashboard, LockKeyhole, UsersRound } from "lucide-react";
import { ImportAnalyzer } from "@/components/import-analyzer";

export default function ImportarPage() {
  return (
    <main className="min-h-screen pb-16">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm">
            <UsersRound size={21} />
          </div>
          <div>
            <p className="text-lg font-black tracking-tight">FollowClean</p>
            <p className="text-xs text-slate-500">Importação local</p>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard"
            className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold shadow-sm sm:inline-flex"
          >
            <LayoutDashboard size={16} /> Dashboard
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold shadow-sm"
          >
            <ArrowLeft size={16} /> Início
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 pt-8">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-blue-600">MVP local-first</p>
            <h1 className="mt-2 text-4xl font-black tracking-[-0.035em] text-slate-950">
              Analisar seguidores × seguindo
            </h1>
            <p className="mt-3 max-w-2xl leading-7 text-slate-600">
              Cada importação agora vira um snapshot salvo no navegador. Depois, o dashboard compara as mudanças entre as análises.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-600 shadow-sm">
            <LockKeyhole size={16} className="text-emerald-600" /> O arquivo não sai deste dispositivo
          </div>
        </div>

        <ImportAnalyzer />
      </section>
    </main>
  );
}
