"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarClock,
  Database,
  FileArchive,
  History,
  Plus,
  Trash2,
  TrendingDown,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import {
  deleteAnalysis,
  getAnalyses,
  type StoredAnalysis,
} from "@/lib/storage/indexeddb";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function Dashboard() {
  const [history, setHistory] = useState<StoredAnalysis[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAnalyses()
      .then(setHistory)
      .finally(() => setLoading(false));
  }, []);

  const latest = history[0];
  const previous = history[1];

  const comparison = useMemo(() => {
    if (!latest || !previous) return null;

    const latestFollowers = new Set(latest.analysis.followers);
    const previousFollowers = new Set(previous.analysis.followers);

    const gained = latest.analysis.followers.filter(
      (username) => !previousFollowers.has(username),
    );
    const lost = previous.analysis.followers.filter(
      (username) => !latestFollowers.has(username),
    );

    return { gained, lost };
  }, [latest, previous]);

  async function removeSnapshot(id: string) {
    await deleteAnalysis(id);
    setHistory((current) => current.filter((item) => item.id !== id));
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-sm sm:rounded-[2rem] sm:p-8">
        Carregando histórico local...
      </div>
    );
  }

  if (!latest) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm sm:rounded-[2rem] sm:p-10">
        <Database className="mx-auto text-slate-300" size={42} />
        <h2 className="mt-4 text-xl font-black text-slate-950">Nenhuma análise salva ainda</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
          Importe o arquivo oficial do Instagram. O resultado será salvo somente neste dispositivo.
        </p>
        <Link
          href="/importar"
          className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-bold text-white"
        >
          Fazer primeira análise <ArrowRight size={17} />
        </Link>
      </div>
    );
  }

  const cards = [
    ["Seguidores", latest.analysis.totals.followers, "Total atual"],
    ["Seguindo", latest.analysis.totals.following, "Contas seguidas"],
    ["Recíprocos", latest.analysis.totals.mutual, "Seguem de volta"],
    ["Não seguem você", latest.analysis.totals.notFollowingBack, "Para revisar"],
  ];

  return (
    <div className="space-y-3 sm:space-y-6">
      <section className="flex min-w-0 flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:gap-4 sm:rounded-[2rem] sm:p-6 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-blue-600">
            <CalendarClock size={15} /> Último snapshot
          </div>
          <h2 className="mt-2 text-lg font-black tracking-tight text-slate-950 sm:text-2xl">
            {formatDate(latest.createdAt)}
          </h2>
          <p className="mt-1 truncate text-xs text-slate-500 sm:text-sm" title={latest.sourceFile}>Arquivo: {latest.sourceFile}</p>
        </div>
        <Link
          href="/importar"
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white sm:w-auto sm:text-base"
        >
          <Plus size={18} /> Nova importação
        </Link>
      </section>

      <section className="grid grid-cols-2 gap-2 sm:gap-4 xl:grid-cols-4">
        {cards.map(([label, value, detail]) => (
          <div key={String(label)} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5">
            <p className="text-xs font-semibold leading-5 text-slate-500 sm:text-sm">{label}</p>
            <p className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:mt-2 sm:text-3xl">
              {Number(value).toLocaleString("pt-BR")}
            </p>
            <p className="mt-1 text-[11px] leading-4 text-slate-400 sm:text-xs">{detail}</p>
          </div>
        ))}
      </section>

      {comparison ? (
        <section className="grid gap-3 sm:gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 sm:rounded-[2rem] sm:p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-white p-2.5 text-emerald-600 shadow-sm">
                <TrendingUp size={21} />
              </div>
              <div>
                <p className="text-sm font-bold text-emerald-800">Novos seguidores</p>
                <p className="text-3xl font-black text-emerald-950">+{comparison.gained.length.toLocaleString("pt-BR")}</p>
              </div>
            </div>
            <div className="mt-4 max-h-40 overflow-auto rounded-xl bg-white/80 p-3 text-sm text-slate-700">
              {comparison.gained.length ? comparison.gained.slice(0, 100).map((name) => <p key={name}>@{name}</p>) : <p>Nenhum novo seguidor entre os dois snapshots.</p>}
            </div>
          </div>

          <div className="rounded-2xl border border-red-200 bg-red-50/70 p-4 sm:rounded-[2rem] sm:p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-white p-2.5 text-red-600 shadow-sm">
                <TrendingDown size={21} />
              </div>
              <div>
                <p className="text-sm font-bold text-red-800">Deixaram de seguir</p>
                <p className="text-3xl font-black text-red-950">-{comparison.lost.length.toLocaleString("pt-BR")}</p>
              </div>
            </div>
            <div className="mt-4 max-h-40 overflow-auto rounded-xl bg-white/80 p-3 text-sm text-slate-700">
              {comparison.lost.length ? comparison.lost.slice(0, 100).map((name) => <p key={name}>@{name}</p>) : <p>Ninguém deixou de seguir entre os dois snapshots.</p>}
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-900 sm:rounded-[2rem] sm:p-6">
          Faça uma segunda importação futuramente para o FollowClean comparar os snapshots e mostrar quem começou ou deixou de seguir você.
        </section>
      )}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:rounded-[2rem]">
        <div className="flex items-center gap-3 border-b border-slate-200 p-4 sm:p-6">
          <div className="rounded-xl bg-slate-100 p-2.5 text-slate-700"><History size={20} /></div>
          <div>
            <h3 className="font-black text-slate-950">Histórico de importações</h3>
            <p className="text-sm text-slate-500">Salvo neste dispositivo.</p>
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {history.map((item, index) => (
            <div key={item.id} className="flex items-center justify-between gap-2 px-3 py-3 sm:gap-4 sm:px-6 sm:py-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="rounded-xl bg-slate-50 p-2 text-slate-500"><FileArchive size={18} /></div>
                <div className="min-w-0">
                  <p className="truncate font-bold text-slate-900">{index === 0 ? "Atual · " : ""}{formatDate(item.createdAt)}</p>
                  <p className="truncate text-xs text-slate-500">{item.analysis.totals.followers.toLocaleString("pt-BR")} seguidores · {item.sourceFile}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeSnapshot(item.id)}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                aria-label="Excluir snapshot"
              >
                <Trash2 size={17} />
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-slate-950 p-4 text-white sm:rounded-[2rem] sm:p-6">
        <div className="flex items-center gap-3">
          <UsersRound className="text-blue-400" size={21} />
          <div>
            <p className="font-black">Próxima evolução</p>
            <p className="mt-1 text-sm text-slate-400">Lista protegida, regras de limpeza e fila assistida de revisão.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
