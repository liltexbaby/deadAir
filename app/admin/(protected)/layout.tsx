import Link from 'next/link';
import type { ReactNode } from 'react';
import { requireAdmin } from '@/lib/dal';
import { signOut } from '@/app/actions/auth';

/**
 * The authorization boundary for every admin page. proxy.ts only does an
 * optimistic cookie check; this is the one that actually verifies the JWT and
 * the allowlist.
 */
export default async function ProtectedAdminLayout({ children }: { children: ReactNode }) {
  const { user } = await requireAdmin();

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <header className="flex items-baseline justify-between border-b border-white/10 pb-4">
        <div className="flex items-baseline gap-6">
          <Link
            href="/admin"
            className="font-mono text-xs uppercase tracking-[0.25em] text-white/90"
          >
            deadAir admin
          </Link>
          <nav className="flex items-baseline gap-5">
            {[
              ['/admin', 'releases'],
              ['/admin/artists', 'artists'],
              ['/admin/live', 'live'],
              ['/admin/settings', 'contact'],
            ].map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 hover:text-white/80 transition-colors"
              >
                {label}
              </Link>
            ))}
          </nav>
          <Link
            href="/"
            className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/25 hover:text-white/70 transition-colors"
          >
            view site
          </Link>
        </div>

        <form action={signOut} className="flex items-baseline gap-4">
          <span className="font-mono text-[10px] text-white/35">{user.email}</span>
          <button
            type="submit"
            className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 hover:text-white/80 transition-colors cursor-pointer"
          >
            sign out
          </button>
        </form>
      </header>

      <main className="pt-8">{children}</main>
    </div>
  );
}
