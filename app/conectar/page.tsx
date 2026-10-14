import Link from "next/link";
import { cookies } from "next/headers";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  HardDrive,
  LockKeyhole,
  ShieldCheck,
  Unplug,
  UsersRound,
} from "lucide-react";
import { unsealInstagramSession } from "@/lib/instagram/session";
import {
  LOCAL_PROFILE_COOKIE,
  readLocalProfileToken,
} from "@/lib/instagram/local-profile";
import { InstagramConnectButton } from "@/components/instagram-connect-button";

const statusMessages: Record<string, { tone: string; text: string }> = {
  connected: { tone: "border-emerald-200 bg-emerald-50 text-emerald-900", text: "Conta profissional conectada com sucesso pela Meta." },
  personal_connected: { tone: "border-blue-200 bg-blue-50 text-blue-900", text: "Conta pessoal selecionada. O histórico local ficará separado para este perfil." },
  personal_invalid: { tone: "border-red-200 bg-red-50 text-red-900", text: "Nome de usuário inválido. Informe somente o @ do perfil do Instagram." },
  disconnected: { tone: "border-slate-200 bg-slate-50 text-slate-700", text: "Conta desconectada deste dispositivo." },
  setup: { tone: "border-amber-200 bg-amber-50 text-amber-900", text: "A conexão profissional da Meta ainda não está configurada. O modo de conta pessoal continua disponível." },
  state_error: { tone: "border-red-200 bg-red-50 text-red-900", text: "A validação de segurança do login expirou. Tente conectar novamente." },
  error: { tone: "border-red-200 bg-red-50 text-red-900", text: "A Meta não concluiu a conexão. Verifique a configuração do app e tente novamente." },
  token_exchange_error: { tone: "border-red-200 bg-red-50 text-red-900", text: "O Instagram autorizou o login, mas a Meta recusou a troca do código pelo token." },
  invalid_platform_app: { tone: "border-red-200 bg-red-50 text-red-900", text: "A Meta informou “Invalid platform app”. Confira o Instagram App ID configurado." },
  client_credentials_error: { tone: "border-red-200 bg-red-50 text-red-900", text: "A Meta recusou as credenciais do aplicativo." },
  redirect_uri_error: { tone: "border-red-200 bg-red-50 text-red-900", text: "A Meta recusou o Redirect URI configurado." },
  auth_code_error: { tone: "border-red-200 bg-red-50 text-red-900", text: "O código de autorização retornado pelo Instagram foi recusado ou expirou." },
  permission_error: { tone: "border-red-200 bg-red-50 text-red-900", text: "A Meta recusou a permissão solicitada para a conta profissional." },
  profile_error: { tone: "border-red-200 bg-red-50 text-red-900", text: "O token foi obtido, mas a API não conseguiu ler o perfil profissional." },
  session_error: { tone: "border-red-200 bg-red-50 text-red-900", text: "O Instagram conectou, mas o FollowClean não conseguiu salvar a sessão com segurança." },
  internal_error: { tone: "border-red-200 bg-red-50 text-red-900", text: "Ocorreu uma falha interna durante a conexão." },
  android_handoff_error: { tone: "border-red-200 bg-red-50 text-red-900", text: "A autorização foi concluída, mas o retorno para o aplicativo expirou." },
  android_state_error: { tone: "border-red-200 bg-red-50 text-red-900", text: "Não foi possível validar a conexão segura do Android." },
  android_waiting: { tone: "border-blue-200 bg-blue-50 text-blue-900", text: "Aguardando a autorização concluída no navegador." },
};

export default async function ConectarPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const officialSession = await unsealInstagramSession(
    cookieStore.get("followclean_ig_session")?.value,
  );
  const localProfile = readLocalProfileToken(
    cookieStore.get(LOCAL_PROFILE_COOKIE)?.value,
  );
  const configured = Boolean(
    process.env.INSTAGRAM_APP_ID && process.env.INSTAGRAM_APP_SECRET,
  );
  const message = params.status ? statusMessages[params.status] : undefined;

  const active = officialSession?.account
    ? {
        username: officialSession.account.username,
        mode: "official" as const,
        accountType: officialSession.account.accountType,
        followersCount: officialSession.account.followersCount,
        followsCount: officialSession.account.followsCount,
      }
    : localProfile
      ? {
          username: localProfile.username,
          mode: "personal" as const,
          accountType: "Conta pessoal",
          followersCount: undefined,
          followsCount: undefined,
        }
      : null;

  return (
    <main className="min-h-screen pb-8 sm:pb-16">
      <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:flex-nowrap sm:px-6 sm:py-6">
        <Link href="/" className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm sm:h-10 sm:w-10">
            <UsersRound size={21} />
          </div>
          <div>
            <p className="text-base font-black tracking-tight sm:text-lg">FollowClean</p>
            <p className="text-[11px] text-slate-500 sm:text-xs">Contas pessoais e profissionais</p>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          {active ? (
            <Link href="/limpeza" className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-950 px-3 py-2 text-sm font-semibold text-white shadow-sm sm:px-4">
              <ShieldCheck size={16} /> Limpeza
            </Link>
          ) : null}
          <Link href="/dashboard" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold shadow-sm sm:px-4">
            <ArrowLeft size={16} /> Dashboard
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 pt-4 sm:px-6 sm:pt-8">
        <div className="mb-4 sm:mb-8">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-pink-600">Instagram</p>
          <h1 className="mt-1.5 text-[clamp(1.5rem,6vw,2.25rem)] font-black leading-tight tracking-[-0.035em] text-slate-950 sm:mt-2 sm:text-4xl">
            Escolha como usar sua conta
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 sm:mt-3 sm:text-base sm:leading-7">
            Contas profissionais podem usar o login oficial da Meta. Contas pessoais podem usar o modo local com a exportação oficial do Instagram, sem precisar converter o perfil.
          </p>
        </div>

        {message ? (
          <div className={`mb-6 rounded-2xl border p-4 text-sm font-semibold ${message.tone}`}>
            {message.text}
          </div>
        ) : null}

        {active ? (
          <section className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm sm:rounded-[2rem] sm:p-6 md:p-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700">
                  <CheckCircle2 size={15} /> Conta ativa
                </div>
                <h2 className="mt-4 text-2xl font-black text-slate-950">@{active.username}</h2>
                <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-600">
                  <span className="rounded-lg bg-slate-100 px-3 py-1.5 font-semibold">
                    {active.mode === "official" ? active.accountType || "Profissional" : "Pessoal · modo local"}
                  </span>
                  {typeof active.followersCount === "number" ? (
                    <span className="rounded-lg bg-slate-100 px-3 py-1.5 font-semibold">
                      {active.followersCount.toLocaleString("pt-BR")} seguidores
                    </span>
                  ) : null}
                  {typeof active.followsCount === "number" ? (
                    <span className="rounded-lg bg-slate-100 px-3 py-1.5 font-semibold">
                      {active.followsCount.toLocaleString("pt-BR")} seguindo
                    </span>
                  ) : null}
                </div>
                {active.mode === "personal" ? (
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
                    A identidade deste perfil serve para separar histórico, importações, protegidos e contagens neste dispositivo. A API profissional da Meta e a sincronização em nuvem ficam desativadas.
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/limpeza" className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white">
                  <ShieldCheck size={17} /> Ir para Limpeza
                </Link>
                <form action="/api/instagram/disconnect" method="post">
                  <button type="submit" className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-black text-red-700">
                    <Unplug size={17} /> Trocar conta
                  </button>
                </form>
              </div>
            </div>
          </section>
        ) : (
          <section className="grid gap-4 md:grid-cols-[1.25fr_0.75fr]">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:rounded-[2rem] sm:p-6 md:p-8">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 p-3 text-white">
                  <Camera size={25} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-950">Escolher tipo de conta</h2>
                  <p className="text-sm text-slate-500">Profissional via Meta ou pessoal em modo local</p>
                </div>
              </div>
              <div className="mt-5">
                <InstagramConnectButton officialEnabled={configured} />
              </div>
            </div>

            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm sm:rounded-[2rem] sm:p-6">
              <HardDrive className="text-blue-700" size={24} />
              <h3 className="mt-3 font-black text-blue-950">Conta pessoal funciona localmente</h3>
              <p className="mt-2 text-sm leading-6 text-blue-900/80">
                Importe o ZIP oficial do Instagram e use Dashboard, comparação, lista protegida e scanner normalmente. O nome do perfil é usado para não misturar dados entre contas.
              </p>
            </div>
          </section>
        )}

        <section className="mt-3 grid gap-3 sm:mt-6 sm:gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <LockKeyhole className="text-blue-600" size={21} />
            <h3 className="mt-3 font-black text-slate-950">Sem senha no FollowClean</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">No modo profissional a autenticação acontece na Meta. No modo pessoal você informa apenas o @ para separar os dados locais.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <ShieldCheck className="text-emerald-600" size={21} />
            <h3 className="mt-3 font-black text-slate-950">Dados separados por perfil</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">Cada conta usa um armazenamento local próprio, evitando carregar o histórico de outro perfil.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <HardDrive className="text-violet-600" size={21} />
            <h3 className="mt-3 font-black text-slate-950">Exportação continua sendo a base</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">A identificação de seguidores e seguindo continua vindo do arquivo oficial exportado pelo Instagram.</p>
          </div>
        </section>
      </section>
    </main>
  );
}
