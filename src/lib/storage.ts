import { monthKey } from "@/lib/date";
import type { Uuid } from "@/types";

/** Every localStorage key this app owns. */
export const STORAGE_KEYS = {
  syncUuid: "aic_sync_uuid",
  /** @deprecated superseded by {@link STORAGE_KEYS.teamIds}; kept for migration. */
  teamId: "aic_team_id",
  teamIds: "aic_team_ids",
  monthlyBudget: "aic_monthly",
  usedAiu: "aic_used",
  /** The `YYYY-MM` month to which {@link STORAGE_KEYS.usedAiu} belongs. */
  usedAiuMonth: "aic_used_month",
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

function read(key: StorageKey): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: StorageKey, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable (private mode, quota) — non-fatal */
  }
}

function remove(key: StorageKey): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* storage unavailable — non-fatal */
  }
}

/** The sync UUID printed by the install script, if the user has saved one. */
export function getSyncUuid(): Uuid | null {
  return read(STORAGE_KEYS.syncUuid);
}

export function setSyncUuid(uuid: Uuid): void {
  write(STORAGE_KEYS.syncUuid, uuid);
}

export function clearSyncUuid(): void {
  remove(STORAGE_KEYS.syncUuid);
}

/**
 * Every team the user has created or joined, most-recently-added last.
 *
 * Migrates the legacy single-team key (`aic_team_id`) into this list the
 * first time it's read, then removes it.
 */
export function getTeamIds(): Uuid[] {
  const legacy = read(STORAGE_KEYS.teamId);
  if (legacy) {
    remove(STORAGE_KEYS.teamId);
    addTeamId(legacy);
  }

  const raw = read(STORAGE_KEYS.teamIds);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is Uuid => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function addTeamId(teamId: Uuid): void {
  const ids = getTeamIdsRaw();
  if (ids.includes(teamId)) return;
  write(STORAGE_KEYS.teamIds, JSON.stringify([...ids, teamId]));
}

export function removeTeamId(teamId: Uuid): void {
  const ids = getTeamIdsRaw().filter((id) => id !== teamId);
  write(STORAGE_KEYS.teamIds, JSON.stringify(ids));
}

/** Like {@link getTeamIds} but without the legacy-key migration side effect. */
function getTeamIdsRaw(): Uuid[] {
  const raw = read(STORAGE_KEYS.teamIds);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is Uuid => typeof id === "string") : [];
  } catch {
    return [];
  }
}

/** Monthly AIU budget as the raw input string, so the field stays editable. */
export function getMonthlyBudget(): string {
  return read(STORAGE_KEYS.monthlyBudget) ?? "";
}

export function setMonthlyBudget(value: string): void {
  write(STORAGE_KEYS.monthlyBudget, value);
}

/** Monthly budget parsed to a number, or `null` when unset or invalid. */
export function getMonthlyBudgetNumber(): number | null {
  const parsed = Number.parseFloat(getMonthlyBudget());
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * AIU used so far, as a raw input string.
 *
 * Returns `""` when the stored value belongs to a different month, so stale
 * figures from the previous month never bleed into a new month's calendar.
 */
export function getUsedAiu(): string {
  const storedMonth = read(STORAGE_KEYS.usedAiuMonth);
  if (storedMonth !== null && storedMonth !== monthKey()) return "0";
  return read(STORAGE_KEYS.usedAiu) ?? "";
}

export function setUsedAiu(value: string): void {
  write(STORAGE_KEYS.usedAiu, value);
  write(STORAGE_KEYS.usedAiuMonth, monthKey());
}
