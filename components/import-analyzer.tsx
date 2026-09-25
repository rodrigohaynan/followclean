"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  FileArchive,
  LoaderCircle,
  Search,
  ShieldCheck,
  UploadCloud,
  UsersRound,
} from "lucide-react";
import { analyzeInstagramExport } from "@/lib/instagram/parser";
import type { InstagramAnalysis } from "@/lib/instagram/types";
import { exportBelongsToAccount, saveAnalysis } from "@/lib/storage/indexeddb";
import { useAccountStorage } from "@/lib/storage/account-client";

export function ImportAnalyzer() {
  const { account, error: accountError } = useAccountStorage();
  const [analysis, setAnalysis] = useState<InstagramAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const filtered = useMemo(() => {
    if (!analysis) return [];
    const normalized = query.trim().toLowerCase().replace(/^@/, "");
    if (!normalized) return analysis.notFollowingBack;
    return analysis.notFollowingBack.filter((username) => username.includes(normalized));
  }, [analysis, query]);

  async function handleFile(file: File | undefined) {
    if (!file || !account) return;
    if (!exportBelongsToAccount(file.name, account.username)) {
      setError(`O arquivo ${file.name} não identifica a conta @${account.username}. Selecione a exportação desta conta, com seu nome no arquivo original.`);
      return;
    }
    setError(null);
    setAnalysis(null);
    setSaved(false);
    setLoading(true);
    setFileName(file.name);

    try {
      const result = await analyzeInstagramExport(file);
      setAnalysis(result);
      await saveAnalysis(result, file.name);
      setSaved(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível analisar o arquivo enviado.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (accountError) return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">{accountError} <Link href="/conectar" className="font-bold underline">Conectar Instagram</Link></div>;
  if (!account) return <div className="rounded-2xl border border-slate-200 p-5">Verificando a conta conectada...</div>;
  return (
    <div className="space-y-3 sm:space-y-6">
      <p className="text-sm font-bold text-blue-800">Importação exclusiva de @{account.username}</p>
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:rounded-[2rem] sm:p-6 md:p-8">
        <div className="flex flex-col gap-4 sm:gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
              <ShieldCheck size={15} /> Processamento e histórico locais
            </div>
            <h2 className="text-xl font-black tracking-tight text-slate-950 sm:text-2xl">Importe o arquivo do Instagram</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">
              O ZIP é processado no seu navegador. O resultado fica salvo neste dispositivo para comparações futuras.
            </p>
          </div>

          <label className="group flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-center sm:min-h-32 sm:px-8 sm:py-5 transition hover:border-blue-400 hover:bg-blue-50/50 md:min-w-80">
            <input
              type="file"
              accept=".zip,application/zip"
              className="sr-only"
              onChange={(event) => handleFile(event.target.files?.[0])}
            />
            {loading ? <LoaderCircle className="animate-spin text-blue-600" size={28} /> : <UploadCloud className="text-blue-600" size={28} />}
            <span className="mt-3 text-sm font-bold text-slate-900">{loading ? "Analisando..." : "Selecionar arquivo ZIP"}</span>
            <span className="mt-1 max-w-56 truncate text-xs text-slate-500">{fileName ?? "Exportação oficial em JSON"}</span>
          </label>
        </div>

        {error ? (
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <AlertCircle className="mt-0.5 shrink-0" size={18} />
            <span>{error}</span>
          </div>
        ) : null}

        {saved ? (
          <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 sm:flex-row sm:items-center sm:justify-between">
            <span className="font-semibold">Análise salva neste dispositivo com sucesso.</span>
            <Link href="/dashboard" className="font-black text-emerald-800 underline underline-offset-4">Abrir dashboard</Link>
          </div>
        ) : null}
      </section>

      {analysis ? (
        <>
          <section className="grid grid-cols-2 gap-2 sm:gap-4 xl:grid-cols-4">
            {[
              ["Seguidores", analysis.totals.followers, "Total encontrado"],
              ["Seguindo", analysis.totals.following, "Contas seguidas"],
              ["Recíprocos", analysis.totals.mutual, "Seguem de volta"],
              ["Não seguem você", analysis.totals.notFollowingBack, "Candidatos à revisão"],
            ].map(([label, value, detail]) => (
              <div key={String(label)} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5">
                <p className="text-xs font-semibold text-slate-500 sm:text-sm">{label}</p>
                <p className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:mt-2 sm:text-3xl">{Number(value).toLocaleString("pt-BR")}</p>
                <p className="mt-1 text-xs text-slate-400">{detail}</p>
              </div>
            ))}
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:rounded-[2rem]">
            <div className="flex flex-col gap-4 border-b border-slate-200 p-3 sm:p-6 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-red-50 p-2.5 text-red-600"><UsersRound size={20} /></div>
                <div>
                  <h3 className="font-black text-slate-950">Não seguem você de volta</h3>
                  <p className="text-sm text-slate-500">Nenhuma ação é executada automaticamente no Instagram.</p>
                </div>
              </div>
              <div className="relative w-full md:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar @usuario"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white"
                />
              </div>
            </div>

            <div className="max-h-[32rem] divide-y divide-slate-100 overflow-auto">
              {filtered.slice(0, 500).map((username) => (
                <div key={username} className="flex items-center justify-between gap-2 px-3 py-3 sm:gap-4 sm:px-6 sm:py-4">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-slate-900">@{username}</p>
                    <p className="mt-0.5 text-xs text-slate-500">Não encontrado na lista de seguidores</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700"><Check size={13} /> revisar</div>
                </div>
              ))}
            </div>

            {filtered.length > 500 ? (
              <div className="border-t border-slate-200 bg-slate-50 px-6 py-3 text-center text-xs text-slate-500">
                Exibindo os primeiros 500 resultados de {filtered.length.toLocaleString("pt-BR")}.
              </div>
            ) : null}
          </section>
        </>
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm sm:rounded-[2rem] sm:p-8">
          <FileArchive className="mx-auto text-slate-300" size={36} />
          <p className="mt-4 font-bold text-slate-700">Nenhuma análise carregada</p>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
            Quando o arquivo for importado, os totais e a lista de contas que não seguem você de volta aparecerão aqui.
          </p>
        </section>
      )}
    </div>
  );
}
