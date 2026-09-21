import Link from "next/link";
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  FileArchive,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";

const highlights = [
  "Compara seguidores e contas seguidas",
  "Prioriza quem não segue você e tem poucos seguidores",
  "Processa o arquivo no próprio navegador",
  "Prepara conexão oficial Meta e fila assistida",
];

export default function Home() {
  return (
    <main className="min-h-screen">
      <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:flex-nowrap sm:px-6 sm:py-6">
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <div className="flex h-9 w-9 shrink-0 sm:h-10 sm:w-10 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm"><UsersRound size={21} /></div>
          <div><p className="text-base font-black tracking-tight sm:text-lg">FollowClean</p><p className="text-[11px] text-slate-500 sm:text-xs">Análise do Instagram</p></div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/conectar" className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold shadow-sm transition hover:border-slate-300 sm:inline-flex"><Camera size={16} /> Conectar</Link>
          <Link href="/importar" className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold shadow-sm transition hover:border-slate-300 sm:px-4">Importar</Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-6 px-4 pb-8 pt-4 sm:gap-10 sm:px-6 sm:pb-16 sm:pt-14 lg:grid-cols-[1.1fr_.9fr] lg:items-center lg:pt-24">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full sm:mb-5 border border-blue-100 bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700"><Sparkles size={16} /> MVP local-first</div>
          <h1 className="max-w-3xl text-[clamp(1.7rem,7vw,3rem)] font-black leading-[1.08] tracking-[-0.04em] text-slate-950 sm:text-5xl md:text-6xl">Limpe quem não segue você com critérios inteligentes.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:mt-6 sm:text-lg sm:leading-8">Importe os dados oficiais da sua conta e use regras como “não segue de volta + até 2.000 seguidores”. O FollowClean separa prioridade, revisão e perfis protegidos.</p>

          <div className="mt-5 flex flex-wrap gap-2 sm:mt-8 sm:gap-3">
            <Link href="/importar" className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-bold text-white shadow-lg shadow-blue-600/15 transition hover:bg-blue-700">Analisar meu arquivo <ArrowRight size={18} /></Link>
            <Link href="/conectar" className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 font-bold text-white"><Camera size={18} /> Conectar Instagram</Link>
            <span className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-600"><ShieldCheck size={18} className="text-emerald-600" /> Sem pedir sua senha</span>
          </div>

          <div className="mt-6 grid gap-2 sm:mt-10 sm:gap-3 sm:grid-cols-2">
            {highlights.map((item) => <div key={item} className="flex items-start gap-2.5 text-sm text-slate-600"><CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600" />{item}</div>)}
          </div>
        </div>

        <div className="rounded-2xl border border-white/80 bg-white p-3 shadow-xl sm:rounded-[2rem] sm:p-5 sm:shadow-2xl shadow-slate-900/10">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:rounded-[1.5rem] sm:p-5">
            <div className="mb-5 flex items-center justify-between"><div><p className="text-sm font-bold text-slate-900">Regra principal</p><p className="mt-1 text-xs text-slate-500">Exemplo de classificação</p></div><div className="rounded-xl bg-white p-2.5 text-blue-600 shadow-sm"><FileArchive size={20} /></div></div>
            <div className="space-y-3">
              <div className="rounded-2xl border border-red-200 bg-white p-4"><p className="text-xs font-bold uppercase tracking-wide text-red-600">Prioridade</p><p className="mt-1 font-black text-slate-950">@perfil · 837 seguidores</p><p className="mt-1 text-xs text-slate-500">Não segue você de volta</p></div>
              <div className="rounded-2xl border border-amber-200 bg-white p-4"><p className="text-xs font-bold uppercase tracking-wide text-amber-600">Revisar</p><p className="mt-1 font-black text-slate-950">@perfil2 · contagem pendente</p><p className="mt-1 text-xs text-slate-500">Aguardando enriquecimento</p></div>
            </div>
            <div className="mt-3 rounded-2xl bg-slate-950 p-4 text-white"><div className="flex items-center justify-between gap-4"><div><p className="text-xs text-slate-400">Próxima camada</p><p className="mt-1 font-bold">Meta + extensão assistida</p></div><ArrowRight size={18} className="text-slate-400" /></div></div>
          </div>
        </div>
      </section>
    </main>
  );
}
