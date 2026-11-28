import Link from "next/link";
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  FileArchive,
  HardDrive,
  LockKeyhole,
  Puzzle,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  UploadCloud,
  UserMinus,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";

const highlights = [
  "Compara seguidores e contas seguidas",
  "Prioriza quem não segue você e tem poucos seguidores",
  "Processa o arquivo no próprio navegador",
  "Lista protegida para família, amigos e clientes",
];

const steps = [
  {
    icon: Camera,
    title: "Escolha a conta",
    text: "Conta profissional pelo login oficial da Meta ou conta pessoal em modo local, informando só o @.",
  },
  {
    icon: UploadCloud,
    title: "Importe o ZIP",
    text: "Baixe “Seguidores e seguindo” no Instagram e envie o arquivo. Nada é enviado para servidores.",
  },
  {
    icon: SlidersHorizontal,
    title: "Revise a fila",
    text: "Defina o limite de seguidores, proteja quem importa e decida conta por conta. O unfollow é sempre seu.",
  },
];

const tools = [
  {
    href: "/extensao",
    icon: Puzzle,
    title: "Extensão para Chrome",
    text: "Lê a contagem de seguidores dos perfis da fila enquanto você navega.",
  },
  {
    href: "/instalar",
    icon: Smartphone,
    title: "App Android",
    text: "Scanner no próprio celular, com backup do progresso em arquivo.",
  },
  {
    href: "/dashboard",
    icon: HardDrive,
    title: "Histórico local",
    text: "Compare importações e veja quem começou ou deixou de seguir você.",
  },
];

export default function Home() {
  return (
    <main>
      <SiteHeader />

      <section className="mx-auto grid max-w-6xl gap-8 px-4 pb-10 pt-8 sm:gap-10 sm:px-6 sm:pb-16 sm:pt-14 lg:grid-cols-[1.1fr_.9fr] lg:items-center lg:pt-20">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 sm:mb-5 sm:text-sm">
            <LockKeyhole size={15} /> Seus dados ficam no seu dispositivo
          </div>
          <h1 className="max-w-3xl text-[clamp(1.9rem,7.5vw,3rem)] font-black leading-[1.06] tracking-[-0.04em] text-slate-950 sm:text-5xl md:text-6xl">
            Descubra quem não segue você de volta — e{" "}
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">limpe com critério</span>.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:mt-6 sm:text-lg sm:leading-8">
            Importe os dados oficiais da sua conta e use regras como “não segue de volta + até 2.000 seguidores”. O FollowClean separa prioridade, revisão e perfis protegidos.
          </p>

          <div className="mt-6 flex flex-col gap-2 sm:mt-8 sm:flex-row sm:flex-wrap sm:gap-3">
            <Link href="/importar" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700">
              Analisar meu arquivo <ArrowRight size={18} />
            </Link>
            <Link href="/conectar" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl fc-dark-action bg-slate-950 px-5 py-3 font-bold text-white">
              <Camera size={18} /> Conectar Instagram
            </Link>
          </div>
          <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-500">
            <ShieldCheck size={16} className="text-emerald-600" /> Nunca pedimos sua senha do Instagram.
          </p>

          <div className="mt-7 grid gap-2.5 sm:mt-10 sm:grid-cols-2 sm:gap-3">
            {highlights.map((item) => (
              <div key={item} className="flex items-start gap-2.5 text-sm text-slate-600">
                <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600" />
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/80 bg-white p-3 shadow-xl shadow-slate-900/10 sm:rounded-[2rem] sm:p-5 sm:shadow-2xl">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:rounded-[1.5rem] sm:p-5">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-900">Fila de limpeza</p>
                <p className="mt-1 text-xs text-slate-500">Exemplo de classificação</p>
              </div>
              <div className="rounded-xl bg-white p-2.5 text-blue-600 shadow-sm"><FileArchive size={20} /></div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-red-200 bg-white p-4">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wide text-red-600">Prioridade</p>
                  <p className="mt-1 truncate font-black text-slate-950">@perfil · 837 seguidores</p>
                  <p className="mt-1 text-xs text-slate-500">Não segue você de volta</p>
                </div>
                <UserMinus size={20} className="shrink-0 text-red-500" />
              </div>
              <div className="rounded-2xl border border-amber-200 bg-white p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-amber-600">Revisar</p>
                <p className="mt-1 truncate font-black text-slate-950">@perfil2 · contagem pendente</p>
                <p className="mt-1 text-xs text-slate-500">Aguardando a leitura da contagem</p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-white p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-600">Protegido</p>
                <p className="mt-1 truncate font-black text-slate-950">@cliente.vip</p>
                <p className="mt-1 text-xs text-slate-500">Nunca entra na fila</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600 sm:text-sm">Como funciona</p>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Três passos, sem complicação</h2>
        <ol className="mt-6 grid gap-3 sm:gap-4 md:grid-cols-3">
          {steps.map(({ icon: Icon, title, text }, index) => (
            <li key={title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Icon size={20} /></span>
                <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Passo {index + 1}</span>
              </div>
              <h3 className="mt-4 font-black text-slate-950">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto mt-10 max-w-6xl px-4 sm:mt-14 sm:px-6">
        <div className="grid gap-3 sm:gap-4 md:grid-cols-3">
          {tools.map(({ href, icon: Icon, title, text }) => (
            <Link key={href} href={href} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md">
              <Icon size={22} className="text-blue-600" />
              <h3 className="mt-3 flex items-center gap-1.5 font-black text-slate-950">
                {title} <ArrowRight size={16} className="text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-blue-600" />
              </h3>
              <p className="mt-1.5 text-sm leading-6 text-slate-500">{text}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
