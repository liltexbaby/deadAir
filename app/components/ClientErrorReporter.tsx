'use client';

import { useEffect, useState } from 'react';

/**
 * Surfaces uncaught errors on the page itself.
 *
 * An error boundary only catches what React throws during render. Things that
 * kill this app in practice — a WebGL context event, a failed decoder, an
 * unhandled promise rejection during asset load — never reach one. On a phone
 * there's no console to check, so without this a failure is indistinguishable
 * from "the page is just broken".
 *
 * Renders nothing when nothing has gone wrong.
 */
export default function ClientErrorReporter() {
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    const add = (msg: string) =>
      setErrors((prev) => (prev.includes(msg) ? prev : [...prev, msg].slice(0, 4)));

    const onError = (e: ErrorEvent) =>
      add(`${e.message}${e.filename ? ` — ${e.filename.split('/').pop()}:${e.lineno}` : ''}`);

    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason;
      add(`unhandled: ${r instanceof Error ? r.message : String(r)}`);
    };

    // WebGL dropping its context is a silent killer on mobile GPUs.
    const onContextLost = (e: Event) => {
      e.preventDefault();
      add('webgl context lost — the GPU dropped the scene (usually memory pressure)');
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    document.addEventListener('webglcontextlost', onContextLost, true);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
      document.removeEventListener('webglcontextlost', onContextLost, true);
    };
  }, []);

  if (errors.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[60] max-h-[45dvh] overflow-y-auto border-t border-red-500/30 bg-black/90 px-4 pt-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-red-400/80">
        client error
      </p>
      <ul className="mt-2 space-y-2">
        {errors.map((e, i) => (
          <li key={i} className="font-mono text-[10px] leading-relaxed text-white/60 break-words">
            {e}
          </li>
        ))}
      </ul>
    </div>
  );
}
