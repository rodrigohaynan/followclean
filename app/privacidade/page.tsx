import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Política de privacidade",
  description: "Como o FollowClean trata os dados da sua conta do Instagram.",
  alternates: { canonical: "/privacidade" },
};

const UPDATED_AT = "28 de novembro de 2026";
const CONTACT_URL = "https://github.com/rodrigohaynan/followclean/issues";

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
      "O arquivo ZIP é aberto e processado no próprio navegador; o arquivo em si nunca é enviado para servidores. O resultado (listas de seguidores e seguindo), o histórico de importações, os perfis protegidos, as regras e as contagens de seguidores ficam no armazenamento local do navegador (IndexedDB) ou na memória do app Android, separados por conta.",
      "Você pode apagar esses dados excluindo importações no Painel ou limpando os dados do site ou do app no seu dispositivo.",
    ],
  },
  {
    title: "Login com o Instagram (contas profissionais)",
    body: [
      "Ao conectar uma conta profissional, a autenticação acontece diretamente na Meta e o FollowClean nunca recebe sua senha. Recebemos um token de acesso com a permissão básica do perfil e lemos o ID da conta, o nome de usuário, o tipo de conta, a foto de perfil e os totais de seguidores e seguindo.",
      "O token fica criptografado em um cookie do seu navegador por até 60 dias e não é gravado em banco de dados. Você pode encerrar a conexão a qualquer momento em Conta → Trocar conta.",
    ],
  },
  {
    title: "Conta pessoal (modo local)",
    body: [
      "No modo de conta pessoal, você informa apenas o @. Ele fica em um cookie assinado por até 1 ano e serve só para separar os dados locais de cada perfil. Nada é consultado na Meta e a nuvem não é usada nesse modo.",
    ],
  },
  {
    title: "Checkpoint em nuvem (contas profissionais)",
    body: [
      "Para que outro computador ou celular continue a verificação de onde você parou, as contas profissionais conectadas sincronizam com um banco de dados: as listas de seguidores e seguindo da análise mais recente, o nome do arquivo importado, a fila de verificação com as contagens e falhas, os perfis protegidos, as regras e um identificador aleatório de cada dispositivo com a data do último acesso.",
      "Esses dados ficam associados ao ID da sua conta, são usados apenas para o funcionamento do FollowClean e não são vendidos nem compartilhados com terceiros para outros fins. Eles são mantidos enquanto a conta usar o serviço e apagados quando você solicita a exclusão (veja abaixo).",
    ],
  },
  {
    title: "Extensão e app Android",
    body: [
      "A extensão FollowClean Assist e o app Android abrem, um por vez, os perfis públicos da sua fila para ler a contagem de seguidores exibida, usando a sessão do Instagram já aberta no seu navegador ou no app. Se o Instagram pedir login, checkpoint ou verificação, a execução é pausada. Nada é feito para contornar limites ou proteções da plataforma.",
    ],
  },
  {
    title: "Serviços utilizados",
    body: [
      "Netlify (hospedagem do site), Neon (banco de dados do checkpoint em nuvem) e Meta/Instagram (login de contas profissionais). Esses serviços processam dados apenas para operar o FollowClean e podem estar localizados fora do Brasil.",
    ],
  },
  {
    title: "Seus direitos e exclusão dos dados",
    body: [
      "Conforme a LGPD, você pode pedir acesso, correção ou exclusão dos seus dados. Ao remover o FollowClean das permissões do Instagram ou solicitar a exclusão pela Meta, os dados em nuvem da conta são apagados automaticamente. Os dados locais podem ser apagados por você a qualquer momento no próprio dispositivo.",
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
          Resumo: o arquivo do Instagram é processado no seu dispositivo, o FollowClean não pede sua senha e não vende informações. Contas profissionais que usam a sincronização em nuvem têm a análise guardada em servidor para continuar em outro aparelho.
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

        <section className="mt-3 rounded-2xl border border-blue-200 bg-blue-50 p-5 sm:mt-4 sm:p-6">
          <h2 className="font-black text-blue-950">Contato</h2>
          <p className="mt-2 text-sm leading-6 text-blue-950">
            Dúvidas ou pedidos sobre seus dados podem ser enviados pela{" "}
            <a href={CONTACT_URL} target="_blank" rel="noreferrer" className="font-bold underline underline-offset-4">página de suporte do projeto</a>.
            Veja também a página de{" "}
            <Link href="/exclusao-dados" className="font-bold underline underline-offset-4">exclusão de dados</Link>.
          </p>
        </section>

        <p className="mt-6 text-xs text-slate-400">Última atualização: {UPDATED_AT}.</p>
      </article>
    </main>
  );
}
