"use client";

import Link from "next/link";
import { useMemo, useState, type DragEvent } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  FileArchive,
  LoaderCircle,
  Search,
  ShieldCheck,
  UploadCloud,
  UsersRound,
} from "lucide-react";
import { analyzeInstagramExport } from "@/lib/instagram/parser";
import type { InstagramAnalysis } from "@/lib/instagram/types";
import {
  saveAnalysis,
  sourceFileBelongsToAccount,
  sourceFileAccount,
} from "@/lib/storage/indexeddb";
import { useActiveInstagramAccount } from "@/lib/storage/account-scope";

const exportSteps = [
  "No Instagram, abra Configurações → Central de Contas → Suas informações e permissões.",
  "Toque em Baixar suas informações → Baixar ou transferir informações → escolha a conta.",
  "Selecione Algumas das suas informações e marque somente Seguidores e seguindo.",
  "Escolha Baixar no dispositivo, período Todo o período e formato JSON (HTML também funciona).",
  "Quando o Instagram avisar que o arquivo está pronto, baixe o ZIP e envie aqui.",
];

/**
 * Garante que o nome salvo identifique a conta (instagram-<usuario>-AAAA-MM-DD…).
 * O restante do app usa esse padrão para não misturar dados entre perfis.
 */
function accountSourceFileName(fileName: string, username: string) {
  if (sourceFileAccount(fileName)) return fileName;
  const date = new Date().toISOString().slice(0, 10);
  return `instagram-${username}-${date}-${fileName}`;
}

function openProfile(username: string) {
  // Dentro do APK, o próprio app abre o perfil (o WebView não abre novas abas).
  const bridge = window.FollowCleanAndroid;
  if (bridge?.postMessage) {
    bridge.postMessage(JSON.stringify({ type: "OPEN_PROFILE", username }));
    return;
  }
  window.open(
    `https://www.instagram.com/${encodeURIComponent(username)}/`,
    "_blank",
    "noopener,noreferrer",
  );
}

export function ImportAnalyzer() {
  const { account, loading: accountLoading, error: accountError } = useActiveInstagramAccount();
  const [analysis, setAnalysis] = useState<InstagramAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [dragging, setDragging] = useState(false);

  const filtered = useMemo(() => {
    if (!analysis) return [];
    const normalized = query.trim().toLowerCase().replace(/^@/, "");
    const list = analysis.notFollowingBack.filter((username) => !username.startsWith("__deleted__"));
    if (!normalized) return list;
    return list.filter((username) => username.includes(normalized));
  }, [analysis, query]);

  async function handleFile(file: File | undefined) {
    if (!file || !account || loading) return;
    setError(null);
    setAnalysis(null);
    setSaved(false);
    setLoading(true);
    setFileName(file.name);

    const namedAccount = sourceFileAccount(file.name);
    if (namedAccount && !sourceFileBelongsToAccount(file.name, account.username)) {
      setLoading(false);
      setError(
        `Esse arquivo pertence a @${namedAccount}. A conta conectada é @${account.username}. Troque a conta ou selecione a exportação correta.`,
      );
      return;
    }

    try {
      const { analysis: result, owner } = await analyzeInstagramExport(file);
      if (owner && owner !== account.username) {
        setError(
          `Esse arquivo pertence a @${owner}. A conta conectada é @${account.username}. Troque a conta ou selecione a exportação correta.`,
        );
        return;
      }
      setAnalysis(result);
      await saveAnalysis(result, accountSourceFileName(file.name, account.username));
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

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    void handleFile(event.dataTransfer.files?.[0]);
  }

  if (accountError) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
        {accountError} <Link href="/conectar" className="font-black underline">Conectar Instagram</Link>
      </div>
    );
  }

  if (accountLoading || !account) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
        <LoaderCircle className="animate-spin text-blue-600" size={18} /> Verificando a conta conectada...
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-6">
      <p className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700 sm:text-sm">
        <UsersRound size={14} /> Importação para @{account.username}
      </p>
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:rounded-[2rem] sm:p-6 md:p-8">
        <div className="flex flex-col gap-4 sm:gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
              <ShieldCheck size={15} /> Processamento e histórico locais
            </div>
            <h2 className="text-xl font-black tracking-tight text-slate-950 sm:text-2xl">Importe o arquivo do Instagram</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">
              O ZIP é processado no seu navegador e o resultado fica salvo neste dispositivo para comparações futuras.
            </p>
          </div>

          <label
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`group flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-5 text-center transition sm:px-8 md:min-w-80 ${
              dragging
                ? "border-blue-500 bg-blue-50"
                : "border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/50"
            } ${loading ? "pointer-events-none opacity-70" : ""}`}
          >
            <input
              type="file"
              accept=".zip,application/zip,application/x-zip-compressed"
              className="sr-only"
              disabled={loading}
              onChange={(event) => {
                void handleFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            {loading ? <LoaderCircle className="animate-spin text-blue-600" size={30} /> : <UploadCloud className="text-blue-600 transition group-hover:-translate-y-0.5" size={30} />}
            <span className="mt-3 text-sm font-bold text-slate-900">{loading ? "Analisando..." : "Selecionar ou arrastar o ZIP"}</span>
            <span className="mt-1 max-w-56 truncate text-xs text-slate-500">{fileName ?? "Exportação oficial (JSON ou HTML)"}</span>
          </label>
        </div>

        <details className="group mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-black text-slate-900">
            Como baixar o arquivo do Instagram
            <ChevronDown size={18} className="shrink-0 transition group-open:rotate-180" />
          </summary>
          <ol className="mt-3 space-y-2">
            {exportSteps.map((step, index) => (
              <li key={step} className="flex gap-3 leading-6">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-black text-white">{index + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs leading-5 text-slate-500">O Instagram pode levar de alguns minutos a algumas horas para preparar a exportação.</p>
        </details>

        {error ? (
          <div role="alert" className="mt-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <AlertCircle className="mt-0.5 shrink-0" size={18} />
            <span>{error}</span>
          </div>
        ) : null}

        {saved ? (
          <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-center gap-2 font-semibold"><CheckCircle2 size={18} /> Análise salva neste dispositivo.</span>
            <div className="flex flex-wrap gap-2">
              <Link href="/limpeza" className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 font-black text-white">Montar fila de limpeza <ArrowRight size={16} /></Link>
              <Link href="/dashboard" className="inline-flex items-center rounded-xl border border-emerald-300 bg-white px-4 py-2 font-black text-emerald-800">Ver painel</Link>
            </div>
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
                  aria-label="Buscar usuário"
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
                  <button
                    type="button"
                    onClick={() => openProfile(username)}
                    className="shrink-0 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700 hover:bg-amber-100"
                  >
                    Ver perfil
                  </button>
                </div>
              ))}
              {!filtered.length ? (
                <div className="p-8 text-center text-sm text-slate-500">
                  {query ? "Nenhum usuário encontrado para essa busca." : "Todos que você segue seguem você de volta."}
                </div>
              ) : null}
            </div>

            {filtered.length > 500 ? (
              <div className="border-t border-slate-200 bg-slate-50 px-6 py-3 text-center text-xs text-slate-500">
                Exibindo os primeiros 500 resultados de {filtered.length.toLocaleString("pt-BR")}. Use a busca ou abra a <Link href="/limpeza" className="font-bold text-blue-700 underline">fila de limpeza</Link>.
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
