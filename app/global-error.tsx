'use client';

import SignalLost from './components/SignalLost';

/** Errors in the root layout itself. Replaces it, so it brings its own html/body. */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, backgroundColor: '#f6f3ee' }}>
        <title>deadAir</title>
        <SignalLost error={error} retry={unstable_retry} />
      </body>
    </html>
  );
}
