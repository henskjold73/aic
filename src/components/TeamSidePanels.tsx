import type { CSSProperties, JSX, ReactNode } from "react";
import { useWide } from "@/hooks/useWide";
import { COLORS, offsetColor } from "@/lib/constants";
import { enrichMembers, sortByBudgetProximity, sortByUsage } from "@/lib/members";
import { getTeamId } from "@/lib/storage";
import { FONT_STACK } from "@/styles";
import type { FlatMember } from "@/types";

export interface TeamSidePanelsProps {
  /** Members with current-month usage. Must be non-empty. */
  members: readonly FlatMember[];
  /** Reference date used for pace calculations. */
  today: Date;
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
  members,
  today,
}: TeamSidePanelsProps): JSX.Element | null {
  const wide = useWide(900);

  const enriched = enrichMembers(members, today);
  const topUser = sortByUsage(enriched)[0];
  const closestToBudget = sortByBudgetProximity(enriched)[0];
  const teamId = getTeamId();

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
    <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
      <div style={{ ...panelBase, flex: 1 }}>{leftContent}</div>
      {closestToBudget && <div style={{ ...panelBase, flex: 1 }}>{rightContent}</div>}
    </div>
  );
}
