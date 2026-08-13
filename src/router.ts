import type { Uuid } from "@/types";

/** A resolved route for the current URL. */
export type Route =
  | { kind: "calendar"; openSyncModal: boolean }
  | { kind: "privacy" }
  | { kind: "report" }
  | { kind: "team-create" }
  | { kind: "team-join"; teamId: Uuid }
  | { kind: "team-view"; teamId: Uuid };

const TEAM_JOIN_RE = /^\/team\/([^/]+)\/join$/;
const TEAM_VIEW_RE = /^\/team\/([^/]+)$/;

/**
 * Map a pathname to a {@link Route}.
 *
 * The app has no router dependency — Vercel rewrites every non-API path to
 * `index.html` and this function does the rest.
 */
export function resolveRoute(pathname: string = window.location.pathname): Route {
  if (pathname === "/privacy") return { kind: "privacy" };
  if (pathname === "/report") return { kind: "report" };
  if (pathname === "/team") return { kind: "team-create" };

  const joinMatch = TEAM_JOIN_RE.exec(pathname);
  if (joinMatch?.[1]) return { kind: "team-join", teamId: joinMatch[1] };

  const viewMatch = TEAM_VIEW_RE.exec(pathname);
  if (viewMatch?.[1]) return { kind: "team-view", teamId: viewMatch[1] };

  return { kind: "calendar", openSyncModal: pathname === "/auto" };
}
