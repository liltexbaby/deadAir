'use client';

import SignalLost from './components/SignalLost';

/** Any error under the root layout: the site's own screen, recovering by itself. */
export default function Error({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return <SignalLost error={error} retry={unstable_retry} />;
}
