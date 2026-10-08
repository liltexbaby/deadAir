/**
 * Checks that a GLB still carries everything the site's interactivity depends
 * on. Run after any re-export or optimization pass:
 *
 *   node scripts/verify-glb.mjs
 *
 * Optimizers can silently drop `extras`, merge named nodes, or prune skins —
 * the model still renders, it just stops being clickable. Catching that here is
 * much cheaper than noticing it in a browser later.
 */

import { readFileSync, existsSync } from 'node:fs';

const CAMERAS = ['home', 'catalog', 'live', 'store', 'mgmt', 'gallery', 'contact'];
const HITS = ['live', 'contact', 'gallery', 'store', 'mgmt', 'catalog'];
const FIXTURES = [
  'Cube.050', 'lights.004', 'lights.005', 'lights.006',
  'Cube.052', 'Plane.019', 'Plane.020', 'Cylinder.005',
  // spotlight beams (LightBeams). Plane.011 is hidden in the artist's viewport,
  // so it only survives a visible-only export from DA_fixed6.blend onward.
  'Plane.011', 'Plane.014', 'Plane.015',
];

function parse(path) {
  const buf = readFileSync(path);
  return JSON.parse(buf.slice(20, 20 + buf.readUInt32LE(12)).toString('utf8'));
}

let failed = false;

for (const file of ['public/DA.glb', 'public/DA.mobile.glb']) {
  if (!existsSync(file)) {
    console.log(`\n${file}: not present — skipping`);
    continue;
  }

  const j = parse(file);
  const names = new Set(j.nodes.map((n) => n.name).filter(Boolean));
  const hits = j.nodes.filter((n) => n.name?.startsWith('hit_'));
  const sizeMB = (readFileSync(file).length / 1048576).toFixed(1);

  const checks = [
    ['cameras', CAMERAS.every((s) => names.has(`cam_${s}`)), `${CAMERAS.filter((s) => names.has(`cam_${s}`)).length}/7`],
    ['hit proxies', HITS.every((s) => names.has(`hit_${s}`)), `${hits.length}/6`],
    ['hit extras', hits.length === 6 && hits.every((n) => n.extras?.section), `${hits.filter((n) => n.extras?.section).length}/6`],
    ['light/shader fixtures', FIXTURES.every((f) => names.has(f)), `${FIXTURES.filter((f) => names.has(f)).length}/${FIXTURES.length}`],
    ['skins', (j.skins?.length ?? 0) === 4, String(j.skins?.length ?? 0)],
    ['animations', (j.animations?.length ?? 0) === 21, String(j.animations?.length ?? 0)],
  ];

  console.log(`\n${file}  (${sizeMB} MB)`);
  for (const [label, ok, detail] of checks) {
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label.padEnd(22)} ${detail}`);
    if (!ok) failed = true;
  }
}

console.log(failed ? '\nFAILED — do not ship this build.\n' : '\nAll checks passed.\n');
process.exit(failed ? 1 : 0);
