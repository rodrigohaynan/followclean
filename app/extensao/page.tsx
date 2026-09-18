import Link from "next/link";
import {
  ArrowLeft,
  Download,
  ExternalLink,
  Monitor,
  Puzzle,
  ShieldCheck,
  Smartphone,
  UsersRound,
} from "lucide-react";

export default function ExtensaoPage() {
  return (
    <main className="min-h-screen pb-16">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm">
            <UsersRound size={21} />
          </div>
          <div>
            <p className="text-lg font-black tracking-tight">FollowClean</p>
            <p className="text-xs text-slate-500">FollowClean Assist</p>
          </div>
        </Link>
        <Link
          href="/limpeza"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold shadow-sm"
        >
          <ArrowLeft size={16} /> Limpeza
        </Link>
      </header>

      <section className="mx-auto max-w-5xl px-6 pt-8">
        <div className="mb-8">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-blue-600">
            Extensão assistida
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-[-0.035em] text-slate-950">
            Enriquecer a fila pelo Instagram
          </h1>
          <p className="mt-3 max-w-3xl leading-7 text-slate-600">
            A extensão pode trabalhar em modo contínuo: abre os perfis pendentes
            um por vez, captura a quantidade de seguidores exibida e salva o
            progresso. Com a nuvem ativada, outro computador pode continuar a
            mesma fila. O unfollow continua sendo uma decisão sua.
          </p>
        </div>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-blue-50 p-3 text-blue-600">
                <Puzzle size={24} />
              </div>
              <div>
                <h2 className="font-black text-slate-950">Chrome / Edge no computador</h2>
                <p className="text-sm text-slate-500">Primeira versão instalável manualmente</p>
              </div>
            </div>

            <ol className="mt-5 space-y-3 text-sm leading-6 text-slate-700">
              <li><strong>1.</strong> Baixe o projeto e extraia o arquivo ZIP.</li>
              <li><strong>2.</strong> Abra <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">chrome://extensions</code>.</li>
              <li><strong>3.</strong> Ative o <strong>Modo do desenvolvedor</strong>.</li>
              <li><strong>4.</strong> Clique em <strong>Carregar sem compactação</strong> e selecione a pasta <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">extension</code>.</li>
              <li><strong>5.</strong> Volte à página Limpeza e clique em <strong>Iniciar verificação contínua</strong>.</li>
              <li><strong>6.</strong> Para deixar durante a madrugada, mantenha o Chrome e o computador ligados; a extensão salva checkpoints e retoma após reinicialização do Chrome.</li>
            </ol>

            <a
              href="https://github.com/rodrigohaynan/followclean/archive/refs/heads/main.zip"
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white"
            >
              <Download size={17} /> Baixar projeto
            </a>
          </div>

          <div className="rounded-[2rem] border border-amber-200 bg-amber-50 p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-white p-3 text-amber-700 shadow-sm">
                <Smartphone size={24} />
              </div>
              <div>
                <h2 className="font-black text-amber-950">Android</h2>
                <p className="text-sm text-amber-800">Chrome móvel não instala extensões</p>
              </div>
            </div>
            <p className="mt-5 text-sm leading-6 text-amber-950">
              No celular, use o modo assistido já disponível na fila: abra o
              perfil pelo FollowClean, veja a quantidade de seguidores no
              Instagram e toque em <strong>Informar seguidores</strong>. A regra
              de até 2.000 seguidores é aplicada imediatamente.
            </p>
          </div>
        </section>

        <section className="mt-5 rounded-[2rem] border border-emerald-200 bg-emerald-50 p-6">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 shrink-0 text-emerald-700" size={22} />
            <div>
              <h2 className="font-black text-emerald-950">Como a revisão funciona</h2>
              <p className="mt-2 text-sm leading-6 text-emerald-900">
                O FollowClean envia apenas os usuários que não seguem você de
                volta e ainda estão sem contagem conhecida. A extensão abre um
                perfil por vez e registra a contagem visível. A execução não
                para mais em lotes fixos de 50. Se o Instagram solicitar login,
                checkpoint ou verificação, a extensão pausa automaticamente.
                Com o checkpoint em nuvem ativo, a fila e o progresso ficam
                disponíveis para continuação em outro computador.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <Monitor size={21} className="text-blue-600" />
            <div>
              <h2 className="font-black text-slate-950">Fluxo da extensão</h2>
              <p className="mt-1 text-sm text-slate-500">
                Limpeza → Iniciar verificação contínua → a extensão percorre a fila → checkpoints automáticos → sincronização no FollowClean.
              </p>
            </div>
          </div>
          <Link
            href="/limpeza"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white"
          >
            Ir para a fila <ExternalLink size={16} />
          </Link>
        </section>
      </section>
    </main>
  );
}
