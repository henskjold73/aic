import { useCallback, useMemo, useState, type JSX } from "react";
import { AicPanel } from "@/components/AicPanel";
import { AutoModal } from "@/components/AutoModal";
import { BuildStamp } from "@/components/BuildStamp";
import { CalendarGrid } from "@/components/CalendarGrid";
import { TeamSidePanels } from "@/components/TeamSidePanels";
import { useTeamSync } from "@/hooks/useTeamSync";
import { useUsageSync } from "@/hooks/useUsageSync";
import { useWide } from "@/hooks/useWide";
import { patchBudget } from "@/lib/api";
import { COLORS } from "@/lib/constants";
import { countWorkdays, daysInMonth, MONTH_NAMES, totalWorkdays } from "@/lib/date";
import { computeInsight } from "@/lib/members";
import {
  getMonthlyBudget,
  getSyncUuid,
  setMonthlyBudget as persistMonthlyBudget,
} from "@/lib/storage";
import { FONT_STACK, navBtn, panel } from "@/styles";

export interface CalendarPageProps {
  /** Open the auto-sync modal on mount, used by the `/auto` route. */
  openSyncModal?: boolean;
}

const linkBtn = {
  ...navBtn,
  textDecoration: "none",
  fontSize: "0.75rem",
  fontWeight: 600,
  color: COLORS.primary,
} as const;

/** `/` — the workday calendar with AIC budget tracking and team panels. */
export function CalendarPage({ openSyncModal = false }: CalendarPageProps): JSX.Element {
  const today = useMemo(() => new Date(), []);

  const wide = useWide(480);
  const panelsOnSide = useWide(900);

  const [viewYear, setViewYear] = useState<number>(() => today.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(() => today.getMonth());
  const [monthlyBudget, setMonthlyBudget] = useState<string>(() => getMonthlyBudget());
  const [showAutoModal, setShowAutoModal] = useState<boolean>(openSyncModal);

  const team = useTeamSync();
  const teamRefresh = team.refresh;
  const onSynced = useCallback(() => teamRefresh(), [teamRefresh]);
  const usage = useUsageSync(onSynced);

  const hasSyncUuid = getSyncUuid() !== null;

  const updateMonthlyBudget = useCallback((value: string): void => {
    setMonthlyBudget(value);
    persistMonthlyBudget(value);

    const uuid = getSyncUuid();
    const parsed = Number.parseFloat(value);
    if (uuid && Number.isFinite(parsed)) {
      patchBudget(uuid, parsed).catch(() => {
        /* budget is stored locally regardless; the next sync will retry */
      });
    }
  }, []);

  const insight = useMemo(
    () => computeInsight(monthlyBudget, usage.usedAiu, today),
    [monthlyBudget, usage.usedAiu, today],
  );

  const totalDays = daysInMonth(viewYear, viewMonth);
  const totalWd = totalWorkdays(viewYear, viewMonth);

  const isCurrentMonth =
    viewYear === today.getFullYear() && viewMonth === today.getMonth();
  const isPastMonth =
    viewYear < today.getFullYear() ||
    (viewYear === today.getFullYear() && viewMonth < today.getMonth());

  const workdaysElapsed = isPastMonth
    ? totalWd
    : isCurrentMonth
      ? countWorkdays(viewYear, viewMonth, today.getDate())
      : 0;
  const pctElapsed = totalWd > 0 ? (workdaysElapsed / totalWd) * 100 : 0;

  function prevMonth(): void {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((year) => year - 1);
    } else {
      setViewMonth((month) => month - 1);
    }
  }

  function nextMonth(): void {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((year) => year + 1);
    } else {
      setViewMonth((month) => month + 1);
    }
  }

  const parsedBudget = Number.parseFloat(monthlyBudget);
  const budget = Number.isFinite(parsedBudget) ? parsedBudget : null;

  const summary: ReadonlyArray<readonly [string, string | number]> = [
    ["Total workdays", totalWd],
    ["Elapsed", workdaysElapsed],
    ["Remaining", totalWd - workdaysElapsed],
    ["Progress", `${pctElapsed.toFixed(1)}%`],
  ];

  const showTeamPanels = team.members !== null && team.members.length > 0;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: COLORS.page,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: wide ? "32px 16px" : "12px 10px",
        position: "relative",
      }}
    >
      <div
        style={{ fontFamily: FONT_STACK, width: "100%", maxWidth: 480, color: COLORS.ink }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <button onClick={prevMonth} style={navBtn} aria-label="Previous month">
            ←
          </button>
          <div style={{ fontSize: "1.3rem", fontWeight: 700, letterSpacing: -0.5 }}>
            {MONTH_NAMES[viewMonth]} {viewYear}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <a href="/team" style={linkBtn}>
              Team
            </a>
            <a href="/report" style={linkBtn}>
              Report
            </a>
            <button onClick={nextMonth} style={navBtn} aria-label="Next month">
              →
            </button>
          </div>
        </div>

        {/* Workday progress */}
        <div
          style={{
            fontSize: "0.75rem",
            color: "#888",
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 4,
          }}
        >
          <span>
            {workdaysElapsed} of {totalWd} workdays elapsed
          </span>
          <span style={{ fontWeight: 600, color: COLORS.primary }}>
            {pctElapsed.toFixed(1)}%
          </span>
        </div>
        <div
          style={{
            background: COLORS.tint,
            borderRadius: 8,
            height: 7,
            marginBottom: 18,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${pctElapsed}%`,
              height: "100%",
              background: `linear-gradient(90deg,${COLORS.primary},${COLORS.primaryLight})`,
              borderRadius: 8,
              transition: "width 0.3s",
            }}
          />
        </div>

        <CalendarGrid
          year={viewYear}
          month={viewMonth}
          totalDays={totalDays}
          isCurrentMonth={isCurrentMonth}
          today={today}
          budget={budget}
          dailyBurnRate={insight?.dailyBurnRate ?? null}
          wide={wide}
        />

        <AicPanel
          monthlyBudget={monthlyBudget}
          onMonthlyBudgetChange={updateMonthlyBudget}
          usedAiu={usage.usedAiu}
          onUsedAiuChange={usage.setUsedAiu}
          usage={usage.usage}
          syncStatus={usage.status}
          hasSyncUuid={hasSyncUuid}
          onOpenSyncModal={() => setShowAutoModal(true)}
          insight={insight}
        />

        {/* Summary */}
        <div
          style={{
            ...panel,
            marginTop: 10,
            padding: "10px 14px",
            display: "flex",
            justifyContent: "space-between",
            fontSize: "0.78rem",
            color: COLORS.muted,
          }}
        >
          {summary.map(([label, value]) => (
            <div key={label}>
              <div style={{ fontSize: wide ? "0.78rem" : "0.68rem" }}>{label}</div>
              <div
                style={{
                  fontSize: wide ? "1rem" : "0.92rem",
                  fontWeight: 700,
                  color: COLORS.primary,
                }}
              >
                {value}
              </div>
            </div>
          ))}
        </div>

        {!panelsOnSide && showTeamPanels && team.members && (
          <TeamSidePanels members={team.members} today={today} />
        )}
      </div>

      {panelsOnSide && showTeamPanels && team.members && (
        <TeamSidePanels members={team.members} today={today} />
      )}

      {showAutoModal && (
        <AutoModal
          onClose={() => {
            setShowAutoModal(false);
            if (openSyncModal) window.location.href = "/";
          }}
        />
      )}

      <BuildStamp />
    </div>
  );
}
