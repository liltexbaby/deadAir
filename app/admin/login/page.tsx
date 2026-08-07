'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const ERRORS: Record<string, string> = {
  not_authorized: 'that address is not on the admin list.',
  invalid_link: 'that link expired or was already used. request a new one.',
  missing_code: 'sign-in link was malformed. request a new one.',
};

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Read once on render rather than useSearchParams, which would require a
  // Suspense boundary here.
  const urlError =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('error')
      : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        // Don't let a typo silently create a brand new account.
        shouldCreateUser: false,
      },
    });

    setPending(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  const message = error ?? (urlError ? ERRORS[urlError] ?? urlError : null);

  return (
    <main className="min-h-screen bg-[#0b0b0c] flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="font-mono text-xs uppercase tracking-[0.25em] text-white/90">
          deadAir admin
        </h1>

        {sent ? (
          <p className="mt-6 font-mono text-xs text-white/60 leading-relaxed">
            check <span className="text-white/90">{email}</span> for a sign-in link.
            it expires shortly and can only be used once.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6">
            <label
              htmlFor="email"
              className="block font-mono text-[10px] uppercase tracking-[0.2em] text-white/40"
            >
              email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 w-full bg-transparent border-b border-white/20 focus:border-white/60 outline-none py-2 font-mono text-sm text-white/90 transition-colors"
            />

            <button
              type="submit"
              disabled={pending}
              className="mt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-white/60 hover:text-white disabled:opacity-40 transition-colors cursor-pointer"
            >
              {pending ? 'sending…' : 'send sign-in link'}
            </button>
          </form>
        )}

        {message && (
          <p className="mt-5 font-mono text-[10px] text-red-400/80 leading-relaxed">{message}</p>
        )}
      </div>
    </main>
  );
}
