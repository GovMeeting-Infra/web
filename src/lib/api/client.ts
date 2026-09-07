import { reportReachable, reportUnreachable } from '@/lib/offline/connectivity';

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

/**
 * How long a request may hang before we give up on it.
 *
 * `fetch` has no timeout of its own, so until this existed a half-open
 * connection — a router mid-reboot, a captive portal, an uplink that dropped
 * without closing its sockets — left the promise neither resolving nor
 * rejecting for the operating system default, which runs to several minutes.
 * No catch block ran, no error was shown, and the Save button simply spun.
 * That is the single most common shape of "the internet is bad here", and it
 * was the one failure the app could not see.
 *
 * Everything downstream — the offline message, and later the write queue —
 * depends on the request actually rejecting, so this is load-bearing rather
 * than a nicety.
 */
export const REQUEST_TIMEOUT_MS = 15_000;

/** Downloads stream a whole file, so they get a longer leash than a JSON call. */
export const DOWNLOAD_TIMEOUT_MS = 60_000;

export interface ApiFetchOptions {
  /**
   * Whether this request may be deferred when the device is offline.
   *
   * Plumbing for the write queue: 'never' marks calls that must fail rather
   * than be replayed later — session probes, anything that emails people, and
   * anything whose meaning depends on the moment it runs. Nothing consumes
   * this yet; declaring it now keeps the call sites from having to be revisited.
   */
  offline?: 'auto' | 'never';
  /** Milliseconds before the request is abandoned. */
  timeoutMs?: number;
  /**
   * Whether a lost session should send the browser to the login page.
   *
   * Background work must not: a sync running while someone is mid-sentence
   * would navigate away from the page they are typing into. Such a caller sets
   * this false and reads the 401 off the thrown ApiError instead.
   */
  authRedirect?: boolean;
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
 * True when this error is the session having ended, whoever is asking.
 *
 * Exported so a caller that opted out of the redirect can still recognise the
 * case and act on it — the sync engine holds its queue and asks the person to
 * sign in rather than discarding their work.
 */
export function isSessionLossError(error: unknown): boolean {
  return error instanceof ApiError && isSessionLoss(error.message, error.status);
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

function humanMessage(
  raw: string,
  status: number,
  authRedirect: boolean,
): string {
  if (isSessionLoss(raw, status)) {
    if (authRedirect) redirectToLogin();
    return SESSION_LOST;
  }
  if (status >= 500) {
    return 'Something went wrong on our side. Try again in a moment.';
  }
  return raw;
}

/**
 * A signal that fires on our timeout, on the caller's own signal, or on
 * neither, whichever comes first.
 *
 * `AbortSignal.timeout` and `AbortSignal.any` would say this in two lines, but
 * both are recent and this app runs on whatever Android handset a ministry
 * already owns. `AbortController` is everywhere, so it is built by hand.
 *
 * The returned `done` must be called or the timer keeps the callback — and the
 * closure around it — alive for the full timeout after the request has settled.
 */
function abortAfter(
  ms: number,
  external?: AbortSignal | null,
): { signal: AbortSignal; done: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new DOMException('The request timed out', 'TimeoutError'));
  }, ms);

  const forward = () => controller.abort(external?.reason);
  if (external) {
    if (external.aborted) forward();
    else external.addEventListener('abort', forward, { once: true });
  }

  return {
    signal: controller.signal,
    done: () => {
      clearTimeout(timer);
      external?.removeEventListener('abort', forward);
    },
  };
}

/** True when the request gave up waiting rather than being answered. */
export function isTimeout(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'TimeoutError';
}

/**
 * What a failed network call should say.
 *
 * A dropped connection never reaches ApiError at all — fetch rejects with a
 * TypeError whose message is "Failed to fetch" on Chrome and "Load failed" on
 * Safari. Both were rendered verbatim, including to citizens on the public
 * calendar and to attendees mid-check-in. A timed-out request lands here too:
 * it is the same problem to the person holding the phone.
 */
export function isOffline(error: unknown): boolean {
  return !(error instanceof ApiError);
}

export function messageFor(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message;
  if (isTimeout(error)) {
    return 'That took too long to reach the service. Your connection may be down — nothing you entered has been lost.';
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'You appear to be offline. Check your connection and try again.';
  }
  return fallback;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
  opts: ApiFetchOptions = {},
): Promise<T> {
  const { signal, done } = abortAfter(
    opts.timeoutMs ?? REQUEST_TIMEOUT_MS,
    options.signal,
  );

  let response: Response;
  try {
    response = await fetch(path, {
      ...options,
      credentials: 'include',
      signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  } catch (error) {
    // Never arrived. This — not navigator.onLine — is what the app treats as
    // being offline, because a request that failed to travel is the only
    // reliable evidence there is.
    reportUnreachable();
    throw error;
  } finally {
    done();
  }

  // Answered at all, so the connection works. A refusal counts: it made the
  // round trip, which is the whole question here.
  reportReachable();

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
    throw new ApiError(
      humanMessage(message, response.status, opts.authRedirect !== false),
      response.status,
      code,
    );
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
 *
 * Always needs a live connection: an export is a server-side query, so there is
 * nothing to defer and nothing useful in a cached copy.
 */
export async function apiDownload(
  path: string,
  fallbackName: string,
): Promise<void> {
  const { signal, done } = abortAfter(DOWNLOAD_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(path, { credentials: 'include', signal });
  } catch (err) {
    done();
    // Said plainly, because "Load failed" reads like the file was corrupt
    // rather than like the connection was.
    if (isOffline(err)) {
      throw new Error(
        'You need a connection to download this. Try again once you are back online.',
      );
    }
    throw err;
  }
  done();

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
    throw new ApiError(humanMessage(message, response.status, true), response.status);
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
