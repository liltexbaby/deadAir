import { requireAdmin } from '@/lib/dal';
import { createClient } from '@/lib/supabase/server';
import { removeAdmin } from '@/app/actions/team';
import AddAdminForm from './AddAdminForm';

export const dynamic = 'force-dynamic';

const small = 'font-mono text-[10px] uppercase tracking-[0.2em]';

/** Who can sign in to this admin, and adding / removing people. */
export default async function AdminTeam() {
  const { user } = await requireAdmin();

  const supabase = await createClient();
  const { data: admins, error } = await supabase
    .from('admin_users')
    .select('user_id, email, created_at')
    .order('created_at', { ascending: true });

  return (
    <div className="max-w-2xl">
      <h2 className={`${small} text-white/40`}>team — {admins?.length ?? 0}</h2>
      <p className="mt-3 font-mono text-[11px] leading-relaxed text-white/45">
        Everyone here can sign in at <span className="text-white/70">/admin</span> with a link emailed to them — no
        passwords. Anyone not on this list is turned away, even with a valid link.
      </p>

      {error && <p className="mt-4 font-mono text-xs text-red-400/80">failed to load: {error.message}</p>}

      <ul className="mt-6 divide-y divide-white/10 border-y border-white/10">
        {(admins ?? []).map((a) => {
          const remove = removeAdmin.bind(null, a.user_id);
          const isMe = a.user_id === user.id;
          return (
            <li key={a.user_id} className="flex items-baseline gap-4 py-3">
              <span className="flex-1 font-mono text-xs text-white/85">{a.email}</span>
              {isMe ? (
                <span className={`${small} text-white/25`}>you</span>
              ) : (
                <form action={remove}>
                  <button className={`${small} text-red-400/60 hover:text-red-400 cursor-pointer`}>remove</button>
                </form>
              )}
            </li>
          );
        })}
      </ul>

      <AddAdminForm />
    </div>
  );
}
