import Link from "next/link";
import { cookies } from "next/headers";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  ExternalLink,
  LockKeyhole,
  ShieldCheck,
  Unplug,
  UsersRound,
} from "lucide-react";
import { unsealInstagramSession } from "@/lib/instagram/session";
import { InstagramConnectButton } from "@/components/instagram-connect-button";

const statusMessages: Record<string, { tone: string; text: string }> = {
  connected: { tone: "border-emerald-200 bg-emerald-50 text-emerald-900", text: "Conta do Instagram conectada com sucesso." },
  disconnected: { tone: "border-slate-200 bg-slate-50 text-slate-700", text: "Conta desconectada deste dispositivo." },
  setup: { tone: "border-amber-200 bg-amber-50 text-amber-900", text: "A integração está pronta no código, mas ainda faltam o App ID e o App Secret da Meta." },
  state_error: { tone: "border-red-200 bg-red-50 text-red-900", text: "A validação de segurança do login expirou. Tente conectar novamente." },
  error: { tone: "border-red-200 bg-red-50 text-red-900", text: "A Meta não concluiu a conexão. Verifique a configuração do app e tente novamente." },
  token_exchange_error: { tone: "border-red-200 bg-red-50 text-red-900", text: "O Instagram autorizou o login, mas a Meta recusou a troca do código pelo token. Vamos revisar App ID, App Secret e Redirect URI." },
  invalid_platform_app: { tone: "border-red-200 bg-red-50 text-red-900", text: "A Meta informou “Invalid platform app”. O FollowClean provavelmente está usando o App ID geral do Facebook/Meta em vez do Instagram App ID da seção API setup with Instagram login." },
  client_credentials_error: { tone: "border-red-200 bg-red-50 text-red-900", text: "A Meta recusou as credenciais do aplicativo. Precisamos conferir o Instagram App ID e principalmente o Instagram App Secret da seção API setup with Instagram login." },
  redirect_uri_error: { tone: "border-red-200 bg-red-50 text-red-900", text: "A Meta recusou o Redirect URI. Ele precisa ser exatamente https://followclean.netlify.app/api/instagram/callback também na configuração Instagram Business Login." },
  auth_code_error: { tone: "border-red-200 bg-red-50 text-red-900", text: "O código de autorização retornado pelo Instagram foi recusado ou expirou. Inicie uma conexão nova e conclua sem reutilizar a página anterior." },
  permission_error: { tone: "border-red-200 bg-red-50 text-red-900", text: "A Meta recusou a permissão solicitada. Vamos conferir o tester/role do app e a permissão instagram_business_basic." },
  profile_error: { tone: "border-red-200 bg-red-50 text-red-900", text: "O token foi obtido, mas a API do Instagram recusou a leitura do perfil. Vamos revisar permissões e campos da conta profissional." },
  session_error: { tone: "border-red-200 bg-red-50 text-red-900", text: "O Instagram conectou, mas o FollowClean não conseguiu salvar a sessão com segurança." },
  internal_error: { tone: "border-red-200 bg-red-50 text-red-900", text: "A conexão chegou ao FollowClean, mas ocorreu uma falha interna durante o processamento." },
  android_handoff_error: { tone: "border-red-200 bg-red-50 text-red-900", text: "A autorização do Instagram foi concluída, mas o retorno para o aplicativo expirou. Inicie a conexão novamente pelo APK." },
  android_state_error: { tone: "border-red-200 bg-red-50 text-red-900", text: "Não foi possível validar a conexão segura do Android. Feche o navegador, volte ao APK e tente novamente." },
  android_waiting: { tone: "border-blue-200 bg-blue-50 text-blue-900", text: "Aguardando a autorização concluída no navegador. Se você já tocou em Permitir, volte ao FollowClean novamente em alguns segundos." },
};

export default async function ConectarPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const session = await unsealInstagramSession(cookieStore.get("followclean_ig_session")?.value);
  const configured = Boolean(process.env.INSTAGRAM_APP_ID && process.env.INSTAGRAM_APP_SECRET);
  const message = params.status ? statusMessages[params.status] : undefined;

  return (
    <main className="min-h-screen pb-16">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm"><UsersRound size={21} /></div>
          <div><p className="text-lg font-black tracking-tight">FollowClean</p><p className="text-xs text-slate-500">Conexão oficial Meta</p></div>
        </Link>
        <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold shadow-sm"><ArrowLeft size={16} /> Dashboard</Link>
      </header>

      <section className="mx-auto max-w-5xl px-6 pt-8">
        <div className="mb-8">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-pink-600">Instagram</p>
          <h1 className="mt-2 text-4xl font-black tracking-[-0.035em] text-slate-950">Conectar sua conta com segurança</h1>
          <p className="mt-3 max-w-3xl leading-7 text-slate-600">O FollowClean usa o login oficial da Meta. Sua senha não passa pelo nosso site e o token de acesso fica protegido em um cookie criptografado.</p>
        </div>

        {message ? <div className={`mb-6 rounded-2xl border p-4 text-sm font-semibold ${message.tone}`}>{message.text}</div> : null}

        {session ? (
          <section className="rounded-[2rem] border border-emerald-200 bg-white p-6 shadow-sm md:p-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700"><CheckCircle2 size={15} /> Conectado</div>
                <h2 className="mt-4 text-2xl font-black text-slate-950">@{session.account.username}</h2>
                <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-600">
                  {session.account.accountType ? <span className="rounded-lg bg-slate-100 px-3 py-1.5 font-semibold">{session.account.accountType}</span> : null}
                  {typeof session.account.followersCount === "number" ? <span className="rounded-lg bg-slate-100 px-3 py-1.5 font-semibold">{session.account.followersCount.toLocaleString("pt-BR")} seguidores</span> : null}
                  {typeof session.account.followsCount === "number" ? <span className="rounded-lg bg-slate-100 px-3 py-1.5 font-semibold">{session.account.followsCount.toLocaleString("pt-BR")} seguindo</span> : null}
                </div>
              </div>
              <form action="/api/instagram/disconnect" method="post"><button type="submit" className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-black text-red-700"><Unplug size={17} /> Desconectar</button></form>
            </div>
          </section>
        ) : (
          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="max-w-2xl">
                <div className="flex items-center gap-3"><div className="rounded-2xl bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 p-3 text-white"><Camera size={25} /></div><div><h2 className="text-xl font-black text-slate-950">Instagram Login</h2><p className="text-sm text-slate-500">OAuth oficial da Meta</p></div></div>
                <p className="mt-5 text-sm leading-6 text-slate-600">A API oficial atual aceita contas profissionais do Instagram — Creator ou Business. Contas pessoais precisam ser convertidas para profissional para usar esta integração.</p>
              </div>
              {configured ? <InstagramConnectButton /> : <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-center text-sm font-bold text-amber-800">Aguardando credenciais da Meta</div>}
            </div>
          </section>
        )}

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><LockKeyhole className="text-blue-600" size={21} /><h3 className="mt-3 font-black text-slate-950">Sem senha no FollowClean</h3><p className="mt-2 text-sm leading-6 text-slate-500">A autenticação acontece diretamente no Instagram.</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><ShieldCheck className="text-emerald-600" size={21} /><h3 className="mt-3 font-black text-slate-950">Token protegido</h3><p className="mt-2 text-sm leading-6 text-slate-500">A sessão é criptografada antes de ser armazenada no navegador.</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><ExternalLink className="text-violet-600" size={21} /><h3 className="mt-3 font-black text-slate-950">Próxima integração</h3><p className="mt-2 text-sm leading-6 text-slate-500">Enriquecimento da fila e extensão assistida para revisão no Instagram.</p></div>
        </section>

        {!configured ? <section className="mt-6 rounded-[2rem] border border-blue-100 bg-blue-50 p-6 text-sm leading-6 text-blue-950"><p className="font-black">Configuração necessária na Meta</p><p className="mt-2">Crie um app na Meta for Developers com Instagram API / Instagram Login e cadastre como OAuth Redirect URI:</p><code className="mt-3 block overflow-auto rounded-xl bg-white px-4 py-3 text-xs font-bold text-slate-700">https://followclean.netlify.app/api/instagram/callback</code><p className="mt-3">Depois precisaremos apenas do Instagram App ID e do Instagram App Secret para ativar o botão.</p></section> : null}
      </section>
    </main>
  );
}
