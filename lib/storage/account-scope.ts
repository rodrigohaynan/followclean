"use client";

import { useEffect, useState } from "react";
import {
  migrateLegacyDataForActiveAccount,
  setStorageAccount,
} from "@/lib/storage/indexeddb";

export type ActiveInstagramAccount = {
  id: string;
  username: string;
  mode: "official" | "personal";
  cloudEnabled: boolean;
};

export function useActiveInstagramAccount() {
  const [account, setAccount] = useState<ActiveInstagramAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [migration, setMigration] = useState<
    "existing" | "empty" | "migrated" | "partial" | "not_owned" | ""
  >("");

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch("/api/instagram/account", {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error("Selecione ou conecte uma conta do Instagram para acessar os dados.");
        }

        const data = await response.json();
        const id = String(data?.account?.id ?? "");
        const username = String(data?.account?.username ?? "")
          .trim()
          .toLowerCase()
          .replace(/^@/, "");
        const mode = data?.mode === "personal" ? "personal" : "official";
        const cloudEnabled = Boolean(data?.cloudEnabled && mode === "official");

        if (
          !/^[a-zA-Z0-9_-]{1,100}$/.test(id) ||
          !/^[a-z0-9._]{1,30}$/.test(username)
        ) {
          throw new Error("Não foi possível identificar a conta selecionada.");
        }

        setStorageAccount(id, username);
        const migrationResult = await migrateLegacyDataForActiveAccount();
        if (cancelled) return;

        setMigration(migrationResult);
        setAccount({ id, username, mode, cloudEnabled });
      } catch (reason) {
        if (!cancelled) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Não foi possível verificar a conta selecionada.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { account, loading, error, migration };
}
