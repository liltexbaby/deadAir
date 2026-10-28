'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { addGalleryItems } from '@/app/actions/gallery';
import { titleFromFilename, uploadImage } from '@/lib/uploadMedia';
import type { GalleryItemDTO } from '@/lib/queries';

const small = 'font-mono text-[10px] uppercase tracking-[0.2em]';

/**
 * Add pieces to the gallery: pick (or drop) any number of images; each is
 * compressed and uploaded from the browser, titled from its filename, and
 * added to the end. While the gallery is empty it also offers to import the
 * site's built-in set, so the current pieces become editable here.
 */
export default function GalleryUploader({ builtIn }: { builtIn: GalleryItemDTO[] | null }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);

  async function run(files: File[]) {
    const images = files.filter((f) => f.type.startsWith('image/'));
    if (images.length === 0) return;
    setBusy(true);
    setError(null);
    const uploaded = [];
    const failed: string[] = [];
    for (const [i, file] of images.entries()) {
      setStatus(`uploading ${i + 1} of ${images.length} — ${file.name}`);
      try {
        const img = await uploadImage(file, 'gallery');
        uploaded.push({ title: titleFromFilename(file.name), image_path: img.path, width: img.width, height: img.height });
      } catch (err) {
        failed.push(err instanceof Error ? err.message : file.name);
      }
    }
    if (uploaded.length) {
      setStatus('saving…');
      const res = await addGalleryItems(uploaded);
      if (res.error) failed.push(res.error);
    }
    setBusy(false);
    setStatus(uploaded.length ? `added ${uploaded.length}` : null);
    if (failed.length) setError(failed.join(' · '));
    if (input.current) input.current.value = '';
    router.refresh();
  }

  // The built-in set lives in the site's public folder; fetch each file and
  // send it through the same upload path.
  async function importBuiltIn() {
    if (!builtIn) return;
    const files: File[] = [];
    setBusy(true);
    for (const [i, item] of builtIn.entries()) {
      setStatus(`fetching ${i + 1} of ${builtIn.length}`);
      const blob = await fetch(item.src).then((r) => r.blob());
      const ext = item.src.split('.').pop() ?? 'jpg';
      files.push(new File([blob], `${item.title}.${ext}`, { type: blob.type }));
    }
    await run(files);
  }

  return (
    <div className="mt-5">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (!busy) void run([...e.dataTransfer.files]);
        }}
        className={`flex flex-wrap items-center gap-x-6 gap-y-3 border border-dashed px-5 py-5 transition-colors ${
          over ? 'border-white/50 bg-white/[0.04]' : 'border-white/15'
        }`}
      >
        <button
          type="button"
          disabled={busy}
          onClick={() => input.current?.click()}
          className={`${small} text-white/70 hover:text-white disabled:opacity-40 cursor-pointer`}
        >
          + add images
        </button>
        <span className="font-mono text-[10px] text-white/30">or drop them here · titles come from filenames</span>
        {builtIn && builtIn.length > 0 && (
          <button
            type="button"
            disabled={busy}
            onClick={importBuiltIn}
            className={`${small} ml-auto text-amber-300/80 hover:text-amber-200 disabled:opacity-40 cursor-pointer`}
          >
            import the current {builtIn.length} pieces
          </button>
        )}
        <input
          ref={input}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => void run([...(e.target.files ?? [])])}
        />
      </div>
      {status && <p className="mt-2 font-mono text-[10px] text-white/50">{status}</p>}
      {error && <p className="mt-2 font-mono text-[10px] text-red-400/80">{error}</p>}
    </div>
  );
}
