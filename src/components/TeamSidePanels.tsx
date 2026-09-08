import type { CSSProperties, JSX, ReactNode } from "react";
import { useWide } from "@/hooks/useWide";
import { COLORS, offsetColor, todayColor } from "@/lib/constants";
import { countWorkdays, totalWorkdays } from "@/lib/date";
import { enrichMembers, sortByBudgetProximity, sortByUsage } from "@/lib/members";
import { FONT_STACK } from "@/styles";
import type { FlatMember, TeamTodayMember, Uuid } from "@/types";

export interface TeamSidePanelsProps {
  /** Team these members belong to, used for the "View team" link. */
  teamId: Uuid;
  /** Members with current-month usage. Must be non-empty. */
  members: readonly FlatMember[];
  /** Reference date used for pace calculations. */
  today: Date;
  /** Renders as a floating side panel instead of an inline stacked block. */
  floating?: boolean;
  /** Per-member AIU for today, used for the "Top today" card. */
  todayLeaderboard?: TeamTodayMember[] | null;
}

const panelBase: CSSProperties = {
  background: COLORS.surface,
  borderRadius: 10,
  padding: "12px 14px",
  border: `1px solid ${COLORS.border}`,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  textAlign: "center",
  fontSize: "0.72rem",
  color: COLORS.muted,
  fontFamily: FONT_STACK,
};

const panelHeading = (color: string): CSSProperties => ({
  fontSize: "0.65rem",
  fontWeight: 700,
  color,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  marginBottom: 6,
});

const panelName: CSSProperties = {
  fontWeight: 700,
  color: COLORS.ink,
  fontSize: "0.85rem",
  marginBottom: 2,
};

const panelValue = (color: string): CSSProperties => ({
  fontSize: "1.1rem",
  fontWeight: 700,
  color,
});

/**
 * Two compact leaderboard panels — most active member and closest to their
 * daily budget. Floats beside the calendar on wide screens, stacks below it
 * on narrow ones.
 */
export function TeamSidePanels({
  teamId,
  members,
  today,
  floating = true,
  todayLeaderboard,
}: TeamSidePanelsProps): JSX.Element | null {
  const wide = useWide(900) && floating;

  const enriched = enrichMembers(members, today);
  const topUser = sortByUsage(enriched)[0];
  const closestToBudget = sortByBudgetProximity(enriched)[0];
  const enrichedByUuid = new Map(enriched.map((m) => [m.uuid, m]));
  const todayTop3 = (todayLeaderboard ?? []).filter((m) => m.aiu_today > 0).slice(0, 3);

  const totalWd = totalWorkdays(today.getFullYear(), today.getMonth());
  const elapsedWd = countWorkdays(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  const remainingWd = Math.max(totalWd - elapsedWd, 1);

  if (!topUser) return null;

  const budgetColor = closestToBudget ? offsetColor(closestToBudget.ratio) : COLORS.primary;

  const leftContent: ReactNode = (
    <>
      <div style={panelHeading(COLORS.primary)}>Most active</div>
      <div style={panelName}>{topUser.name}</div>
      <div style={panelValue(COLORS.primary)}>{topUser.aiu.toFixed(1)}</div>
      <div style={{ color: COLORS.faint }}>AIU this month</div>
      {teamId && (
        <a
          href={`/team/${teamId}`}
          style={{
            display: "block",
            marginTop: 8,
            fontSize: "0.65rem",
            color: COLORS.primary,
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          View team →
        </a>
      )}
    </>
  );

  const rightContent: ReactNode = closestToBudget && (
    <>
      <div style={panelHeading(budgetColor)}>Daily budget</div>
      <div style={panelName}>{closestToBudget.name}</div>
      <div style={panelValue(budgetColor)}>{closestToBudget.actualPerDay.toFixed(1)}</div>
      <div style={{ color: COLORS.faint }}>AIU/day actual</div>
      <div style={{ marginTop: 4, color: "#bbb", fontSize: "0.65rem" }}>
        budget {closestToBudget.allowedPerDay.toFixed(1)}/day
      </div>
    </>
  );

  if (wide) {
    return (
      <>
        <div style={{ ...panelBase, position: "absolute", top: 32, left: 16, width: 148 }}>
          {leftContent}
        </div>
        {closestToBudget && (
          <div
            style={{ ...panelBase, position: "absolute", top: 32, right: 16, width: 148 }}
          >
            {rightContent}
          </div>
        )}
      </>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ ...panelBase, flex: 1 }}>{leftContent}</div>
        {closestToBudget && <div style={{ ...panelBase, flex: 1 }}>{rightContent}</div>}
      </div>
      {todayTop3.length > 0 && (
        <div style={{ ...panelBase, alignItems: "flex-start", textAlign: "left" }}>
          <div
            style={{
              fontSize: "0.65rem",
              fontWeight: 700,
              color: COLORS.good,
              textTransform: "uppercase",
              letterSpacing: 0.5,
              marginBottom: 6,
            }}
          >
            Top today
          </div>
          {todayTop3.map((m, i) => {
            const em = enrichedByUuid.get(m.uuid);
            const remainingBudget =
              em?.budget != null ? em.budget - em.aiu : null;
            const allowedToday =
              remainingBudget != null ? remainingBudget / remainingWd : null;
            const ratio =
              allowedToday != null && allowedToday > 0
                ? m.aiu_today / allowedToday
                : null;
            const color = ratio !== null ? todayColor(ratio) : COLORS.primary;
            return (
              <div
                key={m.uuid}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  width: "100%",
                  marginBottom: 4,
                }}
              >
                <span style={{ fontWeight: i === 0 ? 700 : 400, color: COLORS.ink }}>
                  {i + 1}. {m.name}
                </span>
                <span style={{ textAlign: "right" }}>
                  <span style={{ fontWeight: 700, color, display: "block" }}>
                    {m.aiu_today.toFixed(1)}
                  </span>
                  {allowedToday != null && (
                    <span
                      style={{ fontSize: "0.6rem", color: COLORS.faint, display: "block" }}
                    >
                      {allowedToday.toFixed(1)} left/day
                    </span>
                  )}
                </span>
              </div>
            );
          })}
          <div style={{ color: COLORS.faint, fontSize: "0.65rem", marginTop: 2 }}>
            AIU today
          </div>
        </div>
      )}
    </div>
  );
}
