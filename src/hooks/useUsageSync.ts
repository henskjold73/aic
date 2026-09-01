import { useCallback, useEffect, useState } from "react";
import { fetchUsage, patchBudget } from "@/lib/api";
import { monthKey } from "@/lib/date";
import {
  getMonthlyBudgetNumber,
  getSyncUuid,
  getUsedAiu,
  setUsedAiu as persistUsedAiu,
} from "@/lib/storage";
import type { SyncStatus, UsageRecord } from "@/types";

/** Background refresh interval for the signed-in user's own usage. */
const POLL_INTERVAL_MS = 5 * 60 * 1000;

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
  const [usedAiu, setUsedAiuState] = useState<string>(() => {
    const stored = getUsedAiu();
    return stored ? String(Math.round(Number.parseFloat(stored))) : "";
  });

  const setUsedAiu = useCallback((value: string): void => {
    setUsedAiuState(value);
    persistUsedAiu(value);
  }, []);

  const refresh = useCallback((): void => {
    const uuid = getSyncUuid();
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
      .catch(() => setStatus("error"));
    // `onSynced` is intentionally excluded: callers pass a stable callback and
    // re-running on identity changes would restart the poll loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    refresh();
    const interval = window.setInterval(refresh, POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [refresh]);

  // One-time back-fill: if a budget exists locally but not server-side, push it
  // up so team views can compute this user's daily allowance.
  useEffect(() => {
    const uuid = getSyncUuid();
    const budget = getMonthlyBudgetNumber();
    if (!uuid || budget === null) return;

    fetchUsage(uuid)
      .then((record) => {
        if (record.budget == null) return patchBudget(uuid, budget);
        return undefined;
      })
      .catch(() => {
        /* nothing synced yet — the next PATCH from the budget field will cover it */
      });
  }, []);

  return { usage, status, usedAiu, setUsedAiu, refresh };
}
