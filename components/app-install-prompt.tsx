"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Smartphone, X } from "lucide-react";

const DISMISSED_KEY = "followclean_app_install_prompt_dismissed_at";
const DISMISS_FOR_MS = 7 * 24 * 60 * 60 * 1000;

declare global {
  interface Window {
    FollowCleanAndroid?: {
      postMessage?: (value: string) => void;
    };
  }
}

export function AppInstallPrompt() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const userAgent = navigator.userAgent || "";
    const insideFollowClean =
      /FollowCleanAndroid/i.test(userAgent) ||
      Boolean(window.FollowCleanAndroid?.postMessage);

    if (insideFollowClean) return;

    const dismissedAt = Number(localStorage.getItem(DISMISSED_KEY) || 0);
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_FOR_MS) return;

    const timer = window.setTimeout(() => setVisible(true), 700);
    return () => window.clearTimeout(timer);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-lg sm:bottom-5" role="dialog" aria-label="Instalar aplicativo FollowClean">
      <div className="rounded-2xl border border-blue-200 bg-white p-4 shadow-2xl shadow-slate-950/20 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white">
            <Smartphone size={23} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-black text-slate-950">Use o FollowClean no app</p>
                <p className="mt-1 text-xs leading-5 text-slate-600 sm:text-sm">
                  No Android, o aplicativo oferece uma experiência mais prática para revisar perfis e usar o scanner.
                </p>
              </div>
              <button
                type="button"
                onClick={dismiss}
                className="-mr-1 -mt-1 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Fechar aviso"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link
                href="/instalar"
                onClick={dismiss}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-700 px-3 py-2 text-sm font-black text-white"
              >
                Instalar app
              </Link>
              <button
                type="button"
                onClick={dismiss}
                className="min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700"
              >
                Continuar no site
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
