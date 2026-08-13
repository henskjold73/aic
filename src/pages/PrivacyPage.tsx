import type { CSSProperties, JSX } from "react";
import { COLORS, isWindows } from "@/lib/constants";
import { backLink, card, pageWrap } from "@/styles";

const mono: CSSProperties = {
  fontFamily: "monospace",
  fontSize: "0.78rem",
  background: COLORS.page,
  borderRadius: 6,
  padding: "8px 10px",
  color: "#444",
  wordBreak: "break-all",
  marginBottom: 4,
};

const paragraph: CSSProperties = {
  fontSize: "0.82rem",
  color: "#555",
  lineHeight: 1.6,
  margin: "0 0 8px",
};

const heading = (color: string, marginTop: number): CSSProperties => ({
  fontSize: "0.7rem",
  fontWeight: 700,
  color,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  marginTop,
  marginBottom: 12,
});

const SAMPLE_PAYLOAD =
  '{ "aiu": 1234.5, "month": "2026-08", "updated_at": "...", "input_tokens": ..., "output_tokens": ... }';

/** `/privacy` — plain-language description of what the sync script installs. */
export function PrivacyPage(): JSX.Element {
  const windows = isWindows();

  return (
    <div style={pageWrap}>
      <div style={{ ...card, maxWidth: 560 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>What's on your computer</div>
          <a href="/" style={backLink}>
            Back
          </a>
        </div>

        <p style={paragraph}>
          The sync script installs a background job that reads your local Copilot usage data
          and sends your monthly total to the app. Here's exactly what it does and where
          everything lives.
        </p>

        <div style={heading(COLORS.primary, 4)}>What is read</div>
        <p style={paragraph}>
          Only one file is ever read from your machine — the Copilot CLI session database:
        </p>
        <div style={mono}>~/.copilot/session-store.db</div>
        <p style={{ ...paragraph, marginTop: 6 }}>
          A single SQL query extracts your total <code>total_nano_aiu</code> for the current
          calendar month. No prompts, no code, no conversation content is ever accessed.
        </p>

        <div style={heading(COLORS.primary, 20)}>What is sent</div>
        <p style={paragraph}>
          A small JSON payload is POSTed to your Vercel deployment every 15 minutes:
        </p>
        <div style={mono}>{SAMPLE_PAYLOAD}</div>
        <p style={{ ...paragraph, marginTop: 6 }}>
          It is stored under your UUID path in Vercel Blob. No name, email, or identity is
          ever sent — only the UUID links the data to you, and only you know your UUID.
        </p>

        <div style={heading(COLORS.primary, 20)}>Files created on your machine</div>

        {windows ? (
          <>
            <p style={paragraph}>
              <strong>Config directory:</strong>
            </p>
            <div style={mono}>%APPDATA%\aic\uuid</div>
            <div style={{ ...mono, marginTop: 4 }}>%APPDATA%\aic\update-usage.ps1</div>
            <p style={{ ...paragraph, marginTop: 8 }}>
              <strong>Scheduled Task:</strong>
            </p>
            <div style={mono}>Task Scheduler → aic-usage-sync</div>
          </>
        ) : (
          <>
            <p style={paragraph}>
              <strong>Config directory:</strong>
            </p>
            <div style={mono}>~/.config/aic/uuid</div>
            <div style={{ ...mono, marginTop: 4 }}>~/.config/aic/update-usage.sh</div>
            <p style={{ ...paragraph, marginTop: 8 }}>
              <strong>macOS — launchd agent:</strong>
            </p>
            <div style={mono}>~/Library/LaunchAgents/com.aic.usage-sync.plist</div>
            <p style={{ ...paragraph, marginTop: 8 }}>
              <strong>Log file (macOS):</strong>
            </p>
            <div style={mono}>/tmp/aic-usage-sync.log</div>
            <p style={{ ...paragraph, marginTop: 8 }}>
              <strong>Linux — cron entry:</strong>
            </p>
            <div style={mono}>*/15 * * * * bash ~/.config/aic/update-usage.sh</div>
          </>
        )}

        <div style={heading(COLORS.bad, 20)}>How to remove everything manually</div>

        {windows ? (
          <>
            <p style={paragraph}>
              <strong>1. Remove the scheduled task:</strong>
            </p>
            <div style={mono}>
              Unregister-ScheduledTask -TaskName "aic-usage-sync" -Confirm:$false
            </div>
            <p style={{ ...paragraph, marginTop: 8 }}>
              <strong>2. Delete the config folder:</strong>
            </p>
            <div style={mono}>Remove-Item -Recurse -Force "$env:APPDATA\aic"</div>
          </>
        ) : (
          <>
            <p style={paragraph}>
              <strong>macOS — stop and remove launchd agent:</strong>
            </p>
            <div style={mono}>
              launchctl unload ~/Library/LaunchAgents/com.aic.usage-sync.plist
            </div>
            <div style={{ ...mono, marginTop: 4 }}>
              rm ~/Library/LaunchAgents/com.aic.usage-sync.plist
            </div>
            <p style={{ ...paragraph, marginTop: 8 }}>
              <strong>Linux — remove cron entry:</strong>
            </p>
            <div style={mono}>crontab -l | grep -v "aic/update-usage.sh" | crontab -</div>
            <p style={{ ...paragraph, marginTop: 8 }}>
              <strong>Delete config files (macOS &amp; Linux):</strong>
            </p>
            <div style={mono}>rm -rf ~/.config/aic</div>
            <p style={{ ...paragraph, marginTop: 8 }}>
              <strong>Delete log file (macOS):</strong>
            </p>
            <div style={mono}>rm -f /tmp/aic-usage-sync.log</div>
          </>
        )}

        <p style={{ ...paragraph, marginTop: 12 }}>
          <strong>Clear browser storage:</strong> open your browser's developer tools →
          Application → Local Storage → delete all <code>aic_</code> keys, or clear
          everything for this site.
        </p>

        <div
          style={{
            marginTop: 20,
            padding: "10px 14px",
            background: COLORS.page,
            borderRadius: 8,
            fontSize: "0.75rem",
            color: "#888",
          }}
        >
          Or run the uninstall script which does all of the above automatically — see the
          README or the sync setup page.
        </div>
      </div>
    </div>
  );
}
