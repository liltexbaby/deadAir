import { requireAdmin } from '@/lib/dal';
import { createClient } from '@/lib/supabase/server';
import SettingsForm from './SettingsForm';

export const dynamic = 'force-dynamic';

export default async function AdminSettings() {
  await requireAdmin();

  const supabase = await createClient();
  const { data } = await supabase.from('site_settings').select('*').eq('id', 1).maybeSingle();

  return (
    <>
      <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
        contact & site settings
      </h2>

      <div className="mt-6">
        <SettingsForm
          values={{
            about_text: data?.about_text ?? '',
            contact_email: data?.contact_email ?? '',
            merch_note: data?.merch_note ?? '',
            instagram_url: data?.instagram_url ?? '',
            youtube_url: data?.youtube_url ?? '',
            store_url: data?.store_url ?? '',
            credits: Array.isArray(data?.credits) ? (data.credits as string[]) : [],
          }}
        />
      </div>
    </>
  );
}
