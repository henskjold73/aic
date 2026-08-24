/** RFC 4122 UUID matcher, mirroring the one used by the API handlers. */
export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Narrow an unknown value to a well-formed UUID string. */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/** Semantic palette used across charts, bars and status text. */
export const COLORS = {
  primary: "#4f6ef7",
  primaryLight: "#7b8ff7",
  good: "#3ab87a",
  warn: "#e0953a",
  bad: "#e05252",
  ink: "#1a1a2e",
  muted: "#666",
  faint: "#aaa",
  surface: "#fff",
  page: "#f4f5fb",
  tint: "#eef0ff",
  border: "#e8eaff",
} as const;

export type ColorName = keyof typeof COLORS;

/** Base URL for the raw install/uninstall scripts on GitHub. */
const SCRIPT_BASE =
  "https://raw.githubusercontent.com/henskjold73/aic/main/scripts";

/** Shell one-liners for installing and removing the sync agent. */
export interface SyncCommands {
  install: string;
  uninstall: string;
}

/** Platform-appropriate install/uninstall commands for the current browser. */
export function syncCommands(
  userAgent: string = navigator.userAgent,
): SyncCommands {
  const isWindows = userAgent.includes("Windows");
  return isWindows
    ? {
        install: `irm ${SCRIPT_BASE}/install-sync.ps1 | iex`,
        uninstall: `irm ${SCRIPT_BASE}/uninstall-sync.ps1 | iex`,
      }
    : {
        install: `bash <(curl -sL ${SCRIPT_BASE}/install-sync.sh)`,
        uninstall: `bash <(curl -sL ${SCRIPT_BASE}/uninstall-sync.sh)`,
      };
}

/** True when the visitor is on Windows, used to pick file-path examples. */
export function isWindows(userAgent: string = navigator.userAgent): boolean {
  return userAgent.includes("Windows");
}

/**
 * Colour for how far a member's burn rate deviates from their daily budget.
 * Within 10% is good, within 30% is neutral, beyond that is bad.
 */
export function offsetColor(ratio: number): string {
  const offsetPct = Math.abs(Math.round((ratio - 1) * 100));
  if (offsetPct <= 10) return COLORS.good;
  if (offsetPct <= 30) return COLORS.primary;
  return COLORS.bad;
}

/** Suffix scale used by {@link formatCompactNumber}, largest first. */
const COMPACT_UNITS = [
  { value: 1_000_000_000, suffix: "G" },
  { value: 1_000_000, suffix: "M" },
  { value: 1_000, suffix: "k" },
] as const;

/**
 * Format a token count compactly: plain integers below 1000 (e.g. `99`,
 * `999`), then one decimal place per unit above that with a trailing `.0`
 * dropped (e.g. `1k`, `99k`, `0.1M`, `99M`, `0.1G`).
 */
export function formatCompactNumber(value: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);

  if (abs < 1000) return `${sign}${Math.round(abs)}`;

  for (let i = 0; i < COMPACT_UNITS.length; i++) {
    const unit = COMPACT_UNITS[i];
    if (abs < unit.value) continue;

    let scaled = Math.round((abs / unit.value) * 10) / 10;
    let suffix = unit.suffix;

    // Rounding can push e.g. 999,999 to "1000k" — bump to the next unit up.
    if (scaled >= 1000 && i > 0) {
      const largerUnit = COMPACT_UNITS[i - 1];
      scaled = Math.round((abs / largerUnit.value) * 10) / 10;
      suffix = largerUnit.suffix;
    }

    const formatted = Number.isInteger(scaled) ? String(scaled) : scaled.toFixed(1);
    return `${sign}${formatted}${suffix}`;
  }

  return `${sign}${Math.round(abs)}`;
}
