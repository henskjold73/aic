import { useCallback, useEffect, useMemo, useState, type JSX } from "react";
import { AicPanel } from "@/components/AicPanel";
import { AutoModal } from "@/components/AutoModal";
import { BuildStamp } from "@/components/BuildStamp";
import { CalendarGrid } from "@/components/CalendarGrid";
import { TeamSidePanels } from "@/components/TeamSidePanels";
import { TopNav } from "@/components/TopNav";
import { useTeamsSync } from "@/hooks/useTeamSync";
import { useUsageSync } from "@/hooks/useUsageSync";
import { useWide } from "@/hooks/useWide";
import { fetchUsageHistory, leaveTeam, patchBudget } from "@/lib/api";
import { COLORS } from "@/lib/constants";
import { countWorkdays, daysInMonth, MONTH_NAMES, totalWorkdays } from "@/lib/date";
import { computeInsight } from "@/lib/members";
import {
  getMonthlyBudget,
  getSyncUuid,
  removeTeamId,
  setMonthlyBudget as persistMonthlyBudget,
} from "@/lib/storage";
import { FONT_STACK, navBtn, panel } from "@/styles";
import type { UsageHistoryRecord } from "@/types";

export interface CalendarPageProps {
  /** Open the auto-sync modal on mount, used by the `/auto` route. */
  openSyncModal?: boolean;
}

/** `/` — the workday calendar with AIC budget tracking and team panels. */
export function CalendarPage({ openSyncModal = false }: CalendarPageProps): JSX.Element {
  const today = useMemo(() => new Date(), []);

  const wide = useWide(480);
  const panelsOnSide = useWide(900);

  const [viewYear, setViewYear] = useState<number>(() => today.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(() => today.getMonth());
  const [monthlyBudget, setMonthlyBudget] = useState<string>(() => getMonthlyBudget());
  const [showAutoModal, setShowAutoModal] = useState<boolean>(openSyncModal);

  const [usageHistory, setUsageHistory] = useState<UsageHistoryRecord[] | null>(null);

  useEffect(() => {
    const uuid = getSyncUuid();
    if (!uuid) return;
    fetchUsageHistory(uuid).then(setUsageHistory).catch(() => {});
  }, []);

  const teamsSync = useTeamsSync();
  const teamsRefresh = teamsSync.refresh;
  const onSynced = useCallback(() => teamsRefresh(), [teamsRefresh]);
  const usage = useUsageSync(onSynced);

  const hasSyncUuid = getSyncUuid() !== null;

  const handleLeaveTeam = useCallback(
    (teamId: string) => {
      removeTeamId(teamId);
      teamsRefresh();
      const uuid = getSyncUuid();
      if (uuid) leaveTeam(teamId, uuid).catch(() => {});
    },
    [teamsRefresh],
  );

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

  const viewMonthKey = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}`;
  const historyRecord = usageHistory?.find((r) => r.month === viewMonthKey) ?? null;

  // For past months, use historical record values instead of the live sync data.
  const viewedUsedAiu = isPastMonth && historyRecord?.aiu != null
    ? String(Math.round(historyRecord.aiu))
    : usage.usedAiu;
  const viewedBudget = isPastMonth && historyRecord?.budget != null
    ? String(historyRecord.budget)
    : monthlyBudget;
  // For past months compute insight as of the last day of that month.
  const insightDate = isPastMonth ? new Date(viewYear, viewMonth + 1, 0) : today;

  const insight = useMemo(
    () => computeInsight(viewedBudget, viewedUsedAiu, insightDate),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [viewedBudget, viewedUsedAiu, viewYear, viewMonth, isPastMonth],
  );

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

  const parsedBudget = Number.parseFloat(viewedBudget);
  const budget = Number.isFinite(parsedBudget) ? parsedBudget : null;

  const summary: ReadonlyArray<readonly [string, string | number]> = [
    ["Total workdays", totalWd],
    ["Elapsed", workdaysElapsed],
    ["Remaining", totalWd - workdaysElapsed],
    ["Progress", `${pctElapsed.toFixed(1)}%`],
  ];

  const teamsWithMembers = teamsSync.teams.filter(
    (team) => team.members !== null && team.members.length > 0,
  );

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
        <TopNav teams={teamsSync.teams} onLeaveTeam={handleLeaveTeam} />

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
          <button onClick={nextMonth} style={navBtn} aria-label="Next month">
            →
          </button>
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
          monthlyBudget={viewedBudget}
          onMonthlyBudgetChange={isPastMonth ? () => {} : updateMonthlyBudget}
          usedAiu={viewedUsedAiu}
          onUsedAiuChange={isPastMonth ? () => {} : usage.setUsedAiu}
          usage={isPastMonth ? null : usage.usage}
          syncStatus={isPastMonth ? null : usage.status}
          hasSyncUuid={hasSyncUuid && !isPastMonth}
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

        {(!panelsOnSide || teamsWithMembers.length > 1) &&
          teamsWithMembers.map((team) => (
            <TeamSidePanels
              key={team.id}
              teamId={team.id}
              members={team.members!}
              todayLeaderboard={team.todayLeaderboard}
              today={today}
              floating={false}
            />
          ))}
      </div>

      {panelsOnSide && teamsWithMembers.length === 1 && (
        <TeamSidePanels
          teamId={teamsWithMembers[0].id}
          members={teamsWithMembers[0].members!}
          todayLeaderboard={teamsWithMembers[0].todayLeaderboard}
          today={today}
        />
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
