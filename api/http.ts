import type { VercelRequest, VercelResponse } from "@vercel/node";

/** HTTP verbs this API uses. */
export type HttpMethod = "GET" | "POST" | "PATCH" | "OPTIONS";

/** RFC 4122 UUID matcher, shared with the frontend's validation. */
export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Narrow an unknown value to a well-formed UUID string. */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/**
 * Set permissive CORS headers and short-circuit preflight requests.
 *
 * @returns `true` when the request was an `OPTIONS` preflight and has already
 * been answered, meaning the caller should return immediately.
 */
export function applyCors(
  req: VercelRequest,
  res: VercelResponse,
  methods: readonly HttpMethod[],
): boolean {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", [...methods, "OPTIONS"].join(", "));
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return true;
  }
  return false;
}

/**
 * Read a single-valued query parameter. Vercel types these as
 * `string | string[]`, so array values are collapsed to their first element.
 */
export function queryParam(
  req: VercelRequest,
  key: string,
): string | undefined {
  const value = req.query[key];
  if (Array.isArray(value)) return value[0];
  return value;
}

/**
 * Parse a request body that Vercel may deliver pre-parsed or as a raw string.
 *
 * @returns the parsed object, or `null` when the body is absent or malformed.
 */
export function parseBody<T extends object>(req: VercelRequest): T | null {
  const raw: unknown = req.body;
  if (raw == null) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }
  if (typeof raw === "object") return raw as T;
  return null;
}

/** Extract a message from an unknown thrown value. */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return typeof err === "string" ? err : "unknown error";
}

/** Send a `{ error }` envelope with the given status code. */
export function fail(res: VercelResponse, status: number, error: string): void {
  res.status(status).json({ error });
}
