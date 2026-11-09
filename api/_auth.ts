import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fail } from "./http";

/**
 * Stateless signed-cookie sessions.
 *
 * The cookie is `base64url(JSON{a: accountId, e: expiresAtSeconds}).hmac`.
 * Because nothing is stored server-side, a session cannot be revoked before it
 * expires; rotating `SESSION_SECRET` logs everyone out.
 *
 * Files starting with `_` are not deployed as Vercel functions.
 */

export const SESSION_COOKIE = "aic_session";
export const OAUTH_STATE_COOKIE = "aic_oauth_state";
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

interface SessionPayload {
  /** Account id. */
  a: string;
  /** Expiry, seconds since the epoch. */
  e: number;
}

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error("SESSION_SECRET must be set to a random string of at least 32 characters");
  }
  return value;
}

function sign(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

/** Parse a `Cookie` header into a name → value map. */
export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    const name = part.slice(0, index).trim();
    if (name) out[name] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return out;
}

/** True when the request arrived over plain HTTP on a local dev host. */
function isLocal(req: VercelRequest): boolean {
  const host = String(req.headers["x-forwarded-host"] ?? req.headers.host ?? "");
  return /^(localhost|127\.0\.0\.1|\[::1\])(:|$)/.test(host);
}

function cookie(
  req: VercelRequest,
  name: string,
  value: string,
  maxAgeSeconds: number,
  path: string,
): string {
  const attrs = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${path}`,
    `Max-Age=${maxAgeSeconds}`,
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (!isLocal(req)) attrs.push("Secure");
  return attrs.join("; ");
}

/** Append a `Set-Cookie` header without clobbering earlier ones. */
function addSetCookie(res: VercelResponse, value: string): void {
  const existing = res.getHeader("Set-Cookie");
  const list = Array.isArray(existing) ? existing : existing ? [String(existing)] : [];
  res.setHeader("Set-Cookie", [...list, value]);
}

export function startSession(req: VercelRequest, res: VercelResponse, accountId: string): void {
  const payload: SessionPayload = {
    a: accountId,
    e: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  addSetCookie(res, cookie(req, SESSION_COOKIE, `${body}.${sign(body)}`, SESSION_TTL_SECONDS, "/"));
}

export function endSession(req: VercelRequest, res: VercelResponse): void {
  addSetCookie(res, cookie(req, SESSION_COOKIE, "", 0, "/"));
}

/** The account id in a valid, unexpired session cookie, or `null`. */
export function sessionAccountId(req: VercelRequest): string | null {
  const raw = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (!raw) return null;
  const dot = raw.indexOf(".");
  if (dot < 0) return null;

  const body = raw.slice(0, dot);
  const given = Buffer.from(raw.slice(dot + 1));
  const expected = Buffer.from(sign(body));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (typeof payload.a !== "string" || typeof payload.e !== "number") return null;
    return payload.e > Date.now() / 1000 ? payload.a : null;
  } catch {
    return null;
  }
}

/** Require a session; replies 401 and returns `null` when there is none. */
export function requireAccount(req: VercelRequest, res: VercelResponse): string | null {
  const accountId = sessionAccountId(req);
  if (!accountId) {
    fail(res, 401, "not signed in");
    return null;
  }
  return accountId;
}

// ── OAuth state ───────────────────────────────────────────────────

/** Begin an OAuth round trip: remember a random state and the return path. */
export function beginOAuthState(req: VercelRequest, res: VercelResponse, next: string): string {
  const state = randomBytes(16).toString("hex");
  addSetCookie(
    res,
    cookie(req, OAUTH_STATE_COOKIE, `${state}|${encodeURIComponent(next)}`, 600, "/api/me"),
  );
  return state;
}

/**
 * Check the callback's `state` against the cookie, clear it, and return the
 * path to send the user back to — or `null` if the state does not match.
 */
export function finishOAuthState(
  req: VercelRequest,
  res: VercelResponse,
  state: string | undefined,
): string | null {
  const raw = parseCookies(req.headers.cookie)[OAUTH_STATE_COOKIE];
  addSetCookie(res, cookie(req, OAUTH_STATE_COOKIE, "", 0, "/api/me"));
  if (!raw || !state) return null;

  const bar = raw.indexOf("|");
  if (bar < 0) return null;
  const expected = Buffer.from(raw.slice(0, bar));
  const given = Buffer.from(state);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  return safeNextPath(decodeURIComponent(raw.slice(bar + 1)));
}

/** Only same-site absolute paths are valid post-login destinations. */
export function safeNextPath(value: string | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  return value;
}

/** Public origin of this deployment, used to build the OAuth redirect URI. */
export function appOrigin(req: VercelRequest): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const host = String(req.headers["x-forwarded-host"] ?? req.headers.host ?? "");
  return `${isLocal(req) ? "http" : "https"}://${host}`;
}
