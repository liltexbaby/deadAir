'use client';

import { useActionState, useState } from 'react';
import type { ActionState } from '@/app/actions/types';
import { uploadImage, type UploadedImage } from '@/lib/uploadMedia';

const inputCls =
  'mt-1.5 w-full bg-transparent border-b border-white/15 focus:border-white/50 outline-none py-1.5 font-mono text-xs text-white/90 transition-colors';
const labelCls = 'block font-mono text-[10px] uppercase tracking-[0.2em] text-white/40';

export default function GalleryItemForm({
  values,
  action,
}: {
  values: { title: string; caption: string; published: boolean; imageUrl: string };
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const [state, formAction, pending] = useActionState(action, {} as ActionState);
  // A replacement image is uploaded as soon as it's picked; the form then just
  // carries its path.
  const [replacement, setReplacement] = useState<(UploadedImage & { preview: string }) | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fe = state.fieldErrors ?? {};

  async function pick(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const img = await uploadImage(file, 'gallery');
      setReplacement({ ...img, preview: URL.createObjectURL(file) });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'upload failed');
    }
    setUploading(false);
  }

  return (
    <form action={formAction} className="grid max-w-3xl gap-8 sm:grid-cols-[16rem_1fr]">
      <div>
        {/* eslint-disable-next-line @next/next/no-img-element -- local preview of a just-picked file */}
        <img
          src={replacement?.preview ?? values.imageUrl}
          alt=""
          className="aspect-square w-full border border-white/10 bg-white/[0.03] object-contain"
        />
        <label className="mt-3 inline-block cursor-pointer font-mono text-[10px] uppercase tracking-[0.2em] text-white/50 hover:text-white">
          {uploading ? 'uploading…' : 'replace image'}
          <input type="file" accept="image/*" hidden disabled={uploading} onChange={(e) => pick(e.target.files?.[0])} />
        </label>
        {uploadError && <p className="mt-1 font-mono text-[10px] text-red-400/80">{uploadError}</p>}
        {replacement && (
          <>
            <input type="hidden" name="image_path" value={replacement.path} />
            {replacement.width && <input type="hidden" name="width" value={replacement.width} />}
            {replacement.height && <input type="hidden" name="height" value={replacement.height} />}
          </>
        )}
      </div>

      <div>
        <label htmlFor="title" className={labelCls}>
          title
        </label>
        <input id="title" name="title" defaultValue={values.title} className={inputCls} />
        {fe.title && <p className="mt-1 font-mono text-[10px] text-red-400/80">{fe.title[0]}</p>}

        <label htmlFor="caption" className={`${labelCls} mt-6`}>
          caption <span className="text-white/20">(optional)</span>
        </label>
        <textarea id="caption" name="caption" rows={3} defaultValue={values.caption} className={`${inputCls} resize-none`} />

        <label className="mt-6 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">
          <input type="checkbox" name="published" defaultChecked={values.published} className="accent-white" />
          shown on the site
        </label>

        <div className="mt-8 flex items-center gap-5">
          <button
            type="submit"
            disabled={pending || uploading}
            className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/80 hover:text-white disabled:opacity-40 cursor-pointer"
          >
            {pending ? 'saving…' : 'save changes'}
          </button>
          {state.ok && <span className="font-mono text-[10px] text-emerald-400/80">saved</span>}
          {state.error && <span className="font-mono text-[10px] text-red-400/80">{state.error}</span>}
        </div>
      </div>
    </form>
  );
}
