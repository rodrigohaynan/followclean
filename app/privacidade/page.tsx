import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Política de privacidade",
  description: "Como o FollowClean trata os dados da sua conta do Instagram.",
  alternates: { canonical: "/privacidade" },
};

const sections = [
  {
    title: "O que o FollowClean faz",
    body: [
      "O FollowClean compara as listas de seguidores e de contas seguidas a partir da exportação oficial que você baixa do Instagram, aplica as regras que você define e monta uma fila de revisão. Nenhum unfollow é feito automaticamente: a decisão é sempre sua.",
    ],
  },
  {
    title: "Dados que ficam no seu dispositivo",
    body: [
      "O arquivo ZIP é processado no próprio navegador e não é enviado para servidores. Análises, histórico, perfis protegidos, regras e contagens de seguidores ficam salvos no armazenamento local do navegador (IndexedDB) ou na memória do app Android, separados por conta.",
      "Você pode apagar esses dados excluindo importações no Painel ou limpando os dados do site/app no seu dispositivo.",
    ],
  },
  {
    title: "Login com o Instagram (contas profissionais)",
    body: [
      "Ao conectar uma conta profissional, a autenticação acontece diretamente na Meta. O FollowClean nunca recebe sua senha. Recebemos apenas um token de acesso com a permissão básica do perfil (nome de usuário, tipo de conta e totais públicos), guardado de forma criptografada em um cookie do seu navegador.",
      "No modo de conta pessoal, você informa apenas o @, usado para separar os dados locais de cada perfil. Nenhum dado é consultado na Meta.",
    ],
  },
  {
    title: "Checkpoint em nuvem (opcional)",
    body: [
      "Quando disponível para contas profissionais, o checkpoint em nuvem guarda a fila de verificação, os resultados das contagens, os perfis protegidos e as regras, para que outro dispositivo continue de onde você parou. Esses dados são associados ao ID da sua conta e não são vendidos nem compartilhados.",
    ],
  },
  {
    title: "Extensão e app Android",
    body: [
      "A extensão FollowClean Assist e o app Android abrem perfis públicos da sua fila para ler a contagem de seguidores exibida. Se o Instagram pedir login, checkpoint ou verificação, a execução é pausada. Nada é feito para contornar limites ou proteções da plataforma.",
    ],
  },
  {
    title: "Exclusão dos dados",
    body: [
      "Ao remover o FollowClean das permissões do Instagram ou solicitar a exclusão pela Meta, os dados em nuvem da conta são apagados automaticamente. Os dados locais podem ser apagados por você a qualquer momento no próprio dispositivo.",
    ],
  },
];

export default function PrivacidadePage() {
  return (
    <main>
      <SiteHeader subtitle="Privacidade" />
      <article className="mx-auto max-w-3xl px-4 pt-6 sm:px-6 sm:pt-10">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600 sm:text-sm">Privacidade</p>
        <h1 className="mt-2 text-[clamp(1.6rem,6vw,2.25rem)] font-black leading-tight tracking-[-0.035em] text-slate-950">
          Política de privacidade
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">
          Resumo: seus dados do Instagram são processados no seu dispositivo. O FollowClean não pede sua senha e não vende informações.
        </p>

        <div className="mt-6 space-y-3 sm:space-y-4">
          {sections.map((section) => (
            <section key={section.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="font-black text-slate-950">{section.title}</h2>
              {section.body.map((paragraph) => (
                <p key={paragraph} className="mt-2 text-sm leading-6 text-slate-600">{paragraph}</p>
              ))}
            </section>
          ))}
        </div>

        <p className="mt-6 text-sm text-slate-500">
          Veja também: <Link href="/exclusao-dados" className="font-bold text-blue-700 underline underline-offset-4">Exclusão de dados</Link>.
        </p>
      </article>
    </main>
  );
}
