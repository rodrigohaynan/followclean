import Link from "next/link";

const links = [
  { href: "/privacidade", label: "Privacidade" },
  { href: "/exclusao-dados", label: "Exclusão de dados" },
  { href: "/extensao", label: "Extensão para Chrome" },
  { href: "/instalar", label: "App Android" },
];

export function SiteFooter() {
  return (
    <footer className="mt-12 border-t border-slate-200 sm:mt-20">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 text-sm text-slate-500 sm:px-6 md:flex-row md:items-center md:justify-between">
        <p>
          <span className="font-black text-slate-700">FollowClean</span> · seus dados ficam no seu dispositivo.
          <span className="block text-xs text-slate-400 sm:inline sm:pl-1">Não é afiliado ao Instagram ou à Meta.</span>
        </p>
        <nav aria-label="Links do rodapé" className="flex flex-wrap gap-x-5 gap-y-2">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="font-semibold hover:text-slate-900">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
