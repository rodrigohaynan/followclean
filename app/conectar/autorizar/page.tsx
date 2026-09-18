import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowLeft, Camera, ExternalLink, ShieldCheck } from "lucide-react";

const OAUTH_STATE_COOKIE = "followclean_ig_oauth_state";

function buildAuthUrl(appId: string, redirectUri: string, state: string) {
  const authUrl = new URL("https://www.instagram.com/oauth/authorize");
  authUrl.searchParams.set("client_id", appId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "instagram_business_basic");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("force_reauth", "true");
  authUrl.searchParams.set("force_authentication", "1");
  authUrl.searchParams.set("enable_fb_login", "0");
  return authUrl.toString();
}

export default async function AutorizarInstagramPage() {
  const cookieStore = await cookies();
  const state = (cookieStore.get(OAUTH_STATE_COOKIE)?.value ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .at(-1);
  const appId = process.env.INSTAGRAM_APP_ID;
  const redirectUri =
    process.env.INSTAGRAM_REDIRECT_URI ??
    "https://followclean.netlify.app/api/instagram/callback";

  if (!state || !appId) {
    return (
      <main className="min-h-screen px-6 py-16">
        <section className="mx-auto max-w-xl rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-black text-slate-950">Sessão de conexão expirada</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Volte e inicie a conexão novamente para gerar uma autorização segura.
          </p>
          <Link href="/conectar" className="mt-6 inline-flex rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white">
            Voltar para conectar
          </Link>
        </section>
      </main>
    );
  }

  const authUrl = buildAuthUrl(appId, redirectUri, state);
  const chromeIntent = `${authUrl.replace(/^https:\/\//, "intent://")}#Intent;scheme=https;package=com.android.chrome;end`;

  return (
    <main className="min-h-screen px-6 py-12">
      <section className="mx-auto max-w-xl rounded-[2rem] border border-slate-200 bg-white p-7 shadow-sm md:p-9">
        <Link href="/conectar" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500">
          <ArrowLeft size={16} /> Voltar
        </Link>

        <div className="mt-7 flex h-14 w-14 items-center justify-center rounded-2xl bg-pink-50 text-pink-600">
          <Camera size={27} />
        </div>
        <h1 className="mt-5 text-3xl font-black tracking-tight text-slate-950">
          Autorizar no navegador
        </h1>
        <p className="mt-4 leading-7 text-slate-600">
          No Android, o aplicativo do Instagram pode interceptar o link e impedir que a autorização volte ao FollowClean. Use o botão abaixo para manter o processo no Chrome.
        </p>

        <a
          href={chromeIntent}
          className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3.5 font-black text-white"
        >
          <ExternalLink size={19} /> Continuar no Chrome
        </a>

        <a
          href={authUrl}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3.5 font-black text-slate-700"
        >
          <ExternalLink size={18} /> Abrir autorização nesta aba
        </a>

        <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-950">
          <div className="flex items-center gap-2 font-black">
            <ShieldCheck size={17} /> Conexão segura
          </div>
          <p className="mt-2">
            A senha é informada diretamente ao Instagram. O FollowClean recebe apenas a autorização concedida pela Meta.
          </p>
        </div>

        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          <strong>Se o Instagram ainda abrir:</strong> no Android, vá em Configurações → Apps → Instagram → Abrir por padrão e desative “Abrir links compatíveis”. Depois volte a esta tela e tente novamente.
        </div>
      </section>
    </main>
  );
}
