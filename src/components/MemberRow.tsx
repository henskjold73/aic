import { useState, type JSX, type ReactNode } from "react";
import { DailyUsageChart } from "@/components/DailyUsageChart";
import { LiveAgo } from "@/components/LiveAgo";
import { COLORS, offsetColor } from "@/lib/constants";
import type { EnrichedMember, MonthKey } from "@/types";

export interface MemberRowProps {
  /** Member to render. */
  member: EnrichedMember;
  /** Zero-based rank, displayed as a 1-based badge. */
  rank: number;
  /** Accent colour for the badge and value text. */
  accent: string;
  /** Primary figure shown on the right, already formatted. */
  value: string;
  /** Optional caption under {@link value}. */
  sub?: string;
  /** When set, renders the budget-deviation bar instead of the usage bar. */
  budgetRatio?: number | null;
  /** Highest AIU in the list, used to scale the usage bar. */
  maxAiu: number;
  /** Month to chart when the row is expanded. */
  month: MonthKey;
}

/** Tick marks on the budget bar at -30%, -10%, on-target, +10%, +30%. */
const BUDGET_TICKS: ReadonlyArray<{ left: string; color: string; opacity: number }> = [
  { left: "35%", color: COLORS.bad, opacity: 0.4 },
  { left: "45%", color: COLORS.primary, opacity: 0.4 },
  { left: "50%", color: COLORS.good, opacity: 0.6 },
  { left: "55%", color: COLORS.primary, opacity: 0.4 },
  { left: "65%", color: COLORS.bad, opacity: 0.4 },
];

function BudgetBar({ ratio }: { ratio: number }): JSX.Element {
  const filledPct = Math.min((ratio / 2) * 100, 100);
  return (
    <div
      style={{
        position: "relative",
        background: COLORS.tint,
        borderRadius: 6,
        height: 6,
        overflow: "visible",
      }}
    >
      {BUDGET_TICKS.map((tick) => (
        <div
          key={tick.left}
          style={{
            position: "absolute",
            left: tick.left,
            top: -1,
            width: 2,
            height: 8,
            background: tick.color,
            borderRadius: 1,
            zIndex: 1,
            opacity: tick.opacity,
          }}
        />
      ))}
      <div
        style={{
          width: `${filledPct}%`,
          height: "100%",
          background: offsetColor(ratio),
          borderRadius: 6,
          transition: "width 0.3s",
        }}
      />
    </div>
  );
}

function UsageBar({
  aiu,
  maxAiu,
  accent,
}: {
  aiu: number;
  maxAiu: number;
  accent: string;
}): JSX.Element {
  return (
    <div
      style={{
        background: COLORS.tint,
        borderRadius: 6,
        height: 5,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${(aiu / maxAiu) * 100}%`,
          height: "100%",
          background: `linear-gradient(90deg,${accent},${accent}99)`,
          borderRadius: 6,
        }}
      />
    </div>
  );
}

function OffsetLabel({ ratio }: { ratio: number }): JSX.Element {
  const offset = Math.round((ratio - 1) * 100);
  const magnitude = Math.abs(offset);
  const color =
    magnitude <= 10 ? COLORS.good : magnitude <= 30 ? COLORS.primary : COLORS.bad;
  return (
    <div style={{ fontSize: "0.65rem", color }}>
      {offset > 0 ? "+" : ""}
      {offset}% off
    </div>
  );
}

/** One expandable team-member card with a usage or budget-deviation bar. */
export function MemberRow({
  member,
  rank,
  accent,
  value,
  sub,
  budgetRatio,
  maxAiu,
  month,
}: MemberRowProps): JSX.Element {
  const [expanded, setExpanded] = useState<boolean>(false);

  const bar: ReactNode =
    budgetRatio != null ? (
      <BudgetBar ratio={budgetRatio} />
    ) : (
      <UsageBar aiu={member.aiu} maxAiu={maxAiu} accent={accent} />
    );

  return (
    <div
      style={{
        background: COLORS.surface,
        borderRadius: 10,
        padding: "12px 14px",
        border: `1px solid ${expanded ? "#c8d0f8" : COLORS.border}`,
        cursor: "pointer",
        transition: "border-color 0.15s",
      }}
      onClick={() => setExpanded((open) => !open)}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 6,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              background: accent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.65rem",
              fontWeight: 700,
              color: "#fff",
            }}
          >
            {rank + 1}
          </div>
          <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>{member.name}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "0.88rem", fontWeight: 700, color: accent }}>
              {value}
            </div>
            {sub && <div style={{ fontSize: "0.65rem", color: COLORS.faint }}>{sub}</div>}
          </div>
          <div style={{ fontSize: "0.65rem", color: "#bbb", userSelect: "none" }}>
            {expanded ? "▲" : "▼"}
          </div>
        </div>
      </div>

      {bar}

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        <div style={{ fontSize: "0.65rem", color: COLORS.faint }}>
          synced <LiveAgo iso={member.usage.updated_at} />
        </div>
        {budgetRatio != null && <OffsetLabel ratio={budgetRatio} />}
      </div>

      {expanded && (
        <DailyUsageChart uuid={member.uuid} budget={member.budget} month={month} />
      )}
    </div>
  );
}
