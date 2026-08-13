import type { Uuid } from "@/types";

/** Every localStorage key this app owns. */
export const STORAGE_KEYS = {
  syncUuid: "aic_sync_uuid",
  teamId: "aic_team_id",
  monthlyBudget: "aic_monthly",
  usedAiu: "aic_used",
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

/** The team the user most recently created or joined. */
export function getTeamId(): Uuid | null {
  return read(STORAGE_KEYS.teamId);
}

export function setTeamId(teamId: Uuid): void {
  write(STORAGE_KEYS.teamId, teamId);
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

/** AIU used so far, as a raw input string. */
export function getUsedAiu(): string {
  return read(STORAGE_KEYS.usedAiu) ?? "";
}

export function setUsedAiu(value: string): void {
  write(STORAGE_KEYS.usedAiu, value);
}
