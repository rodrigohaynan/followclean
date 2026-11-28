"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Camera,
  LayoutDashboard,
  ShieldCheck,
  UploadCloud,
  UsersRound,
} from "lucide-react";

const navItems = [
  { href: "/importar", label: "Importar", icon: UploadCloud },
  { href: "/dashboard", label: "Painel", icon: LayoutDashboard },
  { href: "/limpeza", label: "Limpeza", icon: ShieldCheck },
  { href: "/conectar", label: "Conta", icon: Camera },
] as const;

export function SiteHeader({ subtitle = "Análise do Instagram" }: { subtitle?: string }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-[#f6f8fb]/85 backdrop-blur supports-[backdrop-filter]:bg-[#f6f8fb]/70">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6 sm:py-3.5">
        <Link href="/" className="flex min-w-0 items-center gap-2.5 sm:gap-3" aria-label="FollowClean — início">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-sm shadow-blue-600/30 sm:h-10 sm:w-10 sm:rounded-2xl">
            <UsersRound size={20} />
          </span>
          <span className="min-w-0">
            <span className="block text-base font-black tracking-tight text-slate-950 sm:text-lg">FollowClean</span>
            <span className="hidden truncate text-[11px] text-slate-500 min-[400px]:block sm:text-xs">{subtitle}</span>
          </span>
        </Link>

        <nav aria-label="Navegação principal" className="flex shrink-0 items-center gap-1 sm:gap-1.5">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname?.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                title={label}
                className={`inline-flex h-10 min-w-10 items-center justify-center gap-2 rounded-xl px-2.5 text-sm font-bold transition md:px-3.5 ${
                  active
                    ? "fc-dark-action bg-slate-950 text-white shadow-sm"
                    : "text-slate-600 hover:bg-white hover:text-slate-950 hover:shadow-sm"
                }`}
              >
                <Icon size={17} />
                <span className="hidden md:inline">{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
