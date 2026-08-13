import type { ChangeEvent, JSX } from "react";
import { LiveAgo } from "@/components/LiveAgo";
import { COLORS } from "@/lib/constants";
import { inputStyle, panel, statBox } from "@/styles";
import type { AicInsight, SyncStatus, UsageRecord } from "@/types";

export interface AicPanelProps {
  /** Monthly budget as an editable input string. */
  monthlyBudget: string;
  onMonthlyBudgetChange: (value: string) => void;
  /** AIU used so far as an editable input string. */
  usedAiu: string;
  onUsedAiuChange: (value: string) => void;
  /** Latest synced usage record, or `null` when auto-sync is not connected. */
  usage: UsageRecord | null;
  /** Whether the last sync poll succeeded. */
  syncStatus: SyncStatus;
  /** True once a sync UUID has been saved locally. */
  hasSyncUuid: boolean;
  /** Opens the auto-sync setup modal. */
  onOpenSyncModal: () => void;
  /** Burn-rate summary, or `null` until both budget and usage are known. */
  insight: AicInsight | null;
}

/** Label and colour describing how the current burn rate compares to budget. */
function burnStatusPresentation(insight: AicInsight): { color: string; label: string } {
  if (insight.overBudget) {
    return { color: COLORS.bad, label: "⚠️ Over budget on current pace" };
  }
  if (insight.burnStatus > 10) {
    return {
      color: COLORS.warn,
      label: "🟠 Burning faster than expected — ease up",
    };
  }
  return { color: COLORS.good, label: "✅ On track" };
}

/** Budget inputs, token counters and the burn-rate summary. */
export function AicPanel({
  monthlyBudget,
  onMonthlyBudgetChange,
  usedAiu,
  onUsedAiuChange,
  usage,
  syncStatus,
  hasSyncUuid,
  onOpenSyncModal,
  insight,
}: AicPanelProps): JSX.Element {
  const syncLabel = hasSyncUuid
    ? syncStatus === "ok"
      ? "⬤ synced"
      : "⬤ sync"
    : "⬤ set up sync";
  const syncTitle = hasSyncUuid
    ? syncStatus === "ok"
      ? "Synced"
      : "Auto-sync configured"
    : "Set up auto-sync";
  const syncColor = hasSyncUuid && syncStatus === "ok" ? COLORS.good : COLORS.faint;

  const scriptOutdated =
    usage !== null &&
    usage.script_version !== null &&
    usage.script_version !== __CURRENT_SCRIPT_VERSION__;

  return (
    <div style={{ ...panel, marginTop: 14 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <div
          style={{
            fontSize: "0.75rem",
            fontWeight: 700,
            color: COLORS.primary,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          AI Credits (AIC)
        </div>
        <button
          onClick={onOpenSyncModal}
          title={syncTitle}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: "0.75rem",
            color: syncColor,
            padding: 0,
          }}
        >
          {syncLabel}
        </button>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: insight ? 12 : 0 }}>
        <label style={{ flex: 1, fontSize: "0.75rem", color: COLORS.muted }}>
          Monthly budget
          <input
            type="number"
            value={monthlyBudget}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              onMonthlyBudgetChange(event.target.value)
            }
            placeholder="e.g. 1000"
            style={inputStyle}
          />
        </label>
        <label style={{ flex: 1, fontSize: "0.75rem", color: COLORS.muted }}>
          Used so far
          <input
            type="number"
            value={usedAiu}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              onUsedAiuChange(event.target.value)
            }
            placeholder="e.g. 340"
            style={inputStyle}
          />
        </label>
      </div>

      {scriptOutdated && usage && (
        <div
          style={{
            background: "#fff8e6",
            border: "1px solid #f5d97a",
            borderRadius: 8,
            padding: "8px 12px",
            marginBottom: 10,
            fontSize: "0.75rem",
            color: "#7a5c00",
          }}
        >
          Your sync script is out of date (v{usage.script_version} →{" "}
          v{__CURRENT_SCRIPT_VERSION__}). Re-run the install script to update.
        </div>
      )}

      {usage && (
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 12,
            fontSize: "0.7rem",
            color: "#888",
          }}
        >
          <div style={statBox}>
            <div>Input tokens</div>
            <div style={{ fontWeight: 700, color: "#333" }}>
              {usage.input_tokens.toLocaleString()}
            </div>
          </div>
          <div style={statBox}>
            <div>Output tokens</div>
            <div style={{ fontWeight: 700, color: "#333" }}>
              {usage.output_tokens.toLocaleString()}
            </div>
          </div>
          <div style={statBox}>
            <div>Last synced</div>
            <div style={{ fontWeight: 700, color: "#333" }}>
              <LiveAgo iso={usage.updated_at} />
            </div>
          </div>
        </div>
      )}

      {insight && (
        <BurnSummary
          insight={insight}
          monthlyBudget={monthlyBudget}
          usedAiu={usedAiu}
        />
      )}
    </div>
  );
}

interface BurnSummaryProps {
  insight: AicInsight;
  monthlyBudget: string;
  usedAiu: string;
}

function BurnSummary({ insight, monthlyBudget, usedAiu }: BurnSummaryProps): JSX.Element {
  const { color, label } = burnStatusPresentation(insight);
  const barPct = Math.min(insight.pctUsed, 100);

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: "0.72rem",
          color: "#888",
          marginBottom: 3,
        }}
      >
        <span>
          {Number.parseFloat(usedAiu).toFixed(0)} /{" "}
          {Number.parseFloat(monthlyBudget).toFixed(0)} used
        </span>
        <span style={{ fontWeight: 600, color }}>{insight.pctUsed.toFixed(1)}%</span>
      </div>

      <div
        style={{
          background: COLORS.border,
          borderRadius: 8,
          height: 7,
          marginBottom: 10,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${barPct}%`,
            height: "100%",
            background: color,
            borderRadius: 8,
            transition: "width 0.3s",
          }}
        />
      </div>

      <div style={{ fontSize: "0.78rem", fontWeight: 600, color, marginBottom: 10 }}>
        {label}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3,1fr)",
          gap: 8,
          fontSize: "0.72rem",
          color: COLORS.muted,
        }}
      >
        <div style={statBox}>
          <div>Daily burn</div>
          <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#333" }}>
            {insight.dailyBurnRate.toFixed(1)}
          </div>
        </div>
        <div style={statBox}>
          <div>Projected total</div>
          <div
            style={{
              fontSize: "0.95rem",
              fontWeight: 700,
              color: insight.overBudget ? COLORS.bad : "#333",
            }}
          >
            {insight.projected.toFixed(0)}
          </div>
        </div>
        <div style={statBox}>
          <div>Max/day left</div>
          <div style={{ fontSize: "0.95rem", fontWeight: 700, color: COLORS.good }}>
            {insight.allowedDailyFromNow.toFixed(1)}
          </div>
        </div>
      </div>
    </div>
  );
}
