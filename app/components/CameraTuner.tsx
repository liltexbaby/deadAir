'use client';

import { useState } from 'react';
import {
  CAMERA_TRIMS,
  SHOTS,
  ZERO_TRIM,
  formatTrims,
  liveTrims,
  type CameraTrim,
  type Shot,
} from './cameraTrims';

/*
  Dev-only panel for dialling in CAMERA_TRIMS against the real browser view.
  Mounted by ModelViewer only in development with `?camtune` in the URL.

  Edits write straight into `liveTrims`, which the camera rig reads every frame.
  They're also kept in localStorage so a reload (or a hot reload) doesn't lose
  work in progress — but nothing is permanent until the "Copy values" output is
  pasted into cameraTrims.ts.
*/

const STORAGE_KEY = 'deadair:camtune';

const CONTROLS: { key: keyof CameraTrim; label: string; min: number; max: number; step: number; unit: string }[] = [
  { key: 'right', label: 'Right', min: -5, max: 5, step: 0.01, unit: 'm' },
  { key: 'up', label: 'Up', min: -5, max: 5, step: 0.01, unit: 'm' },
  { key: 'forward', label: 'Forward', min: -10, max: 10, step: 0.01, unit: 'm' },
  { key: 'yaw', label: 'Yaw', min: -30, max: 30, step: 0.1, unit: '°' },
  { key: 'pitch', label: 'Pitch', min: -30, max: 30, step: 0.1, unit: '°' },
  { key: 'roll', label: 'Roll', min: -30, max: 30, step: 0.1, unit: '°' },
  { key: 'fov', label: 'Lens (FOV)', min: -20, max: 20, step: 0.1, unit: '°' },
];

function snapshot(): Record<Shot, CameraTrim> {
  return Object.fromEntries(SHOTS.map((s) => [s, { ...liveTrims[s] }])) as Record<Shot, CameraTrim>;
}

// Restore work in progress from a previous load. Safe to touch localStorage
// here: ModelViewer only mounts the tuner client-side, after hydration.
function restore(): Record<Shot, CameraTrim> {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as
      | Partial<Record<Shot, Partial<CameraTrim>>>
      | null;
    if (saved) SHOTS.forEach((s) => Object.assign(liveTrims[s], saved[s]));
  } catch {
    // storage unavailable or corrupt — start from the code values
  }
  return snapshot();
}

export default function CameraTuner({ shot }: { shot: Shot }) {
  const [trims, setTrims] = useState(restore);
  const [copied, setCopied] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const write = (next: Record<Shot, CameraTrim>) => {
    SHOTS.forEach((s) => Object.assign(liveTrims[s], next[s]));
    setTrims(next);
    setCopied(false);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // non-fatal: edits still apply live
    }
  };

  const set = (key: keyof CameraTrim, value: number) => {
    if (Number.isNaN(value)) return;
    write({ ...trims, [shot]: { ...trims[shot], [key]: value } });
  };

  const copy = async () => {
    const text = formatTrims(trims);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // Clipboard can be blocked; fall back to the console.
      console.log(text);
      setCopied(false);
      alert('Clipboard blocked — values printed to the browser console.');
    }
  };

  const t = trims[shot];
  const dirty = (s: Shot) =>
    (Object.keys(ZERO_TRIM) as (keyof CameraTrim)[]).some((k) => trims[s][k] !== CAMERA_TRIMS[s][k]);

  return (
    <div className="fixed bottom-16 left-4 z-50 w-72 rounded-md border border-white/15 bg-black/80 p-3 font-mono text-[11px] text-white/85 backdrop-blur">
      <div className="flex items-center justify-between">
        <span className="uppercase tracking-widest text-white/60">
          Camera · <span className="text-white">{shot}</span>
          {dirty(shot) && <span className="text-amber-300"> *</span>}
        </span>
        <button onClick={() => setCollapsed((c) => !c)} className="text-white/50 hover:text-white">
          {collapsed ? 'show' : 'hide'}
        </button>
      </div>

      {!collapsed && (
        <>
          <p className="mt-1 text-white/40">Switch shots with the site nav. * = differs from code.</p>

          <div className="mt-3 space-y-2">
            {CONTROLS.map((c) => (
              <label key={c.key} className="block">
                <div className="flex items-center justify-between">
                  <span>{c.label}</span>
                  <span className="flex items-center gap-1">
                    <input
                      type="number"
                      step={c.step}
                      value={t[c.key]}
                      onChange={(e) => set(c.key, parseFloat(e.target.value))}
                      className="w-16 rounded bg-white/10 px-1 text-right outline-none"
                    />
                    <span className="w-3 text-white/40">{c.unit}</span>
                  </span>
                </div>
                <input
                  type="range"
                  min={c.min}
                  max={c.max}
                  step={c.step}
                  value={t[c.key]}
                  onChange={(e) => set(c.key, parseFloat(e.target.value))}
                  className="w-full accent-white"
                />
              </label>
            ))}
          </div>

          <div className="mt-3 flex gap-2">
            <button
              onClick={() => write({ ...trims, [shot]: { ...CAMERA_TRIMS[shot] } })}
              className="flex-1 rounded border border-white/20 py-1 hover:bg-white/10"
              title="Back to the values saved in cameraTrims.ts"
            >
              Revert shot
            </button>
            <button
              onClick={() => write({ ...trims, [shot]: { ...ZERO_TRIM } })}
              className="flex-1 rounded border border-white/20 py-1 hover:bg-white/10"
              title="Remove all trim from this shot"
            >
              Zero shot
            </button>
          </div>
          <button
            onClick={copy}
            className="mt-2 w-full rounded bg-white py-1 font-semibold text-black hover:bg-white/90"
          >
            {copied ? 'Copied — paste into cameraTrims.ts' : 'Copy values (all shots)'}
          </button>
        </>
      )}
    </div>
  );
}
