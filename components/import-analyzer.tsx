"use client";

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

export function ImportAnalyzer() {
  const [analysis, setAnalysis] = useState<InstagramAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!analysis) return [];
    const normalized = query.trim().toLowerCase().replace(/^@/, "");
    if (!normalized) return analysis.notFollowingBack;
    return analysis.notFollowingBack.filter((username) =>
      username.includes(normalized),
    );
  }, [analysis, query]);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setAnalysis(null);
    setLoading(true);
    setFileName(file.name);

    try {
      const result = await analyzeInstagramExport(file);
      setAnalysis(result);
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

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
              <ShieldCheck size={15} /> Processamento local
            </div>
            <h2 className="text-2xl font-black tracking-tight text-slate-950">
              Importe o arquivo do Instagram
            </h2>
            <p className="mt-2 leading-7 text-slate-600">
              Nesta etapa, o ZIP é processado no seu navegador para localizar as
              listas de seguidores e de contas que você segue.
            </p>
          </div>

          <label className="group flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-8 py-5 text-center transition hover:border-blue-400 hover:bg-blue-50/50 md:min-w-80">
            <input
              type="file"
              accept=".zip,application/zip"
              className="sr-only"
              onChange={(event) => handleFile(event.target.files?.[0])}
            />
            {loading ? (
              <LoaderCircle className="animate-spin text-blue-600" size={28} />
            ) : (
              <UploadCloud className="text-blue-600" size={28} />
            )}
            <span className="mt-3 text-sm font-bold text-slate-900">
              {loading ? "Analisando..." : "Selecionar arquivo ZIP"}
            </span>
            <span className="mt-1 max-w-56 truncate text-xs text-slate-500">
              {fileName ?? "Exportação oficial em JSON"}
            </span>
          </label>
        </div>

        {error ? (
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <AlertCircle className="mt-0.5 shrink-0" size={18} />
            <span>{error}</span>
          </div>
        ) : null}
      </section>

      {analysis ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Seguidores", analysis.totals.followers, "Total encontrado"],
              ["Seguindo", analysis.totals.following, "Contas seguidas"],
              ["Recíprocos", analysis.totals.mutual, "Seguem de volta"],
              [
                "Não seguem você",
                analysis.totals.notFollowingBack,
                "Candidatos à revisão",
              ],
            ].map(([label, value, detail]) => (
              <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm font-semibold text-slate-500">{label}</p>
                <p className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                  {Number(value).toLocaleString("pt-BR")}
                </p>
                <p className="mt-1 text-xs text-slate-400">{detail}</p>
              </div>
            ))}
          </section>

          <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-slate-200 p-6 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-red-50 p-2.5 text-red-600">
                  <UsersRound size={20} />
                </div>
                <div>
                  <h3 className="font-black text-slate-950">Não seguem você de volta</h3>
                  <p className="text-sm text-slate-500">
                    A lista ainda não executa nenhuma ação no Instagram.
                  </p>
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
                <div key={username} className="flex items-center justify-between gap-4 px-6 py-4">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-slate-900">@{username}</p>
                    <p className="mt-0.5 text-xs text-slate-500">Não encontrado na lista de seguidores</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
                    <Check size={13} /> revisar
                  </div>
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
        <section className="rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-sm">
          <FileArchive className="mx-auto text-slate-300" size={36} />
          <p className="mt-4 font-bold text-slate-700">Nenhuma análise carregada</p>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
            Quando o arquivo for importado, os totais e a lista de contas que não
            seguem você de volta aparecerão aqui.
          </p>
        </section>
      )}
    </div>
  );
}
