import { useState, type ChangeEvent, type JSX } from "react";
import { ApiRequestError, attachKey, joinTeam } from "@/lib/api";
import { COLORS, isUuid, syncCommands } from "@/lib/constants";
import { getAccount, hasSyncKey, signIn } from "@/lib/session";
import { addTeamId, getSyncUuid, setSyncUuid } from "@/lib/storage";
import { backLink, btnPrimary, card, inputStyle, monoBlock, pageWrap } from "@/styles";
import type { Uuid } from "@/types";

export interface TeamJoinPageProps {
  /** Team being joined, taken from the URL. */
  teamId: Uuid;
}

/** Validation and submission outcome for the join form. */
type JoinStatus = "bad_uuid" | "bad_name" | "key_taken" | "error" | "joined" | null;

const ERROR_MESSAGES: Record<Exclude<JoinStatus, "joined" | null>, string> = {
  bad_uuid: "Invalid UUID — run the install script to get yours.",
  bad_name: "Please enter your name.",
  key_taken: "That sync UUID is already linked to a different account.",
  error: "Something went wrong — check the team link is correct.",
};

const hintStyle = { fontSize: "0.7rem", color: COLORS.faint, marginBottom: 4 } as const;
const fieldStyle = {
  fontSize: "0.75rem",
  color: COLORS.muted,
  display: "block",
  marginBottom: 10,
} as const;

/** `/team/:id/join` — install instructions plus the name + UUID form. */
export function TeamJoinPage({ teamId }: TeamJoinPageProps): JSX.Element {
  const [name, setName] = useState<string>("");
  const account = getAccount();
  const [uuid, setUuid] = useState<string>(() => (account ? "" : (getSyncUuid() ?? "")));
  const [status, setStatus] = useState<JoinStatus>(null);
  const [teamName, setTeamName] = useState<string>("");

  async function submit(): Promise<void> {
    const trimmedUuid = uuid.trim();
    const trimmedName = name.trim();

    // Signed in with a key already attached, the UUID field can stay empty.
    const needsUuid = !account || trimmedUuid !== "" || !hasSyncKey();
    if (needsUuid && !isUuid(trimmedUuid)) {
      setStatus("bad_uuid");
      return;
    }
    if (!trimmedName) {
      setStatus("bad_name");
      return;
    }

    try {
      if (account) {
        if (trimmedUuid !== "") await attachKey(trimmedUuid);
        const result = await joinTeam(teamId, "me", trimmedName);
        setTeamName(result.team_name);
      } else {
        const result = await joinTeam(teamId, trimmedUuid, trimmedName);
        setTeamName(result.team_name);
        setSyncUuid(trimmedUuid);
      }
      setStatus("joined");
      addTeamId(teamId);
    } catch (err) {
      setStatus(err instanceof ApiRequestError && err.status === 409 ? "key_taken" : "error");
    }
  }

  if (status === "joined") {
    return (
      <div style={pageWrap}>
        <div style={card}>
          <div style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 8 }}>
            Joined {teamName}!
          </div>
          <div style={{ fontSize: "0.8rem", color: COLORS.muted, marginBottom: 16 }}>
            Your usage will appear in the team view as soon as your sync script runs.
          </div>
          <button
            onClick={() => {
              window.location.href = `/team/${teamId}`;
            }}
            style={btnPrimary}
          >
            View team
          </button>
        </div>
      </div>
    );
  }

  const { install } = syncCommands();
  const errorMessage = status === null ? null : ERROR_MESSAGES[status];

  return (
    <div style={pageWrap}>
      <div style={card}>
        <div style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 6 }}>Join team</div>
        <div style={{ fontSize: "0.8rem", color: COLORS.muted, marginBottom: 16 }}>
          First, install the sync script to get your UUID. Then enter your name and paste
          the UUID below.
        </div>

        <div style={hintStyle}>1. Run in your terminal</div>
        <div style={{ ...monoBlock, marginBottom: 16 }}>{install}</div>

        {!account && (
          <div style={{ ...hintStyle, marginBottom: 12 }}>
            <button
              type="button"
              onClick={() => signIn(window.location.pathname)}
              style={{ ...btnPrimary, marginBottom: 6 }}
            >
              Sign in with GitHub
            </button>
            <div>
              Optional, but it lets you use the same account on every browser and machine.
            </div>
          </div>
        )}

        <div style={hintStyle}>2. Enter your details</div>
        <label style={fieldStyle}>
          Your name
          <input
            value={name}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setName(event.target.value)}
            placeholder="e.g. Morgan"
            style={{ ...inputStyle, marginTop: 4 }}
          />
        </label>
        <label style={{ ...fieldStyle, marginBottom: 12 }}>
          Sync UUID{" "}
          <span style={{ color: COLORS.faint, fontWeight: 400 }}>
            {account && hasSyncKey()
              ? "(optional — your account already has a sync key)"
              : "(printed by the install script)"}
          </span>
          <input
            value={uuid}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setUuid(event.target.value)}
            placeholder="xxxxxxxx-xxxx-7xxx-xxxx-xxxxxxxxxxxx"
            style={{
              ...inputStyle,
              marginTop: 4,
              fontFamily: "monospace",
              fontSize: "0.8rem",
            }}
          />
        </label>

        {errorMessage && (
          <div style={{ fontSize: "0.75rem", color: COLORS.bad, marginBottom: 8 }}>
            {errorMessage}
          </div>
        )}

        <button onClick={() => void submit()} style={btnPrimary}>
          Join team
        </button>
        <div style={{ marginTop: 12 }}>
          <a href="/" style={backLink}>
            Back
          </a>
        </div>
      </div>
    </div>
  );
}
