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
    throw new ApiError(message, response.status, code);
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
    throw new ApiError(message, response.status);
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
