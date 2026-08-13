import { useState, type ChangeEvent, type JSX } from "react";
import { createTeam } from "@/lib/api";
import { COLORS, isUuid } from "@/lib/constants";
import { addTeamId } from "@/lib/storage";
import { backLink, btnPrimary, btnSecondary, card, inputStyle, pageWrap } from "@/styles";
import type { Uuid } from "@/types";

/** Extract a team id from a bare UUID or a pasted join/view link. */
function parseTeamId(input: string): Uuid | null {
  const trimmed = input.trim();
  if (isUuid(trimmed)) return trimmed;

  const match = /\/team\/([0-9a-f-]{36})/i.exec(trimmed);
  return match?.[1] && isUuid(match[1]) ? match[1] : null;
}

/** `/team` — create a team, or join an existing one by id/link. */
export function TeamCreatePage(): JSX.Element {
  const [name, setName] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [teamId, setCreatedTeamId] = useState<Uuid | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [joinInput, setJoinInput] = useState<string>("");
  const [joinError, setJoinError] = useState<string | null>(null);

  async function create(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const team = await createTeam(name.trim() || "My Team");
      setCreatedTeamId(team.id);
      addTeamId(team.id);
    } catch {
      setError("Could not create the team — please try again.");
    } finally {
      setLoading(false);
    }
  }

  function goToJoin(): void {
    const id = parseTeamId(joinInput);
    if (!id) {
      setJoinError("Paste a team ID or the join link a teammate shared with you.");
      return;
    }
    setJoinError(null);
    window.location.href = `/team/${id}/join`;
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

        {teamId === null && (
          <div
            style={{
              background: COLORS.page,
              borderRadius: 10,
              padding: "12px 14px",
              marginBottom: 20,
            }}
          >
            <div style={{ fontSize: "0.75rem", fontWeight: 700, marginBottom: 6 }}>
              Already have a team?
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={joinInput}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setJoinInput(event.target.value)
                }
                placeholder="Team ID or join link"
                style={{ ...inputStyle, marginTop: 0, flex: 1 }}
              />
              <button onClick={goToJoin} style={btnSecondary}>
                Join
              </button>
            </div>
            {joinError && (
              <div style={{ fontSize: "0.72rem", color: COLORS.bad, marginTop: 6 }}>
                {joinError}
              </div>
            )}
          </div>
        )}

        {teamId === null || joinUrl === null ? (
          <>
            {teamId === null && (
              <div
                style={{
                  fontSize: "0.7rem",
                  color: COLORS.faint,
                  marginBottom: 10,
                  fontWeight: 600,
                }}
              >
                Or create a new one
              </div>
            )}
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
