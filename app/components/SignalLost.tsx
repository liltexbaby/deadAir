'use client';

import { useEffect, useState } from 'react';

/**
 * Shown in place of Next's "This page couldn't load" screen (app/error.tsx,
 * app/global-error.tsx). It doesn't wait for the visitor: it retries by
 * itself, then reloads the page once, and only asks for a tap if that fails
 * too.
 *
 * The usual causes are passing: a tab left open across a deploy, asking for
 * code files the new deploy no longer has (a reload fetches the new ones), or
 * a moment when the server couldn't be reached.
 *
 * Inline styles throughout: in the global case the site's stylesheet may be
 * the thing that failed to load.
 */
const RELOAD_KEY = 'da-error-reloaded';

const isStaleDeploy = (e: Error) =>
  /chunk|dynamically imported module|importing a module script|failed to fetch/i.test(`${e.name} ${e.message}`);

export default function SignalLost({ error, retry }: { error: Error; retry: () => void }) {
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    let reloadedRecently = false;
    try {
      const at = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
      reloadedRecently = Date.now() - at < 30_000;
    } catch {
      // Storage blocked: treat as not reloaded, but the timer below still caps it.
    }
    const reload = () => {
      if (reloadedRecently) return setStuck(true);
      try {
        sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
      } catch {}
      window.location.reload();
    };
    // Stale deploy: only a full reload can fix it. Otherwise try re-rendering
    // first, then reload if we're still here.
    if (isStaleDeploy(error)) {
      const t = setTimeout(reload, 600);
      return () => clearTimeout(t);
    }
    const t1 = setTimeout(retry, 1200);
    const t2 = setTimeout(reload, 4000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [error, retry]);

  return (
    <div
      role="alert"
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f6f3ee',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 10,
        letterSpacing: '0.25em',
        textTransform: 'uppercase',
        color: 'rgba(0,0,0,0.55)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span>signal lost.</span>
        {stuck ? (
          <button
            onClick={() => {
              try {
                sessionStorage.removeItem(RELOAD_KEY);
              } catch {}
              window.location.reload();
            }}
            style={{
              alignSelf: 'flex-start',
              border: 0,
              padding: '8px 12px',
              backgroundColor: 'rgba(0,0,0,0.8)',
              color: '#fff',
              font: 'inherit',
              letterSpacing: 'inherit',
              textTransform: 'inherit',
              cursor: 'pointer',
            }}
          >
            [ retune ]
          </button>
        ) : (
          <span style={{ color: 'rgba(0,0,0,0.4)' }}>re-establishing transmission…</span>
        )}
      </div>
    </div>
  );
}
