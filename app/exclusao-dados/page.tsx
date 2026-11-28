import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, HardDrive, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Exclusão de dados",
  description: "Como excluir os dados do FollowClean.",
  alternates: { canonical: "/exclusao-dados" },
};

export default async function ExclusaoDadosPage({
  searchParams,
}: {
  searchParams: Promise<{ confirmation_code?: string }>;
}) {
  const params = await searchParams;
  const code =
    typeof params.confirmation_code === "string" &&
    /^[a-f0-9]{8,64}$/i.test(params.confirmation_code)
      ? params.confirmation_code
      : null;

  return (
    <main>
      <SiteHeader subtitle="Exclusão de dados" />
      <section className="mx-auto max-w-2xl px-4 pt-6 sm:px-6 sm:pt-10">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:rounded-[2rem] sm:p-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
            <ShieldCheck size={24} />
          </div>
          <h1 className="mt-5 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
            Exclusão de dados
          </h1>
          <p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">
            Análises, listas protegidas e regras ficam salvas no navegador ou no app do próprio usuário. O único dado guardado em servidor é o checkpoint em nuvem das contas profissionais (listas da análise, fila de verificação, protegidos e regras).
          </p>

          {code ? (
            <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">
              <div className="flex items-center gap-2 font-black">
                <CheckCircle2 size={17} /> Solicitação processada
              </div>
              <p className="mt-2">Os dados em nuvem associados à conta foram apagados.</p>
              <p className="mt-1 break-all">
                Código de confirmação: <strong>{code}</strong>
              </p>
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950">
              <p className="font-black">Como solicitar</p>
              <p className="mt-1">
                No Instagram, abra Configurações → Apps e sites, remova o FollowClean e escolha excluir os dados. O checkpoint em nuvem da conta é apagado automaticamente.
              </p>
            </div>
          )}

          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
            <HardDrive className="mt-0.5 shrink-0 text-slate-500" size={18} />
            <p>
              Para apagar os dados locais, exclua as importações no Painel ou limpe os dados do site no navegador (ou do app, no Android) do dispositivo em que fez as análises.
            </p>
          </div>

          <div className="mt-7 flex flex-wrap gap-2">
            <Link href="/" className="inline-flex rounded-xl fc-dark-action bg-slate-950 px-5 py-3 text-sm font-black text-white">
              Voltar ao FollowClean
            </Link>
            <Link href="/privacidade" className="inline-flex rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700">
              Política de privacidade
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
