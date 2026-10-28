'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

/**
 * Last-resort error page, shown when the root layout itself fails
 *
 * It replaces the whole document, so the app's stylesheet and theme tokens
 * may not be loaded. Styles are inline and neutral, and the support link is a
 * plain anchor rather than next/link.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          boxSizing: 'border-box',
          background: '#fafafa',
          color: '#111111',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '420px',
            padding: '24px',
            borderRadius: '12px',
            border: '1px solid #e5e5e5',
            background: '#ffffff',
            textAlign: 'center',
          }}
        >
          <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 500 }}>Something went wrong</h1>
          <p style={{ margin: '8px 0 0', fontSize: '14px', lineHeight: 1.5, color: '#666666' }}>
            The page could not be loaded. Please try again, or contact support if it keeps happening.
          </p>
          <div style={{ marginTop: '24px', display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={reset}
              style={{
                height: '44px',
                padding: '0 16px',
                borderRadius: '8px',
                border: 'none',
                background: '#111111',
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
            <a
              href="/platform/support"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                height: '44px',
                padding: '0 16px',
                borderRadius: '8px',
                border: '1px solid #e5e5e5',
                color: '#111111',
                fontSize: '14px',
                fontWeight: 500,
                textDecoration: 'none',
              }}
            >
              Contact support
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
