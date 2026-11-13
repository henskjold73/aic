import { useCallback, useEffect, useState } from "react";
import { ApiRequestError, fetchSyncPing, fetchUsage } from "@/lib/api";
import { getSubject } from "@/lib/session";
import { monthKey } from "@/lib/date";
import { getUsedAiu, setUsedAiu as persistUsedAiu } from "@/lib/storage";
import type { SyncStatus, UsageRecord } from "@/types";

/** Background refresh interval for the signed-in user's own usage. */
const POLL_INTERVAL_MS = 20 * 60 * 1000;

export interface UsageSync {
  /** Latest usage record for the current month, or `null` if never synced. */
  usage: UsageRecord | null;
  /** Whether the last poll succeeded. */
  status: SyncStatus;
  /** AIU used so far, as an editable input string. */
  usedAiu: string;
  /** Update the used-AIU field and persist it locally. */
  setUsedAiu: (value: string) => void;
  /** Force an immediate refetch. */
  refresh: () => void;
  /** Last-seen script version from the ping endpoint, or `null` if never pinged. */
  syncVersion: string | null;
}

/**
 * Poll `/api/usage/:uuid` for the current month and mirror the result into the
 * used-AIU field.
 *
 * @param onSynced called after each successful poll, e.g. to refresh the team view
 */
export function useUsageSync(onSynced?: () => void): UsageSync {
  const [usage, setUsage] = useState<UsageRecord | null>(null);
  const [status, setStatus] = useState<SyncStatus>(null);
  const [syncVersion, setSyncVersion] = useState<string | null>(null);
  const [usedAiu, setUsedAiuState] = useState<string>(() => {
    const stored = getUsedAiu();
    return stored ? String(Math.round(Number.parseFloat(stored))) : "";
  });

  const setUsedAiu = useCallback((value: string): void => {
    setUsedAiuState(value);
    persistUsedAiu(value);
  }, []);

  const refresh = useCallback((): void => {
    const uuid = getSubject();
    if (!uuid) return;

    fetchUsage(uuid)
      .then((record) => {
        setStatus("ok");
        if (record.month !== monthKey()) {
          setUsedAiuState("0");
          persistUsedAiu("0");
          return;
        }
        setUsedAiuState(String(Math.round(record.aiu)));
        persistUsedAiu(String(record.aiu));
        setUsage(record);
        onSynced?.();
      })
      .catch((err: unknown) => {
        if (err instanceof ApiRequestError && err.status === 404) {
          // UUID is valid but no data posted yet this month — sync is healthy.
          setStatus("ok");
          setUsedAiuState("0");
          persistUsedAiu("0");
        } else {
          setStatus("error");
        }
      });
    // `onSynced` is intentionally excluded: callers pass a stable callback and
    // re-running on identity changes would restart the poll loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    refresh();
    const interval = window.setInterval(refresh, POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [refresh]);

  // Fetch the last-seen script version from the ping endpoint once on mount.
  useEffect(() => {
    const uuid = getSubject();
    if (!uuid) return;
    fetchSyncPing(uuid)
      .then((ping) => setSyncVersion(ping.script_version))
      .catch(() => { /* no ping recorded yet — leave null */ });
  }, []);

  return { usage, status, usedAiu, setUsedAiu, refresh, syncVersion };
}
