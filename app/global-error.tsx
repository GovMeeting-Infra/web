'use client';

/**
 * Last-resort boundary. A global-error replaces the root layout entirely, so it
 * has to bring its own <html> and <body> and cannot rely on fonts, providers or
 * anything from globals.css being applied — styles are inline for that reason.
 *
 * Without this, an uncaught render error anywhere in the tree served Next's
 * "Application error: a client-side exception has occurred" on a government
 * domain, with no identity and no way back.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f6faff',
          color: '#11243d',
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        }}
      >
        <main style={{ maxWidth: '32rem', padding: '2rem', textAlign: 'center' }}>
          <p
            style={{
              margin: 0,
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: '#007236',
            }}
          >
            Government of Sierra Leone
          </p>
          <h1
            style={{
              margin: '0.75rem 0 0',
              fontSize: '1.5rem',
              fontWeight: 700,
              color: '#003580',
            }}
          >
            Something went wrong on our side
          </h1>
          <p style={{ margin: '0.75rem 0 0', color: '#475569', lineHeight: 1.6 }}>
            This is a fault in the service, not something you did. Try again, and
            if it keeps happening let your ministry&rsquo;s administrator know.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: '1.5rem',
              cursor: 'pointer',
              borderRadius: '999px',
              border: 'none',
              backgroundColor: '#003580',
              color: '#ffffff',
              padding: '0.7rem 1.5rem',
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
          >
            Try again
          </button>
          {/* The digest is the only handle support has on a production stack
              trace. Shown small rather than hidden, because "quote this code"
              is faster than "describe what you were doing". */}
          {error.digest && (
            <p style={{ margin: '1.25rem 0 0', fontSize: '12px', color: '#64748b' }}>
              Reference: {error.digest}
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
