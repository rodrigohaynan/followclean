import Link from "next/link";
import { CheckCircle2, ShieldCheck } from "lucide-react";

export default async function ExclusaoDadosPage({
  searchParams,
}: {
  searchParams: Promise<{ confirmation_code?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="min-h-screen px-6 py-16">
      <section className="mx-auto max-w-2xl rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
          <ShieldCheck size={24} />
        </div>
        <h1 className="mt-5 text-3xl font-black tracking-tight text-slate-950">
          Solicitação de exclusão de dados
        </h1>
        <p className="mt-4 leading-7 text-slate-600">
          O FollowClean funciona atualmente em modo local-first. As análises de seguidores, listas protegidas e regras ficam salvas no próprio navegador do usuário, não em um banco de dados do FollowClean.
        </p>
        <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">
          <div className="flex items-center gap-2 font-black">
            <CheckCircle2 size={17} /> Solicitação processada
          </div>
          {params.confirmation_code ? (
            <p className="mt-2 break-all">
              Código de confirmação: <strong>{params.confirmation_code}</strong>
            </p>
          ) : (
            <p className="mt-2">Nenhum dado remoto está armazenado para esta solicitação.</p>
          )}
        </div>
        <p className="mt-6 text-sm leading-6 text-slate-500">
          Para apagar também os dados locais, use a opção de limpar os dados do FollowClean no dispositivo em que fez as análises.
        </p>
        <Link
          href="/"
          className="mt-7 inline-flex rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white"
        >
          Voltar ao FollowClean
        </Link>
      </section>
    </main>
  );
}
