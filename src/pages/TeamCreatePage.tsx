import { useState, type ChangeEvent, type JSX } from "react";
import { createTeam } from "@/lib/api";
import { COLORS } from "@/lib/constants";
import { setTeamId } from "@/lib/storage";
import { backLink, btnPrimary, btnSecondary, card, inputStyle, pageWrap } from "@/styles";
import type { Uuid } from "@/types";

/** `/team` — create a team and share its join link. */
export function TeamCreatePage(): JSX.Element {
  const [name, setName] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [teamId, setCreatedTeamId] = useState<Uuid | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function create(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const team = await createTeam(name.trim() || "My Team");
      setCreatedTeamId(team.id);
      setTeamId(team.id);
    } catch {
      setError("Could not create the team — please try again.");
    } finally {
      setLoading(false);
    }
  }

  const joinUrl = teamId ? `${window.location.origin}/team/${teamId}/join` : null;

  return (
    <div style={pageWrap}>
      <div style={card}>
        <div style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 6 }}>
          Create a team
        </div>
        <div style={{ fontSize: "0.8rem", color: COLORS.muted, marginBottom: 16 }}>
          Share the join link with your coworkers — everyone adds their sync UUID to the
          team.
        </div>

        {teamId === null || joinUrl === null ? (
          <>
            <label
              style={{
                fontSize: "0.75rem",
                color: COLORS.muted,
                display: "block",
                marginBottom: 12,
              }}
            >
              Team name
              <input
                value={name}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setName(event.target.value)
                }
                placeholder="e.g. Platform team"
                style={{ ...inputStyle, marginTop: 4 }}
              />
            </label>
            {error && (
              <div style={{ fontSize: "0.75rem", color: COLORS.bad, marginBottom: 8 }}>
                {error}
              </div>
            )}
            <button onClick={() => void create()} disabled={loading} style={btnPrimary}>
              {loading ? "Creating..." : "Create team"}
            </button>
          </>
        ) : (
          <>
            <div style={{ fontSize: "0.75rem", color: COLORS.muted, marginBottom: 6 }}>
              Join link — share this:
            </div>
            <div
              style={{
                background: COLORS.page,
                borderRadius: 8,
                padding: "10px 12px",
                fontFamily: "monospace",
                fontSize: "0.75rem",
                color: "#333",
                wordBreak: "break-all",
                marginBottom: 12,
              }}
            >
              {joinUrl}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => void navigator.clipboard.writeText(joinUrl)}
                style={btnSecondary}
              >
                Copy link
              </button>
              <button
                onClick={() => {
                  window.location.href = `/team/${teamId}`;
                }}
                style={btnPrimary}
              >
                View team
              </button>
            </div>
          </>
        )}

        <div style={{ marginTop: 12 }}>
          <a href="/" style={backLink}>
            Back
          </a>
        </div>
      </div>
    </div>
  );
}
