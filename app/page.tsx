import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  FileArchive,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";

const highlights = [
  "Compara seguidores e contas seguidas",
  "Mostra quem não segue você de volta",
  "Processa o arquivo no próprio navegador",
  "Prepara regras e fila de limpeza assistida",
];

export default function Home() {
  return (
    <main className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm">
            <UsersRound size={21} />
          </div>
          <div>
            <p className="text-lg font-black tracking-tight">FollowClean</p>
            <p className="text-xs text-slate-500">Instagram relationship analyzer</p>
          </div>
        </div>
        <Link
          href="/importar"
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold shadow-sm transition hover:border-slate-300"
        >
          Testar importação
        </Link>
      </header>

      <section className="mx-auto grid max-w-6xl gap-10 px-6 pb-16 pt-14 lg:grid-cols-[1.1fr_.9fr] lg:items-center lg:pt-24">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700">
            <Sparkles size={16} /> MVP em construção
          </div>
          <h1 className="max-w-3xl text-5xl font-black leading-[1.03] tracking-[-0.045em] text-slate-950 md:text-6xl">
            Descubra quem faz sentido continuar seguindo.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            Importe os dados oficiais da sua conta do Instagram. O FollowClean
            compara as listas, identifica relações não recíprocas e prepara uma
            análise para você revisar com segurança.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/importar"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-bold text-white shadow-lg shadow-blue-600/15 transition hover:bg-blue-700"
            >
              Analisar meu arquivo <ArrowRight size={18} />
            </Link>
            <span className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-600">
              <ShieldCheck size={18} className="text-emerald-600" /> Sem pedir sua senha
            </span>
          </div>

          <div className="mt-10 grid gap-3 sm:grid-cols-2">
            {highlights.map((item) => (
              <div key={item} className="flex items-start gap-2.5 text-sm text-slate-600">
                <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600" />
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/80 bg-white p-5 shadow-2xl shadow-slate-900/10">
          <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-900">Resumo da análise</p>
                <p className="mt-1 text-xs text-slate-500">Exemplo de resultado</p>
              </div>
              <div className="rounded-xl bg-white p-2.5 text-blue-600 shadow-sm">
                <FileArchive size={20} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                ["Seguidores", "4.826"],
                ["Seguindo", "5.932"],
                ["Recíprocos", "3.814"],
                ["Não seguem", "2.118"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-medium text-slate-500">{label}</p>
                  <p className="mt-1 text-2xl font-black tracking-tight text-slate-950">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-3 rounded-2xl bg-slate-950 p-4 text-white">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-slate-400">Próxima etapa</p>
                  <p className="mt-1 font-bold">Regras inteligentes de limpeza</p>
                </div>
                <ArrowRight size={18} className="text-slate-400" />
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
