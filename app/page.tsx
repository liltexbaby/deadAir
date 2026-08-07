import SiteShell from './components/SiteShell';
import { getSiteContent } from '@/lib/queries';

/**
 * Server Component: reads content from Supabase and hands it to the client
 * shell. Cache Components is not enabled on this project, so route segment
 * config is still the supported way to set revalidation (with it enabled,
 * `revalidate` is removed in favour of "use cache").
 *
 * Admin writes call revalidatePath('/') so edits don't wait out this window.
 */
export const revalidate = 300;

export default async function Home() {
  const content = await getSiteContent();

  return <SiteShell content={content} />;
}
