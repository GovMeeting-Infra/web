export class ApiError extends Error {
  status: number;
  /**
   * A machine-readable reason, where the endpoint supplies one. Lets a caller
   * branch on why a request failed without matching on the message, which
   * breaks silently the moment the wording is improved.
   */
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

function normalizeMessage(message: unknown, fallback: string): string {
  if (Array.isArray(message)) return message.join(', ');
  if (typeof message === 'string') return message;
  return fallback;
}

/**
 * Messages that are true but were written for a log, not a person.
 *
 * Callers render `error.message` straight into the page, so a guard's
 * "No user in request" — the single most common failure in daily use, because
 * it is what an elapsed session looks like — appeared in a red box on a screen
 * that still looked signed in. Replaced here rather than at each call site,
 * because there are ten of those and there will be more.
 *
 * Still used as the thrown message: the redirect below is what people actually
 * see, but a request that fails while the browser is on its way to the login
 * page should not surface as "Request failed (401)".
 */
const SESSION_LOST =
  'Your session has ended. Taking you to sign in…';

/** True when the response means "nobody is signed in", not "you may not". */
function isSessionLoss(raw: string, status: number): boolean {
  if (status === 401) return true;
  // 403 covers two different things: a genuinely forbidden action, and an
  // expired session that the guard sees as "nobody is asking". Only the second
  // one mentions a missing user, so the phrase is a reliable separator.
  return status === 403 && /no user in request/i.test(raw);
}

/**
 * Set once we have started navigating to the login page.
 *
 * A page typically has several queries in flight, so an elapsed session fails
 * all of them within a few milliseconds. Without this, each one would kick off
 * its own navigation and the last to land would decide the callbackUrl.
 */
let redirectingToLogin = false;

/**
 * Send the person to sign in rather than leave them reading about it.
 *
 * Telling someone their session had ended while the page they could no longer
 * use stayed on screen behind the message left them to work out for themselves
 * that every button was now dead. The address they were on is carried through
 * as callbackUrl so signing in returns them to it.
 *
 * Only for the authenticated area. Check-in, RSVP and the public calendar all
 * call this same helper without a session by design, and a guest who hits a 401
 * mid-check-in must not be thrown at an administrative login screen.
 */
function redirectToLogin(): void {
  if (typeof window === 'undefined' || redirectingToLogin) return;

  const { pathname, search, hash } = window.location;
  if (!pathname.startsWith('/administrative')) return;
  if (pathname.startsWith('/administrative/login')) return;

  redirectingToLogin = true;
  const callbackUrl = `${pathname}${search}${hash}`;
  window.location.href = `/administrative/login?reason=expired&callbackUrl=${encodeURIComponent(
    callbackUrl,
  )}`;
}

function humanMessage(raw: string, status: number): string {
  if (isSessionLoss(raw, status)) {
    redirectToLogin();
    return SESSION_LOST;
  }
  if (status >= 500) {
    return 'Something went wrong on our side. Try again in a moment.';
  }
  return raw;
}

/**
 * What a failed network call should say.
 *
 * A dropped connection never reaches ApiError at all — fetch rejects with a
 * TypeError whose message is "Failed to fetch" on Chrome and "Load failed" on
 * Safari. Both were rendered verbatim, including to citizens on the public
 * calendar and to attendees mid-check-in.
 */
export function isOffline(error: unknown): boolean {
  return !(error instanceof ApiError);
}

export function messageFor(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'You appear to be offline. Check your connection and try again.';
  }
  return fallback;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(path, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    let code: string | undefined;
    try {
      const body = await response.json();
      message = normalizeMessage(body.message, message);
      code = typeof body.code === 'string' ? body.code : undefined;
    } catch {
      // response had no JSON body
    }
    throw new ApiError(humanMessage(message, response.status), response.status, code);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

/** The server's own filename for the download, if it gave one. */
function filenameFrom(disposition: string | null): string | null {
  if (!disposition) return null;
  const match = /filename="?([^"]+)"?/i.exec(disposition);
  return match ? match[1] : null;
}

/**
 * Saves a file the API produces.
 *
 * A plain <a href> would be shorter — the Next rewrite forwards the session
 * cookie either way — but a refusal or a server error would then navigate the
 * user to a raw JSON error body instead of surfacing as a message on the page.
 */
export async function apiDownload(
  path: string,
  fallbackName: string,
): Promise<void> {
  const response = await fetch(path, { credentials: 'include' });

  if (!response.ok) {
    let message = `Download failed (${response.status})`;
    try {
      const body = await response.json();
      message = normalizeMessage(body.message, message);
    } catch {
      // response had no JSON body
    }
    // An export is usually the first thing tried after a long read, which is
    // exactly when a session has quietly elapsed.
    throw new ApiError(humanMessage(message, response.status), response.status);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download =
    filenameFrom(response.headers.get('Content-Disposition')) ?? fallbackName;
  link.click();
  URL.revokeObjectURL(url);
}
