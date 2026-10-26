import Link from "next/link";
import { ArrowLeft, Download, ShieldCheck, Smartphone } from "lucide-react";

const ANDROID_WORKFLOW_URL =
  "https://github.com/rodrigohaynan/followclean/actions/workflows/android-apk.yml";

export default function InstalarPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-950"
        >
          <ArrowLeft size={16} /> Voltar ao FollowClean
        </Link>

        <section className="mt-5 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white">
            <Smartphone size={28} />
          </div>
          <p className="mt-5 text-sm font-black uppercase tracking-[0.15em] text-blue-700">
            FollowClean para Android
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
            Instale o aplicativo
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">
            O app facilita a revisão de perfis e permite usar o scanner diretamente no celular. A instalação é feita pelo APK oficial gerado no repositório do FollowClean.
          </p>

          <a
            href={ANDROID_WORKFLOW_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 font-black text-white shadow-sm"
          >
            <Download size={19} /> Baixar app Android
          </a>

          <div className="mt-6 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
            <p className="font-black text-slate-950">Como baixar</p>
            <p>1. Abra a execução mais recente concluída com sucesso.</p>
            <p>2. Em <strong>Artifacts</strong>, toque em <strong>FollowClean-Android-release</strong>.</p>
            <p>3. Extraia o ZIP e instale o arquivo <strong>app-release.apk</strong>.</p>
          </div>

          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
            <ShieldCheck className="mt-0.5 shrink-0" size={19} />
            <p>
              O APK é distribuído fora da Play Store. O Android pode exibir avisos de segurança ou de aplicativo pouco conhecido. Não desative proteções do aparelho se não reconhecer a origem do arquivo.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
