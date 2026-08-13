import { useEffect, useState, type JSX } from "react";
import { fetchTeamDays } from "@/lib/api";
import { COLORS } from "@/lib/constants";
import { parseMonthKey } from "@/lib/date";
import type { MonthKey, TeamDaysResponse, Uuid } from "@/types";

export interface TeamCumulativeChartProps {
  /** Team whose combined daily usage should be charted. */
  teamId: Uuid;
  /** Month to chart, as `YYYY-MM`. */
  month: MonthKey;
}

/** Chart geometry in SVG user units. */
const CHART_WIDTH = 280;
const CHART_HEIGHT = 56;
const PADDING_TOP = 4;

const placeholderStyle = {
  fontSize: "0.68rem",
  color: COLORS.faint,
  textAlign: "center",
  padding: "8px 0 2px",
} as const;

/** Cumulative AIU line for a whole team over the month, built from daily totals. */
export function TeamCumulativeChart({
  teamId,
  month,
}: TeamCumulativeChartProps): JSX.Element {
  const [days, setDays] = useState<TeamDaysResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchTeamDays(teamId, month)
      .then((data) => {
        if (!cancelled) setDays(data);
      })
      .catch(() => {
        if (!cancelled) setDays([]);
      });
    return () => {
      cancelled = true;
    };
  }, [teamId, month]);

  if (days === null) return <div style={placeholderStyle}>Loading…</div>;
  if (days.length === 0) {
    return (
      <div style={placeholderStyle}>
        No daily data yet — sync script v1.2.0+ required
      </div>
    );
  }

  const { year, month: monthNumber } = parseMonthKey(month);
  const totalDays = new Date(year, monthNumber, 0).getDate();
  const today = new Date();
  const isCurrentMonth =
    today.getFullYear() === year && today.getMonth() + 1 === monthNumber;
  const lastDay = isCurrentMonth ? today.getDate() : totalDays;

  const aiuByDay = new Map<number, number>();
  for (const point of days) {
    aiuByDay.set(new Date(point.date).getDate(), point.aiu);
  }

  const cumulative: number[] = [];
  let running = 0;
  for (let day = 1; day <= lastDay; day++) {
    running += aiuByDay.get(day) ?? 0;
    cumulative.push(running);
  }

  const maxValue = Math.max(...cumulative, 1);
  const usableHeight = CHART_HEIGHT - PADDING_TOP;
  const xStep = lastDay > 1 ? CHART_WIDTH / (lastDay - 1) : 0;

  const points = cumulative.map((value, index) => {
    const x = lastDay > 1 ? index * xStep : CHART_WIDTH;
    const y = PADDING_TOP + usableHeight - (value / maxValue) * usableHeight;
    return { x, y };
  });

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(" ");

  const lastPoint = points[points.length - 1];
  const areaPath =
    points.length > 0
      ? `${linePath} L ${lastPoint.x.toFixed(1)} ${CHART_HEIGHT} L ${points[0].x.toFixed(1)} ${CHART_HEIGHT} Z`
      : "";

  return (
    <div style={{ marginTop: 10, borderTop: "1px solid #f0f1ff", paddingTop: 10 }}>
      <svg
        width="100%"
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        style={{ display: "block", overflow: "visible" }}
      >
        <defs>
          <linearGradient id="team-cumulative-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLORS.primary} stopOpacity={0.18} />
            <stop offset="100%" stopColor={COLORS.primary} stopOpacity={0} />
          </linearGradient>
        </defs>
        {areaPath && <path d={areaPath} fill="url(#team-cumulative-fill)" />}
        <path d={linePath} fill="none" stroke={COLORS.primary} strokeWidth={1.75} />
        {lastPoint && (
          <circle cx={lastPoint.x} cy={lastPoint.y} r={2.5} fill={COLORS.primary} />
        )}
      </svg>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: "0.6rem",
          color: "#bbb",
          marginTop: 3,
        }}
      >
        <span>1</span>
        <span style={{ color: COLORS.faint }}>cumulative team AIU</span>
        <span>{lastDay}</span>
      </div>
    </div>
  );
}
