import * as THREE from 'three';
import type { Section } from '@/lib/sections';

/* ------------------------------------------
   CAMERA TRIMS
   Per-shot fine-tuning layered on top of the cam_* cameras baked into the GLB.
   Kept in code rather than Blender for the same reason as the HOME_* trims in
   ModelViewer: a re-export can't undo them, and they're tuned against the
   browser view, not Blender's viewport.

   Dial them in live with the tuner — run `npm run dev` and open the site with
   `?camtune` — then paste its "Copy values" output over CAMERA_TRIMS below.

   All moves are relative to the camera itself, applied before the dolly:
     right / up / forward  metres along the camera's own axes
     yaw / pitch / roll    degrees (yaw + = turn left, pitch + = tilt up,
                           roll + = rotate counter-clockwise)
     fov                   degrees added to the authored lens (+ = wider)
------------------------------------------ */

export type Shot = Section | 'home';

export interface CameraTrim {
  right: number;
  up: number;
  forward: number;
  yaw: number;
  pitch: number;
  roll: number;
  fov: number;
}

export const SHOTS: readonly Shot[] = [
  'home', 'catalog', 'live', 'store', 'contact', 'mgmt', 'gallery',
] as const;

export const ZERO_TRIM: CameraTrim = {
  right: 0, up: 0, forward: 0, yaw: 0, pitch: 0, roll: 0, fov: 0,
};

export const CAMERA_TRIMS: Record<Shot, CameraTrim> = {
  home: { ...ZERO_TRIM },
  catalog: { right: 0.49, up: -1.03, forward: -1.01, yaw: -10.5, pitch: 6.5, roll: -1.1, fov: 0 },
  live: { right: 0.41, up: -0.2, forward: 0.07, yaw: -0.6, pitch: 3.7, roll: 0, fov: 0 },
  store: { right: 0.91, up: 0.07, forward: 0, yaw: 15.5, pitch: 0, roll: 0, fov: 0 },
  contact: { right: 0.12, up: 0, forward: -0.58, yaw: 0, pitch: 0, roll: 0, fov: 0 },
  mgmt: { right: 0.53, up: -0.01, forward: 0.59, yaw: 20, pitch: 0, roll: 4.9, fov: 0 },
  gallery: { right: 0.88, up: 0.04, forward: 0, yaw: 14.5, pitch: 0, roll: 0, fov: 0 },
};


// What the rig actually reads each frame. Starts as a copy of CAMERA_TRIMS; the
// tuner writes into it directly so edits show without a React re-render.
export const liveTrims: Record<Shot, CameraTrim> = Object.fromEntries(
  SHOTS.map((s) => [s, { ...CAMERA_TRIMS[s] }]),
) as Record<Shot, CameraTrim>;

const offset = new THREE.Vector3();
const euler = new THREE.Euler(0, 0, 0, 'YXZ');
const turn = new THREE.Quaternion();
const D2R = Math.PI / 180;

/** Apply a shot's trim in place to a world-space camera pose. */
export function applyTrim(shot: Shot, pos: THREE.Vector3, quat: THREE.Quaternion): void {
  const t = liveTrims[shot];
  // three.js cameras look down local -Z, so "forward" is negative Z.
  offset.set(t.right, t.up, -t.forward).applyQuaternion(quat);
  pos.add(offset);
  euler.set(t.pitch * D2R, t.yaw * D2R, t.roll * D2R);
  quat.multiply(turn.setFromEuler(euler));
}

/** Format trims as a paste-ready replacement for CAMERA_TRIMS. */
export function formatTrims(trims: Record<Shot, CameraTrim>): string {
  const n = (v: number) => String(Math.round(v * 1000) / 1000);
  const lines = SHOTS.map((s) => {
    const t = trims[s];
    const keys = Object.keys(ZERO_TRIM) as (keyof CameraTrim)[];
    if (keys.every((k) => t[k] === 0)) return `  ${s}: { ...ZERO_TRIM },`;
    return `  ${s}: { ${keys.map((k) => `${k}: ${n(t[k])}`).join(', ')} },`;
  });
  return `export const CAMERA_TRIMS: Record<Shot, CameraTrim> = {\n${lines.join('\n')}\n};\n`;
}
