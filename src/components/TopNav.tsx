import type { CSSProperties, JSX } from "react";
import type { TeamSyncEntry } from "@/hooks/useTeamSync";
import { COLORS } from "@/lib/constants";
import { FONT_STACK } from "@/styles";

export interface TopNavProps {
  /** Teams the user has joined, in join order. */
  teams: readonly TeamSyncEntry[];
  /** Called when the user confirms leaving a team. */
  onLeaveTeam: (teamId: string) => void;
}

const bar: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  fontFamily: FONT_STACK,
  fontSize: "0.7rem",
  marginBottom: 10,
  flexWrap: "wrap",
};

const group: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  flexWrap: "wrap",
};

const navLink: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  color: COLORS.faint,
  textDecoration: "none",
  fontWeight: 600,
  padding: "4px 6px",
  borderRadius: 6,
  cursor: "pointer",
  transition: "background 0.15s, color 0.15s",
};

const pill: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  background: COLORS.tint,
  borderRadius: 20,
  padding: "3px 4px 3px 10px",
  transition: "background 0.15s",
};

const pillLink: CSSProperties = {
  color: COLORS.primary,
  textDecoration: "none",
  fontWeight: 600,
  maxWidth: 120,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  cursor: "pointer",
};

const leaveBtn: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 16,
  height: 16,
  border: "none",
  borderRadius: "50%",
  background: "transparent",
  color: COLORS.faint,
  cursor: "pointer",
  padding: 0,
  fontSize: "0.7rem",
  lineHeight: 1,
  transition: "background 0.15s, color 0.15s",
};

/**
 * Hover states, scoped to this component's class names. Inline style objects
 * can't express `:hover`, so this is the one bit of real CSS in the file.
 */
const hoverStyles = `
  .aic-nav-link:hover { background: ${COLORS.tint}; color: ${COLORS.primary}; }
  .aic-pill:hover { background: #e3e6ff; }
  .aic-leave-btn:hover { background: ${COLORS.bad}; color: #fff; }
`;

function PlusIcon(): JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ReportIcon(): JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path
        d="M1.5 10.5V1.5M1.5 10.5H10.5M4 8.5V6M6.5 8.5V4M9 8.5V5.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PrivacyIcon(): JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path
        d="M6 1l4 1.5v3.2c0 2.6-1.7 4.6-4 5.3-2.3-.7-4-2.7-4-5.3V2.5L6 1z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Subtle top-of-page menu: join a team, jump to any joined team's stats or
 * leave it, and links to the report and privacy pages.
 */
export function TopNav({ teams, onLeaveTeam }: TopNavProps): JSX.Element {
  return (
    <nav style={bar} aria-label="Teams and pages">
      <style>{hoverStyles}</style>
      <div style={group}>
        <a href="/team" style={navLink} className="aic-nav-link">
          <PlusIcon />
          Join team
        </a>
        {teams.map((team) => (
          <span key={team.id} style={pill} className="aic-pill">
            <a href={`/team/${team.id}`} style={pillLink} title={team.name}>
              {team.name}
            </a>
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Leave ${team.name}?`)) onLeaveTeam(team.id);
              }}
              style={leaveBtn}
              className="aic-leave-btn"
              aria-label={`Leave ${team.name}`}
              title={`Leave ${team.name}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div style={group}>
        <a href="/report" style={navLink} className="aic-nav-link">
          <ReportIcon />
          Report
        </a>
        <a href="/privacy" style={navLink} className="aic-nav-link">
          <PrivacyIcon />
          Privacy
        </a>
      </div>
    </nav>
  );
}
