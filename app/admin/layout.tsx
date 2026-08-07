import type { ReactNode } from 'react';

export const metadata = {
  title: 'deadAir admin',
};

/**
 * Plain shell only. The auth guard lives in (protected)/layout.tsx so that
 * /admin/login — which obviously cannot require a session — sits outside it.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-[#0b0b0c] text-white/90">{children}</div>;
}
