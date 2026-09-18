import { AndroidOAuthReturn } from "@/components/android-oauth-return";

export default async function AndroidRetornoPage({
  searchParams,
}: {
  searchParams: Promise<{ handoff?: string }>;
}) {
  const params = await searchParams;
  const handoff = params.handoff ?? "";

  if (!handoff) {
    return (
      <main className="min-h-screen px-6 py-16">
        <section className="mx-auto max-w-xl rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-black text-slate-950">
            Retorno do Android inválido
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Volte ao FollowClean e inicie a conexão novamente.
          </p>
        </section>
      </main>
    );
  }

  return <AndroidOAuthReturn handoff={handoff} />;
}
