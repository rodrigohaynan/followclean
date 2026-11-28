import Link from "next/link";
import {
  Download,
  ArrowRight,
  Monitor,
  Puzzle,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";

export default function ExtensaoPage() {
  return (
    <main>
      <SiteHeader subtitle="FollowClean Assist" />

      <section className="mx-auto max-w-5xl px-4 pt-6 sm:px-6 sm:pt-10">
        <div className="mb-6 sm:mb-8">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600 sm:text-sm">
            Extensão assistida
          </p>
          <h1 className="mt-2 text-[clamp(1.6rem,6vw,2.25rem)] font-black leading-tight tracking-[-0.035em] text-slate-950 sm:text-4xl">
            Enriquecer a fila pelo Instagram
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">
            A extensão trabalha em modo contínuo: abre os perfis pendentes um
            por vez, captura a quantidade de seguidores exibida e salva o
            progresso. Com a nuvem ativada, outro computador pode continuar a
            mesma fila. O unfollow continua sendo uma decisão sua.
          </p>
        </div>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:rounded-[2rem] sm:p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-blue-50 p-3 text-blue-600">
                <Puzzle size={24} />
              </div>
              <div>
                <h2 className="font-black text-slate-950">Chrome / Edge no computador</h2>
                <p className="text-sm text-slate-500">FollowClean Assist v0.4.1</p>
              </div>
            </div>

            <h3 className="mt-5 text-sm font-black text-slate-950">Primeira instalação</h3>
            <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-700">
              <li>Baixe o projeto e extraia o ZIP em uma pasta fixa do computador.</li>
              <li>Abra <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">chrome://extensions</code> e ative o <strong>Modo do desenvolvedor</strong>.</li>
              <li>Clique em <strong>Carregar sem compactação</strong> e escolha a pasta <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">extension</code>.</li>
              <li>Volte à página Limpeza: a extensão aparece como detectada.</li>
            </ol>

            <h3 className="mt-5 text-sm font-black text-slate-950">Atualizar sem perder o progresso</h3>
            <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-700">
              <li><strong>Não remova</strong> a extensão instalada: os resultados capturados ficam nela.</li>
              <li>Copie os arquivos da nova pasta <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">extension</code> sobre a <strong>mesma pasta</strong> usada hoje.</li>
              <li>Em <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">chrome://extensions</code>, clique em <strong>Recarregar</strong> e confira a versão.</li>
              <li>Na Limpeza, clique em <strong>Sincronizar</strong> antes de iniciar a verificação contínua.</li>
            </ol>

            <a
              href="https://github.com/rodrigohaynan/followclean/archive/refs/heads/main.zip"
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex items-center gap-2 rounded-xl fc-dark-action bg-slate-950 px-5 py-3 text-sm font-black text-white"
            >
              <Download size={17} /> Baixar projeto
            </a>
          </div>

          <div className="flex flex-col rounded-2xl border border-blue-200 bg-blue-50 p-5 sm:rounded-[2rem] sm:p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-white p-3 text-blue-700 shadow-sm">
                <Smartphone size={24} />
              </div>
              <div>
                <h2 className="font-black text-blue-950">No celular Android</h2>
                <p className="text-sm text-blue-800">O Chrome móvel não instala extensões</p>
              </div>
            </div>
            <p className="mt-5 text-sm leading-6 text-blue-950">
              Use o <strong>app FollowClean para Android</strong>: ele tem um
              scanner próprio que lê a contagem pública dos perfis da fila e
              salva o progresso no aparelho. Sem o app, você ainda pode abrir o
              perfil e tocar em <strong>Informar seguidores</strong> na fila.
            </p>
            <Link
              href="/instalar"
              className="mt-5 inline-flex w-fit items-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-black text-white"
            >
              <Smartphone size={17} /> Instalar app Android
            </Link>
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 sm:mt-5 sm:rounded-[2rem] sm:p-6">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 shrink-0 text-emerald-700" size={22} />
            <div>
              <h2 className="font-black text-emerald-950">Como a revisão funciona</h2>
              <p className="mt-2 text-sm leading-6 text-emerald-900">
                O FollowClean envia à extensão apenas os usuários que não seguem
                você de volta e ainda estão sem contagem conhecida. Ela abre um
                perfil por vez e registra a contagem visível. Se o Instagram
                pedir login, checkpoint ou verificação, a extensão pausa
                automaticamente — nada é feito para contornar limites da
                plataforma. Para deixar rodando por horas, mantenha o Chrome e
                o computador ligados: a extensão salva checkpoints e retoma
                após reiniciar o navegador.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:mt-5 sm:rounded-[2rem] sm:p-6">
          <div className="flex items-start gap-3">
            <Monitor size={21} className="mt-0.5 shrink-0 text-blue-600" />
            <div>
              <h2 className="font-black text-slate-950">Fluxo da extensão</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Limpeza → Iniciar verificação contínua → a extensão percorre a fila → checkpoints automáticos → sincronização no FollowClean.
              </p>
            </div>
          </div>
          <Link
            href="/limpeza"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white"
          >
            Ir para a fila <ArrowRight size={16} />
          </Link>
        </section>
      </section>
    </main>
  );
}
