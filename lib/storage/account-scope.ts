"use client";

import { useEffect, useState } from "react";
import {
  migrateLegacyDataForActiveAccount,
  setStorageAccount,
} from "@/lib/storage/indexeddb";

export type ActiveInstagramAccount = {
  id: string;
  username: string;
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
        const response = await fetch("/api/cleanup/cloud/token", {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error("Conecte o Instagram para acessar os dados desta conta.");
        }

        const data = await response.json();
        const id = String(data?.account?.id ?? "");
        const username = String(data?.account?.username ?? "")
          .trim()
          .toLowerCase()
          .replace(/^@/, "");

        if (
          !/^[a-zA-Z0-9_-]{1,100}$/.test(id) ||
          !/^[a-z0-9._]{1,30}$/.test(username)
        ) {
          throw new Error("Não foi possível identificar a conta conectada.");
        }

        setStorageAccount(id, username);
        const migrationResult = await migrateLegacyDataForActiveAccount();
        if (cancelled) return;

        setMigration(migrationResult);
        setAccount({ id, username });
      } catch (reason) {
        if (!cancelled) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Não foi possível verificar a conta conectada.",
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
