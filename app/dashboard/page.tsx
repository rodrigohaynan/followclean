import Link from "next/link";
import { ArrowLeft, Camera, HardDrive, ShieldCheck, UsersRound } from "lucide-react";
import { Dashboard } from "@/components/dashboard";

export default function DashboardPage() {
  return (
    <main className="min-h-screen pb-16">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm"><UsersRound size={21} /></div>
          <div><p className="text-lg font-black tracking-tight">FollowClean</p><p className="text-xs text-slate-500">Dashboard local</p></div>
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/conectar" className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold shadow-sm md:inline-flex"><Camera size={16} /> Instagram</Link>
          <Link href="/limpeza" className="hidden items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm sm:inline-flex"><ShieldCheck size={16} /> Limpeza</Link>
          <Link href="/" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold shadow-sm"><ArrowLeft size={16} /> Início</Link>
        </div>
      </header>
      <section className="mx-auto max-w-6xl px-6 pt-8">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div><p className="text-sm font-bold uppercase tracking-[0.16em] text-blue-600">Seu painel</p><h1 className="mt-2 text-4xl font-black tracking-[-0.035em] text-slate-950">Histórico e evolução da conta</h1><p className="mt-3 max-w-2xl leading-7 text-slate-600">Os snapshots ficam neste dispositivo. Com duas importações ou mais, o FollowClean compara automaticamente as mudanças de seguidores.</p></div>
          <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-600 shadow-sm"><HardDrive size={16} className="text-emerald-600" /> Dados salvos localmente</div>
        </div>
        <Dashboard />
      </section>
    </main>
  );
}
