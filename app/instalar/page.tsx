import { Download, ExternalLink, ShieldCheck, Smartphone } from "lucide-react";
import { SiteHeader } from "@/components/site-header";

const REPO_URL = "https://github.com/rodrigohaynan/followclean";
// Publicado automaticamente pelo workflow "Build FollowClean Android APK" a cada
// atualização do app na branch main (release "android-latest").
const APK_DOWNLOAD_URL = `${REPO_URL}/releases/latest/download/FollowClean.apk`;
const RELEASES_URL = `${REPO_URL}/releases/latest`;

export default function InstalarPage() {
  return (
    <main>
      <SiteHeader subtitle="App Android" />
      <div className="mx-auto max-w-2xl px-4 pt-6 sm:px-6 sm:pt-10">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:rounded-[2rem] sm:p-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-sm shadow-blue-600/30">
            <Smartphone size={28} />
          </div>
          <p className="mt-5 text-sm font-black uppercase tracking-[0.15em] text-blue-700">
            FollowClean para Android
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
            Instale o aplicativo
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">
            O app facilita a revisão de perfis e permite usar o scanner diretamente no celular. O APK é gerado e assinado automaticamente a partir do repositório oficial do FollowClean.
          </p>

          <a
            href={APK_DOWNLOAD_URL}
            className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 font-black text-white shadow-sm"
          >
            <Download size={19} /> Baixar FollowClean.apk
          </a>
          <a
            href={RELEASES_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex w-full items-center justify-center gap-1.5 text-sm font-bold text-slate-500 hover:text-slate-800"
          >
            Ver detalhes da versão <ExternalLink size={14} />
          </a>

          <div className="mt-6 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
            <p className="font-black text-slate-950">Como instalar</p>
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>Toque em <strong>Baixar FollowClean.apk</strong> e aguarde o download.</li>
              <li>Abra o arquivo baixado. Se o Android pedir, permita a instalação para o navegador usado.</li>
              <li>Para atualizar, baixe a versão nova e instale por cima: seus dados no app são mantidos.</li>
            </ol>
            <p className="text-xs text-slate-500">
              Antes de desinstalar o app, salve um backup em arquivo na página Limpeza.
            </p>
          </div>

          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
            <ShieldCheck className="mt-0.5 shrink-0" size={19} />
            <p>
              O APK é distribuído fora da Play Store, então o Android pode exibir avisos de aplicativo pouco conhecido. Baixe somente por este botão ou pelo repositório oficial e não desative proteções do aparelho.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
