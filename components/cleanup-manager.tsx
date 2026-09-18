"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Camera as Instagram,
  CheckCircle2,
  ExternalLink,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UserMinus,
  X,
} from "lucide-react";
import {
  buildCleanupQueue,
  DEFAULT_CLEANUP_SETTINGS,
  type CleanupSettings,
  type ProfileMetadata,
} from "@/lib/rules/engine";
import {
  getAnalyses,
  getCleanupSettings,
  getProfileMetadata,
  getProtectedProfiles,
  protectProfile,
  saveCleanupSettings,
  unprotectProfile,
  upsertProfileMetadataBatch,
  type ProtectedProfile,
  type StoredAnalysis,
} from "@/lib/storage/indexeddb";

type Tab = "priority" | "review" | "protected";

function sourceLabel(source: ProfileMetadata["dataSource"]) {
  if (source === "meta_business_discovery") return "Meta";
  if (source === "extension") return "Extensão";
  if (source === "manual") return "Manual";
  return "Pendente";
}

export function CleanupManager() {
  const [latest, setLatest] = useState<StoredAnalysis | null>(null);
  const [protectedProfiles, setProtectedProfiles] = useState<ProtectedProfile[]>([]);
  const [profileMetadata, setProfileMetadata] = useState<ProfileMetadata[]>([]);
  const [settings, setSettings] = useState<CleanupSettings>(DEFAULT_CLEANUP_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [newProtected, setNewProtected] = useState("");
  const [tab, setTab] = useState<Tab>("priority");
  const [extensionReady, setExtensionReady] = useState(false);
  const [extensionNote, setExtensionNote] = useState("Aguardando extensão...");

  useEffect(() => {
    Promise.all([getAnalyses(), getProtectedProfiles(), getCleanupSettings(), getProfileMetadata()])
      .then(([history, protectedList, storedSettings, metadata]) => {
        setLatest(history[0] ?? null);
        setProtectedProfiles(protectedList);
        setSettings(storedSettings);
        setProfileMetadata(metadata);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    function mergeMetadata(records: ProfileMetadata[]) {
      setProfileMetadata((current) => {
        const map = new Map(current.map((item) => [item.username, item] as const));
        for (const item of records) map.set(item.username, item);
        return Array.from(map.values());
      });
    }

    function handleMessage(event: MessageEvent) {
      if (event.source !== window) return;

      const data = event.data as {
        source?: string;
        type?: string;
        total?: number;
        results?: Array<{
          username?: unknown;
          followersCount?: unknown;
          updatedAt?: unknown;
        }>;
      };

      if (data?.source !== "followclean-extension") return;

      if (data.type === "READY") {
        setExtensionReady(true);
        setExtensionNote("Extensão detectada e pronta.");
        window.postMessage(
          { source: "followclean-web", type: "GET_RESULTS" },
          "*",
        );
        return;
      }

      if (data.type === "QUEUE_SAVED") {
        setExtensionNote(
          `Fila enviada para a extensão: ${Number(data.total ?? 0).toLocaleString("pt-BR")} perfis.`,
        );
        return;
      }

      if (data.type === "RESULTS" && Array.isArray(data.results)) {
        const records: ProfileMetadata[] = data.results.flatMap((item) => {
          if (
            typeof item?.username !== "string" ||
            typeof item?.followersCount !== "number"
          ) {
            return [];
          }

          return [{
            username: item.username.trim().toLowerCase().replace(/^@/, ""),
            followersCount: item.followersCount,
            dataSource: "extension" as const,
            updatedAt:
              typeof item.updatedAt === "string"
                ? item.updatedAt
                : new Date().toISOString(),
          }];
        });

        if (!records.length) return;

        void upsertProfileMetadataBatch(records).then(() => {
          mergeMetadata(records);
          setExtensionNote(
            `${records.length.toLocaleString("pt-BR")} contagens sincronizadas da extensão.`,
          );
        });
      }
    }

    window.addEventListener("message", handleMessage);
    window.postMessage({ source: "followclean-web", type: "PING" }, "*");

    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const protectedSet = useMemo(() => new Set(protectedProfiles.map((item) => item.username)), [protectedProfiles]);
  const queue = useMemo(() => latest ? buildCleanupQueue(latest.analysis, protectedSet, settings, profileMetadata) : [], [latest, protectedSet, settings, profileMetadata]);
  const priority = useMemo(() => queue.filter((item) => item.classification === "priority"), [queue]);
  const review = useMemo(() => queue.filter((item) => item.classification === "review"), [queue]);
  const normalizedQuery = query.trim().toLowerCase().replace(/^@/, "");
  const filteredPriority = useMemo(() => normalizedQuery ? priority.filter((item) => item.username.includes(normalizedQuery)) : priority, [priority, normalizedQuery]);
  const filteredReview = useMemo(() => normalizedQuery ? review.filter((item) => item.username.includes(normalizedQuery)) : review, [review, normalizedQuery]);
  const filteredProtected = useMemo(() => normalizedQuery ? protectedProfiles.filter((item) => item.username.includes(normalizedQuery)) : protectedProfiles, [protectedProfiles, normalizedQuery]);

  async function addProtected(username: string) {
    const record = await protectProfile(username);
    setProtectedProfiles((current) => [...current.filter((item) => item.username !== record.username), record].sort((a, b) => a.username.localeCompare(b.username)));
    setNewProtected("");
  }
  async function removeProtected(username: string) { await unprotectProfile(username); setProtectedProfiles((current) => current.filter((item) => item.username !== username)); }
  async function toggleRule() { const next = { ...settings, notFollowingBack: !settings.notFollowingBack }; setSettings(next); await saveCleanupSettings(next); }
  async function updateMaxFollowers(value: number) { const safeValue = Number.isFinite(value) ? Math.max(0, Math.round(value)) : 2000; const next = { ...settings, maxFollowers: safeValue }; setSettings(next); await saveCleanupSettings(next); }

  function sendQueueToExtension() {
    window.postMessage(
      {
        source: "followclean-web",
        type: "SET_QUEUE",
        usernames: review.map((item) => item.username),
      },
      "*",
    );
  }

  function syncExtensionResults() {
    window.postMessage(
      { source: "followclean-web", type: "GET_RESULTS" },
      "*",
    );
  }

  async function saveManualFollowers(username: string) {
    const current = profileMetadata.find((item) => item.username === username);
    const raw = window.prompt(
      `Quantos seguidores @${username} possui?`,
      typeof current?.followersCount === "number"
        ? String(current.followersCount)
        : "",
    );
    if (raw === null) return;

    const digits = raw.replace(/\D/g, "");
    const followersCount = Number(digits);
    if (!digits || !Number.isFinite(followersCount)) return;

    const record: ProfileMetadata = {
      username,
      followersCount,
      dataSource: "manual",
      updatedAt: new Date().toISOString(),
    };

    await upsertProfileMetadataBatch([record]);
    setProfileMetadata((items) => [
      ...items.filter((item) => item.username !== username),
      record,
    ]);
  }

  if (loading) return <div className="rounded-[2rem] border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">Carregando regras locais...</div>;
  if (!latest) return <div className="rounded-[2rem] border border-slate-200 bg-white p-10 text-center shadow-sm"><UserMinus className="mx-auto text-slate-300" size={42} /><h2 className="mt-4 text-xl font-black text-slate-950">Primeiro faça uma importação</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">A fila de limpeza usa o snapshot mais recente salvo neste dispositivo.</p><Link href="/importar" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-bold text-white">Importar dados do Instagram</Link></div>;

  const activeList = tab === "priority" ? filteredPriority : tab === "review" ? filteredReview : [];

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-red-200 bg-red-50/50 p-5 shadow-sm"><p className="text-sm font-semibold text-red-700">Prioridade</p><p className="mt-2 text-3xl font-black text-red-950">{priority.length.toLocaleString("pt-BR")}</p><p className="mt-1 text-xs text-red-600/70">Não segue + até {settings.maxFollowers.toLocaleString("pt-BR")} seguidores</p></div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 shadow-sm"><p className="text-sm font-semibold text-amber-700">Revisar</p><p className="mt-2 text-3xl font-black text-amber-950">{review.length.toLocaleString("pt-BR")}</p><p className="mt-1 text-xs text-amber-700/70">Contagem ainda desconhecida</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-slate-500">Protegidos</p><p className="mt-2 text-3xl font-black text-slate-950">{protectedProfiles.length.toLocaleString("pt-BR")}</p><p className="mt-1 text-xs text-slate-400">Nunca entram na fila</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-slate-500">Não seguem você</p><p className="mt-2 text-3xl font-black text-slate-950">{latest.analysis.totals.notFollowingBack.toLocaleString("pt-BR")}</p><p className="mt-1 text-xs text-slate-400">No snapshot mais recente</p></div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl"><div className="flex items-center gap-2 text-sm font-black text-slate-950"><SlidersHorizontal size={18} className="text-blue-600" /> Regra principal</div><h2 className="mt-2 text-xl font-black text-slate-950">Não segue de volta + poucos seguidores → prioridade</h2><p className="mt-2 text-sm leading-6 text-slate-500">Perfis protegidos são excluídos. Perfis acima do limite também ficam fora da fila prioritária.</p></div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-500">Máximo de seguidores</span><input type="number" min={0} step={100} value={settings.maxFollowers} onChange={(event) => setSettings((current) => ({ ...current, maxFollowers: Number(event.target.value) }))} onBlur={(event) => updateMaxFollowers(Number(event.target.value))} className="w-40 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black outline-none focus:border-blue-400 focus:bg-white" /></label>
            <button type="button" onClick={toggleRule} className={`inline-flex min-w-36 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition ${settings.notFollowingBack ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"}`}><CheckCircle2 size={17} /> {settings.notFollowingBack ? "Ativada" : "Desativada"}</button>
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950 sm:flex-row sm:items-center sm:justify-between"><span>A regra já entende a contagem de seguidores. A conexão oficial da Meta valida sua conta; a extensão assistida enriquece os perfis da fila.</span><Link href="/conectar" className="inline-flex shrink-0 items-center gap-2 font-black text-blue-700"><Instagram size={16} /> Instagram conectado</Link></div>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <div className={`rounded-2xl border p-4 text-sm ${extensionReady ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-slate-200 bg-slate-50 text-slate-700"}`}>
            <div className="font-black">FollowClean Assist · navegador</div>
            <p className="mt-1 leading-6">{extensionNote}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" disabled={!extensionReady || review.length === 0} onClick={sendQueueToExtension} className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40">Enviar {review.length.toLocaleString("pt-BR")} pendentes</button>
              <button type="button" disabled={!extensionReady} onClick={syncExtensionResults} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-700 disabled:cursor-not-allowed disabled:opacity-40">Sincronizar resultados</button>
              <Link href="/extensao" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-black text-slate-700">Instalar extensão</Link>
            </div>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            <div className="font-black">Modo celular</div>
            <p className="mt-1 leading-6">No Android Chrome, extensões não são suportadas. Abra o perfil e use “Informar seguidores” na fila para classificar o perfil imediatamente.</p>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><div className="flex items-center gap-2 font-black text-slate-950"><ShieldCheck size={19} className="text-emerald-600" /> Lista protegida</div><p className="mt-1 text-sm text-slate-500">Adicione família, amigos, clientes, parceiros ou qualquer conta estratégica.</p></div><form className="flex w-full gap-2 lg:max-w-md" onSubmit={(event) => { event.preventDefault(); if (newProtected.trim()) addProtected(newProtected); }}><input value={newProtected} onChange={(event) => setNewProtected(event.target.value)} placeholder="@usuario" className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:bg-white" /><button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white"><Plus size={16} /> Proteger</button></form></div></section>

      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-6 lg:flex-row lg:items-center lg:justify-between"><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setTab("priority")} className={`rounded-xl px-4 py-2 text-sm font-bold ${tab === "priority" ? "bg-red-600 text-white" : "bg-slate-100 text-slate-600"}`}>Prioridade ({priority.length.toLocaleString("pt-BR")})</button><button type="button" onClick={() => setTab("review")} className={`rounded-xl px-4 py-2 text-sm font-bold ${tab === "review" ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-600"}`}>Revisar ({review.length.toLocaleString("pt-BR")})</button><button type="button" onClick={() => setTab("protected")} className={`rounded-xl px-4 py-2 text-sm font-bold ${tab === "protected" ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600"}`}>Protegidos ({protectedProfiles.length.toLocaleString("pt-BR")})</button></div><div className="relative w-full lg:w-72"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar @usuario" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:bg-white" /></div></div>
        {tab === "protected" ? <div className="max-h-[38rem] divide-y divide-slate-100 overflow-auto">{filteredProtected.map((item) => <div key={item.username} className="flex items-center justify-between gap-4 px-6 py-4"><div className="min-w-0"><p className="truncate font-black text-slate-900">@{item.username}</p><p className="mt-1 text-xs text-slate-500">Protegido neste dispositivo</p></div><button type="button" onClick={() => removeProtected(item.username)} className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700"><X size={14} /> Remover proteção</button></div>)}{!filteredProtected.length ? <div className="p-8 text-center text-sm text-slate-500">Nenhum perfil protegido.</div> : null}</div> : <div className="max-h-[38rem] divide-y divide-slate-100 overflow-auto">{activeList.slice(0, 1000).map((item) => <div key={item.username} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate font-black text-slate-900">@{item.username}</p>{typeof item.followersCount === "number" ? <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-black text-red-700">{item.followersCount.toLocaleString("pt-BR")} seguidores</span> : <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-700">contagem pendente</span>}</div><p className="mt-1 text-xs text-slate-500">{item.reasons.join(" · ")} · Fonte: {sourceLabel(item.dataSource)}</p></div><div className="flex shrink-0 flex-wrap gap-2"><a href={`https://www.instagram.com/${encodeURIComponent(item.username)}/`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600"><ExternalLink size={14} /> Abrir perfil</a>{typeof item.followersCount !== "number" ? <button type="button" onClick={() => saveManualFollowers(item.username)} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">Informar seguidores</button> : null}<button type="button" onClick={() => addProtected(item.username)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700"><ShieldCheck size={14} /> Proteger</button></div></div>)}{!activeList.length ? <div className="p-8 text-center text-sm text-slate-500">{tab === "priority" ? "Nenhum perfil com contagem conhecida está dentro do limite atual." : "Nenhum perfil aguardando enriquecimento."}</div> : null}</div>}
      </section>
    </div>
  );
}
