import { ApiRequestError, attachKey, fetchSession } from "@/lib/api";
import { clearSyncUuid, getSyncUuid } from "@/lib/storage";
import type { SessionAccount, Subject } from "@/types";

/**
 * Who the browser is acting as.
 *
 * Signed in, the subject is the account (`"me"`) and the server resolves the
 * account's sync keys from the cookie. Signed out, it falls back to a legacy
 * sync UUID in localStorage, which keeps pre-account setups working until
 * their owner logs in and the key is claimed by {@link loadSession}.
 */

let account: SessionAccount | null = null;

/** The signed-in account, or `null`. Valid after {@link loadSession} resolves. */
export function getAccount(): SessionAccount | null {
  return account;
}

/** `"me"` when signed in, else the legacy localStorage UUID, else `null`. */
export function getSubject(): Subject | null {
  return account ? "me" : getSyncUuid();
}

/** Whether at least one active sync key is connected to the current subject. */
export function hasSyncKey(): boolean {
  return account ? account.keys.some((k) => !k.disabled) : getSyncUuid() !== null;
}

/**
 * Fetch the session once at startup. If the user is signed in and still has a
 * legacy UUID in localStorage, claim that key for the account and drop it.
 * Never throws: failures leave the browser signed out.
 */
export async function loadSession(): Promise<void> {
  try {
    account = (await fetchSession()).account;
  } catch {
    account = null;
    return;
  }

  const legacy = getSyncUuid();
  if (!account || !legacy) return;

  try {
    await attachKey(legacy);
    clearSyncUuid();
    account = (await fetchSession()).account;
  } catch (err) {
    // 409: the key belongs to someone else's account. Keep it in storage so
    // nothing is lost silently; it is ignored while signed in.
    if (!(err instanceof ApiRequestError)) account = account ?? null;
  }
}

/** Re-read the session, e.g. after attaching a key. */
export async function refreshSession(): Promise<SessionAccount | null> {
  try {
    account = (await fetchSession()).account;
  } catch {
    /* keep the previous value */
  }
  return account;
}

/** Send the browser through GitHub sign-in and back to `next`. */
export function signIn(next: string = window.location.pathname): void {
  window.location.href = `/api/me/login?next=${encodeURIComponent(next)}`;
}
