"use client";

import { useEffect, useState } from "react";
import { migrateLegacyForAccount, setStorageAccount } from "@/lib/storage/indexeddb";

export type ActiveInstagramAccount = { id: string; username: string };

export async function fetchActiveAccount(): Promise<ActiveInstagramAccount> {
  const response = await fetch("/api/cleanup/cloud/token", { cache: "no-store" });
  if (!response.ok) throw new Error("Conecte o Instagram para abrir os dados desta conta.");
  const data = await response.json();
  const id = String(data?.account?.id ?? "");
  const username = String(data?.account?.username ?? "").toLowerCase();
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id) || !/^[a-z0-9._]{1,30}$/.test(username)) {
    throw new Error("Não foi possível identificar a conta conectada.");
  }
  return { id, username };
}

export function useAccountStorage() {
  const [account, setAccount] = useState<ActiveInstagramAccount | null>(null);
  const [error, setError] = useState("");
  const [migration, setMigration] = useState("");
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const current = await fetchActiveAccount();
        if (cancelled) return;
        setStorageAccount(current.id, current.username);
        const migrated = await migrateLegacyForAccount();
        if (cancelled) return;
        setMigration(migrated);
        setAccount(current);
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Falha ao verificar sua conta.");
      }
    })();
    return () => { cancelled = true; };
  }, []);
  return { account, error, migration };
}
