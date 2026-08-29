'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, useAnimations, Environment, ContactShadows } from '@react-three/drei';
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

import type { Section } from '@/lib/sections';
import { useCoarsePointer, useIsNarrow } from '@/lib/useCoarsePointer';

interface HitProxyUserData {
  section: Section;
  label: string;
  route: string;
  order: number;
}

type PointerEvent3D = THREE.Event & {
  object: THREE.Object3D;
  stopPropagation: () => void;
  /** R3F forwards the native pointer event, so we can tell touch from mouse. */
  pointerType?: string;
};

/* ==========================================
   🎨 ART DIRECTION CONTROLS
   ==========================================
   Adjust these values to customize the scene
*/

// MODEL SETTINGS
const MODEL_SCALE = 0.35;
// Desktop parks the tower left of centre so the right half stays clear for the
// panel. On mobile the panel is a full-width sheet instead, so that offset just
// pushes the tower off a narrow frustum — centre it there.
const MODEL_POSITION = [-10, -4, 0] as [number, number, number];
const MODEL_POSITION_MOBILE = [0, -3, 0] as [number, number, number];

// CAMERA FRAMING
// The Blender cameras were authored at 16:9. A phone in portrait is ~0.46, and
// three.js holds *vertical* FOV constant, so the horizontal view collapses to
// roughly 40% of the desktop framing and the tower leaves the frame. We
// compensate by widening FOV to preserve the horizontal composition instead.
const AUTHORED_ASPECT = 16 / 9;
const FOV_FALLBACK = 45;   // used if a cam_* node carries no fov
// Full horizontal compensation on a portrait phone works out at ~115deg, which
// "fits" everything but shrinks the tower to a speck. The tower is a tall
// subject in a tall viewport, so some horizontal crop of the surrounding scene
// is a better trade than losing the subject — hence a firm clamp.
const FOV_MAX = 62;

// HOME FRAMING TRIM
// cam_home's authored 44.1deg is a tight, slightly left-of-centre composition —
// correct in Blender's 16:9 viewport, but in a browser it reads as over-zoomed
// and off-axis. These trim the idle shot without touching the GLB, so a Blender
// re-export can't undo them.
//
// HOME_DOLLY > 1 backs the camera away from the tower, so it renders smaller.
//   This is a dolly, NOT a zoom: widening the lens instead would shrink the
//   tower too, but it also drove FOV into the FOV_MAX clamp on desktop and gave
//   everything off-axis a wide-angle stretch — the beacon sphere visibly ovalled.
//   Moving the camera back keeps the authored lens and its perspective intact.
// HOME_PAN_X > 0 slides the tower right, as a fraction of viewport width.
// HOME_PAN_Y > 0 slides it down, as a fraction of viewport height. Both shots
//   leave dead space under the base while the nav sits on the radio waves, so a
//   small drop buys clearance at the top for free.
//
// Values are measured off screenshots against the beacon (the tower's visual
// axis), not guessed — re-measure there if the Blender cameras ever move.
//
// Applied ONLY to the idle/home shot. The six section cameras keep their
// authored framing, and the rig eases between the two so entering a section
// doesn't pop.
const HOME_DOLLY = 1.5;
const HOME_PAN_X = 0.020;
const HOME_PAN_Y = 0.05;
// The six section shots are authored at 22.9deg — very tight close-ups that
// read as too close in a browser for the same reason cam_home did. They get the
// same pull-back so entering a section stays proportional to the idle shot.
const SECTION_DOLLY = 1.35;
// Portrait already hits the FOV_MAX clamp, which frames everything much wider
// than authored on its own (a 22.9deg section shot renders at 62deg there), so
// a further pull-back would push the subject away. Shift only on a phone.
const HOME_DOLLY_NARROW = 1.0;
const SECTION_DOLLY_NARROW = 1.0;
const HOME_PAN_X_NARROW = 0.063;
const HOME_PAN_Y_NARROW = 0.05;

// LIGHTING SETTINGS — dusk / overcast.
// Kept deliberately dim: the tower's own fixtures below are meant to read as
// the brightest things in frame, which they can't do against a bright HDRI.
const AMBIENT_LIGHT = 0.25;
const AMBIENT_COLOR = '#8fa3b0';        // cool overcast fill
const KEY_LIGHT_INTENSITY = 0.55;
const KEY_LIGHT_COLOR = '#b9c7d2';      // weak, low sun
const KEY_LIGHT_POSITION = [10, 15, 10] as [number, number, number];
// Self-hosted copy of drei's 'dawn' preset (kiara_1_dawn_1k.hdr). Served from
// our own domain instead of raw.githack.com — see scripts/fetch-hdr.sh.
const ENVIRONMENT_FILE = '/hdr/kiara_1_dawn_1k.hdr';
const ENVIRONMENT_INTENSITY = 0.35;
// Stand-in for the HDR on touch devices, where the 1.5MB download and the PMREM
// convolution pass aren't worth it. Intensity is deliberately much higher than
// the HDR's 0.35: an image-based environment lights from every direction at
// once, so a single hemisphere needs to be far stronger to avoid the model
// reading as a black silhouette.
const ENV_FALLBACK_SKY = '#9fb3c2';
const ENV_FALLBACK_GROUND = '#3a332c';
const ENV_FALLBACK_INTENSITY = 1.6;
// Matching lift for the flat ambient fill on mobile.
const AMBIENT_LIGHT_MOBILE = 0.5;
const KEY_LIGHT_INTENSITY_MOBILE = 0.9;

// Frame rate for the tower while a mobile panel is open over it. It's only
// visible through a heavy blur there, so this is well below the point where a
// drop in smoothness reads as stutter. Raise to 60 to disable the throttle.
const PANEL_FPS = 24;

// SHADOW SETTINGS
const SHADOW_OPACITY = 0.55;
const SHADOW_BLUR = 2.5;

/* ------------------------------------------
   PRACTICAL LIGHTS
   Emissive materials glow but cast no light in three.js — there's no global
   illumination — so each glowing fixture needs a real light co-located with it.
   Lights are attached as children of the fixture objects rather than placed at
   hardcoded coordinates, so they inherit the model transform and stay put
   through animation and re-exports.
------------------------------------------ */
type LightBehavior = 'beacon' | 'flicker' | 'static';

interface Fixture {
  names: string[];
  color: string;
  intensity: number;
  behavior: LightBehavior;
}

const FIXTURES: Fixture[] = [
  // aviation beacon at the top of the mast
  { names: ['Cube.050'], color: '#ff2d1a', intensity: 5, behavior: 'beacon' },
  // spotlight housings down the tower
  { names: ['lights.004', 'lights.005', 'lights.006'], color: '#cfeaff', intensity: 3, behavior: 'flicker' },
  // secondary bulb + the glowing panels by the box
  { names: ['Cube.052'], color: '#ff6a24', intensity: 1.5, behavior: 'flicker' },
  { names: ['Plane.019', 'Plane.020'], color: '#ff9a3c', intensity: 0.8, behavior: 'static' },
];

/* ------------------------------------------
   RADIO WAVES
   Cylinder.005 is the disc above the beacon. In Blender its arcs come from a
   Mix + Color Ramp chain driven by an animated action — both procedural node
   graphs and material animation are things glTF cannot carry, so the export
   flattens it to a solid red silhouette. Redrawn here as a shader instead,
   which is what TOWER_CONTEXT.md recommends for ambient motion anyway.
------------------------------------------ */
const WAVES_OBJECT = 'Cylinder.005';
const WAVES_COLOR = '#ff2d1a';
const WAVES_RING_COUNT = 6.0;   // concentric arcs visible at once
const WAVES_SPEED = 0.45;       // outward travel, cycles/sec
const WAVES_OPACITY = 0.85;
const WAVES_INNER_FADE = 0.22;  // hide the middle, where the bulb sits
const WAVES_OUTER_FADE = 0.95;  // fully faded by the rim
const WAVES_THICKNESS = 0.10;   // band width; lower = thinner strokes
// Lobe mask is keyed to |cos(angle off horizontal)|: 1.0 straight out the
// sides, 0.5 at 60 degrees, 0.0 at top/bottom. Fading between 0.42 and 0.78
// keeps arcs inside roughly +/-55 degrees, as drawn.
const WAVES_LOBE_CUT = 0.60;    // midpoint of the taper (higher = tighter wedges)
const WAVES_LOBE_SOFT = 0.18;   // how gradually the arcs taper out toward top/bottom
// The disc's UV axes aren't aligned to screen, so the lobes need rotating into
// place. 90 puts the arcs out to the left and right; change if the mesh moves.
const WAVES_LOBE_ANGLE = 90;    // degrees

const WAVES_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const WAVES_FRAG = /* glsl */ `
  uniform float uTime;
  uniform vec3  uColor;
  uniform float uRings;
  uniform float uSpeed;
  uniform float uOpacity;
  uniform float uInner;
  uniform float uOuter;
  uniform float uThickness;
  uniform float uLobeCut;
  uniform float uLobeSoft;
  uniform float uLobeAngle;
  varying vec2 vUv;

  void main() {
    // UVs are a 0..1 square over a circular disc, so radius from the centre
    // gives us the emanating direction without caring how the mesh is oriented.
    vec2 d = vUv - 0.5;
    float len = length(d);
    float r = len * 2.0;
    // Fade to alpha 0 rather than discarding: discard disables early-Z on the
    // tile-based GPUs in every phone, and DoubleSide already rasterises this
    // disc twice.
    float inDisc = step(r, 1.0);

    // Each band marches outward; fract() makes them repeat, and the smoothstep
    // gives a sharp leading edge with a soft trailing tail. uThickness sets how
    // much of each cycle is inked, so lower values read as finer strokes.
    float band = fract(r * uRings - uTime * uSpeed);
    float ring = smoothstep(uThickness, 0.0, band);

    // Keep only the left/right lobes, as drawn. abs(x)/len is |cos(angle)| off
    // the horizontal — 1 out to the sides, 0 at top and bottom — so this tapers
    // the arcs away vertically instead of closing them into full circles.
    float ca = cos(uLobeAngle);
    float sa = sin(uLobeAngle);
    vec2 dr = vec2(d.x * ca - d.y * sa, d.x * sa + d.y * ca);
    float horiz = abs(dr.x) / max(len, 1e-5);
    float lobe = smoothstep(uLobeCut - uLobeSoft, uLobeCut + uLobeSoft, horiz);

    // Fade in past the bulb, and out before the rim, so arcs dissolve rather
    // than getting clipped by the disc edge.
    float radial = smoothstep(uInner, uInner + 0.15, r) *
                   (1.0 - smoothstep(uOuter - 0.45, uOuter, r));

    float alpha = ring * lobe * radial * uOpacity * inDisc;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

// HOVER FEEDBACK
const HOVER_NUDGE = 0.02;      // how far to lean toward a section's camera on hover (0-1)
const HOVER_RELEASE_MS = 100;   // delay before clearing hover, absorbs raycast flicker

/* ========================================== */

const targetPos = new THREE.Vector3();
const targetQuat = new THREE.Quaternion();
const hoverPos = new THREE.Vector3();
const hoverQuat = new THREE.Quaternion();
const subjectPos = new THREE.Vector3();
const back = new THREE.Vector3();

interface CameraRigProps {
  scene: THREE.Object3D;
  active: Section | null;
  hovered: Section | null;
  narrow: boolean;
}

/**
 * Widen the authored FOV so the *horizontal* framing survives a narrow viewport.
 *
 * A perspective camera holds vertical FOV fixed, so as aspect shrinks the
 * horizontal field shrinks with it. These shots were composed at 16:9; on a
 * portrait phone that means seeing ~40% of the intended width. Scaling by
 * (authored aspect / actual aspect) keeps the horizontal extent constant, which
 * is the dimension the compositions actually depend on.
 */
function fitFov(authoredFovDeg: number, aspect: number): number {
  if (aspect >= AUTHORED_ASPECT) return authoredFovDeg;
  const half = THREE.MathUtils.degToRad(authoredFovDeg) / 2;
  const widened = 2 * Math.atan(Math.tan(half) * (AUTHORED_ASPECT / aspect));
  return Math.min(THREE.MathUtils.radToDeg(widened), FOV_MAX);
}

/**
 * Resolve a shot into the shared `targetPos` / `targetQuat` temporaries and
 * return the FOV it was authored with, or null if the camera node is missing.
 *
 * Shared by the frame loop and the mount-time snap so both place the camera by
 * exactly the same rules — the two drifting apart is what a "settles into
 * position after load" bug looks like.
 */
function resolveShot(
  scene: THREE.Object3D,
  active: Section | null,
  narrow: boolean,
): number | null {
  const target = scene.getObjectByName(active ? `cam_${active}` : 'cam_home');
  if (!target) return null;

  // getWorldPosition/Quaternion update ancestor matrices themselves, so these
  // are correct even on the very first frame, before anything has rendered.
  target.getWorldPosition(targetPos);
  target.getWorldQuaternion(targetQuat);

  // Back the camera off along its own view axis. Distance is scaled by how far
  // the shot already sits from what it is pointed at, so the trim is a constant
  // proportion rather than a fixed world offset that a re-export could
  // invalidate.
  //
  // The reference has to be the shot's own subject, not the model as a whole: a
  // section close-up sits metres from its subject but much further from the
  // model origin, so measuring against the origin over-scales the pull-back and
  // drags foreground geometry (guy-wires) into frame. The hit_* proxies already
  // mark exactly what each shot is framing.
  const home = !active;
  const dolly = narrow
    ? (home ? HOME_DOLLY_NARROW : SECTION_DOLLY_NARROW)
    : (home ? HOME_DOLLY : SECTION_DOLLY);
  if (dolly !== 1) {
    const subject = (active && scene.getObjectByName(`hit_${active}`)) || scene;
    subject.getWorldPosition(subjectPos);
    const dist = targetPos.distanceTo(subjectPos);
    // Local +Z is behind a three.js camera (they look down -Z).
    back.set(0, 0, 1).applyQuaternion(targetQuat);
    targetPos.addScaledVector(back, dist * (dolly - 1));
  }

  // The GLB carries the FOV each shot was framed with (cam_home 44.1deg, the
  // section cameras 22.9deg). Previously all of this was discarded and
  // everything rendered at R3F's default 75deg.
  return target instanceof THREE.PerspectiveCamera ? target.fov : FOV_FALLBACK;
}

/**
 * Drives the render loop at a fixed rate while the Canvas is in 'demand' mode.
 * Pass fps = null to do nothing (the loop is running at full rate).
 */
function FrameThrottle({ fps }: { fps: number | null }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    if (fps === null) return;
    const id = setInterval(invalidate, 1000 / fps);
    return () => clearInterval(id);
  }, [fps, invalidate]);
  return null;
}

function CameraRig({ scene, active, hovered, narrow }: CameraRigProps) {
  // Eased framing state. fov starts at -1 so the first frame always counts as
  // dirty and the view offset gets applied before anything is presented.
  const framing = useRef({ fov: -1, panX: 0, panY: 0, w: 0, h: 0 });
  const camera = useThree((s) => s.camera);

  // Place the camera during commit, before the browser paints.
  //
  // Without this the Canvas mounts with R3F's default camera at the origin and
  // renders at least one frame there — the tower flashes in off to the left and
  // then slides into place as the rig eases it in. Suspense makes that worse:
  // the scene commits the moment the GLB resolves, which can paint before the
  // first useFrame ever runs. Snapping here means the first thing on screen is
  // already the home framing.
  useLayoutEffect(() => {
    const authored = resolveShot(scene, null, narrow);
    if (authored === null) return;
    const cam = camera as THREE.PerspectiveCamera;
    cam.position.copy(targetPos);
    cam.quaternion.copy(targetQuat);
    framing.current.fov = -1;   // force the frame loop to adopt, not ease
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, camera]);

  useFrame((state, dt) => {
    const cam = state.camera as THREE.PerspectiveCamera;
    const authored = resolveShot(scene, active, narrow);
    if (authored === null) return;

    // Derive aspect from the drawing surface rather than reading cam.aspect,
    // which we overwrite below and which must never feed back into itself.
    const { width: w, height: h } = state.size;

    // Only the idle shot gets the lens shift; section shots stay centred.
    const home = !active;
    const targetFov = fitFov(authored, w / h);
    const targetPanX = home ? (narrow ? HOME_PAN_X_NARROW : HOME_PAN_X) : 0;
    const targetPanY = home ? (narrow ? HOME_PAN_Y_NARROW : HOME_PAN_Y) : 0;

    const f = framing.current;
    const firstFrame = f.fov < 0;

    // Lean a fraction of the way toward a hovered section to signal it's
    // clickable. Only while idle — once a section is active the rig owns the
    // camera outright, which is what keeps hover from fighting the transition.
    if (!active && hovered) {
      const hoverCam = scene.getObjectByName(`cam_${hovered}`);
      if (hoverCam) {
        hoverCam.getWorldPosition(hoverPos);
        hoverCam.getWorldQuaternion(hoverQuat);
        targetPos.lerp(hoverPos, HOVER_NUDGE);
        targetQuat.slerp(hoverQuat, HOVER_NUDGE);
      }
    }

    const k = 1 - Math.pow(0.001, dt);
    if (firstFrame) {
      // Adopt outright rather than easing in from wherever the camera happens
      // to be — easing on frame one is the visible "slides in from the left".
      cam.position.copy(targetPos);
      cam.quaternion.copy(targetQuat);
    } else {
      cam.position.lerp(targetPos, k);
      cam.quaternion.slerp(targetQuat, k);
    }

    // Ease fov and lens shift alongside position so section transitions neither
    // snap-zoom nor jump sideways.
    let dirty = false;

    if (firstFrame) {
      f.fov = targetFov;
      f.panX = targetPanX;
      f.panY = targetPanY;
      dirty = true;
    }
    if (Math.abs(f.fov - targetFov) > 0.01) {
      f.fov += (targetFov - f.fov) * k;
      dirty = true;
    }
    if (Math.abs(f.panX - targetPanX) > 0.0002) {
      f.panX += (targetPanX - f.panX) * k;
      dirty = true;
    }
    if (Math.abs(f.panY - targetPanY) > 0.0002) {
      f.panY += (targetPanY - f.panY) * k;
      dirty = true;
    }

    if (dirty || w !== f.w || h !== f.h) {
      f.w = w;
      f.h = h;
      cam.fov = f.fov;
      // Lens shift rather than a dolly: setViewOffset skews the frustum, so the
      // tower slides across the frame without moving the camera or changing the
      // perspective the shot was composed with.
      //
      // These MUST be the real pixel dimensions, not normalised fractions:
      // setViewOffset assigns `camera.aspect = fullWidth / fullHeight`
      // internally. Passing a 1x1 "full image" therefore pins aspect to 1.0 and
      // non-uniformly scales the whole scene — stretching a landscape viewport
      // horizontally and squashing a portrait one. Hence also the resize check
      // above: a stale fullWidth/fullHeight is a wrong aspect, not just a
      // stale offset.
      if (Math.abs(f.panX) < 0.0002 && Math.abs(f.panY) < 0.0002) {
        cam.clearViewOffset();   // also calls updateProjectionMatrix
        cam.aspect = w / h;      // clearViewOffset leaves aspect as-is
      } else {
        cam.setViewOffset(w, h, -f.panX * w, -f.panY * h, w, h);
      }
      cam.updateProjectionMatrix();
    }
  });

  return null;
}

interface AttachedLight {
  light: THREE.PointLight;
  base: number;
  behavior: LightBehavior;
  seed: number;
  glow: { material: THREE.MeshStandardMaterial; base: number }[];
}

function PracticalLights({
  scene,
  reduced = false,
}: {
  scene: THREE.Object3D;
  reduced?: boolean;
}) {
  const attached = useRef<AttachedLight[]>([]);

  useLayoutEffect(() => {
    const created: AttachedLight[] = [];
    const restore: { mesh: THREE.Mesh; material: THREE.Material | THREE.Material[] }[] = [];

    // Seven dynamic point lights across 33 materials is the classic mobile-GPU
    // killer — every extra light multiplies the per-fragment lighting loop. On
    // touch we keep only the beacon, which is the one that actually reads.
    // Emissive glow is unaffected, so the other fixtures still look lit.
    const fixtures = reduced ? FIXTURES.filter((f) => f.behavior === 'beacon') : FIXTURES;

    fixtures.forEach((fixture) => {
      fixture.names.forEach((name) => {
        // GLTFLoader runs node names through PropertyBinding.sanitizeNodeName,
        // which strips dots — "Cube.050" in Blender becomes "Cube050" here.
        // (cam_* / hit_* were never affected, having no dots to lose.)
        const host =
          scene.getObjectByName(name) ??
          scene.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(name));
        if (!host) return;

        const light = new THREE.PointLight(new THREE.Color(fixture.color), fixture.intensity);
        light.decay = 2;
        // Parented to the fixture, so it tracks the mesh through animation.
        host.add(light);

        // The visible glow is the emissive material, not the light — a light
        // alone pulses the spill on nearby geometry while the lamp itself stays
        // flat. Materials are cloned first because fixtures share them (both
        // bulbs use `bulb`), and they need to animate independently.
        const glow: { material: THREE.MeshStandardMaterial; base: number }[] = [];
        host.traverse((o) => {
          if (!(o instanceof THREE.Mesh)) return;
          const original = o.material;
          const list = Array.isArray(original) ? original : [original];
          const clones = list.map((m) => {
            // Only the genuinely emissive slots are worth cloning; a fixture
            // like lights.004 is a group whose other materials have a black
            // emissive, where animating emissiveIntensity would do nothing.
            if (!(m instanceof THREE.MeshStandardMaterial)) return m;
            if (m.emissive.r === 0 && m.emissive.g === 0 && m.emissive.b === 0) return m;
            const c = m.clone();
            glow.push({ material: c, base: c.emissiveIntensity || 1 });
            return c;
          });
          if (glow.length) {
            restore.push({ mesh: o, material: original });
            o.material = Array.isArray(original) ? clones : clones[0];
          }
        });

        created.push({
          light,
          base: fixture.intensity,
          behavior: fixture.behavior,
          seed: created.length * 12.9898,
          glow,
        });
      });
    });

    attached.current = created;
    return () => {
      created.forEach(({ light, glow }) => {
        light.parent?.remove(light);
        light.dispose();
        glow.forEach(({ material }) => material.dispose());
      });
      restore.forEach(({ mesh, material }) => { mesh.material = material; });
      attached.current = [];
    };
    // `reduced` resolves from a media query after mount, so the light set has to
    // rebuild when it flips.
  }, [scene, reduced]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    attached.current.forEach(({ light, base, behavior, seed, glow }) => {
      let k = 1;
      if (behavior === 'beacon') {
        // Squared sine gives a sharp bloom with a long dark tail, closer to a
        // rotating aviation beacon than an even fade.
        const p = 0.5 + 0.5 * Math.sin(t * 1.7 + seed);
        k = 0.15 + 0.85 * p * p;
      } else if (behavior === 'flicker') {
        // Layered primes never line up, so the flicker reads as irregular
        // without a per-frame RNG.
        const f =
          Math.sin(t * 37.0 + seed) * 0.5 +
          Math.sin(t * 11.3 + seed * 2) * 0.3 +
          Math.sin(t * 5.1 + seed * 3) * 0.2;
        k = 0.78 + 0.22 * f;
      } else {
        return;
      }

      light.intensity = base * k;
      // Swing the glow harder than the spill so the lamp itself visibly reads
      // as pulsing rather than just brightening what's around it.
      const gk = behavior === 'beacon' ? 0.2 + 2.3 * k : 0.55 + 0.65 * k;
      glow.forEach(({ material, base: gBase }) => {
        material.emissiveIntensity = gBase * gk;
      });
    });
  });

  return null;
}

function RadioWaves({ scene }: { scene: THREE.Object3D }) {
  const material = useRef<THREE.ShaderMaterial | null>(null);

  useLayoutEffect(() => {
    const host =
      scene.getObjectByName(WAVES_OBJECT) ??
      scene.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(WAVES_OBJECT));
    if (!(host instanceof THREE.Mesh)) return;

    const shader = new THREE.ShaderMaterial({
      vertexShader: WAVES_VERT,
      fragmentShader: WAVES_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(WAVES_COLOR) },
        uRings: { value: WAVES_RING_COUNT },
        uSpeed: { value: WAVES_SPEED },
        uOpacity: { value: WAVES_OPACITY },
        uInner: { value: WAVES_INNER_FADE },
        uOuter: { value: WAVES_OUTER_FADE },
        uThickness: { value: WAVES_THICKNESS },
        uLobeCut: { value: WAVES_LOBE_CUT },
        uLobeSoft: { value: WAVES_LOBE_SOFT },
        uLobeAngle: { value: (WAVES_LOBE_ANGLE * Math.PI) / 180 },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const original = host.material;
    host.material = shader;
    material.current = shader;

    return () => {
      host.material = original;
      shader.dispose();
      material.current = null;
    };
  }, [scene]);

  useFrame((state) => {
    if (material.current) material.current.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return null;
}

interface SceneProps {
  activeSection: Section | null;
  hoveredSection: Section | null;
  onNavigate: (section: Section) => void;
  onHover: (section: Section | null) => void;
  modelUrl: string;
}

function Scene({ activeSection, hoveredSection, onNavigate, onHover, modelUrl }: SceneProps) {
  const group = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState<Section | null>(null);
  const releaseTimer = useRef<number | null>(null);
  const coarse = useCoarsePointer();
  const isNarrow = useIsNarrow();

  // Publish 3D hover upward so the nav labels light up in step with the tower.
  // Held in a ref so a re-created callback can't retrigger the effect.
  const onHoverRef = useRef(onHover);
  onHoverRef.current = onHover;
  useEffect(() => {
    onHoverRef.current(hovered);
  }, [hovered]);
  const { scene, animations } = useGLTF(modelUrl);
  // useGLTF caches by URL, so `animations` is a stable reference across
  // re-renders — this trims the duplicate loop-point frame exactly once.
  useMemo(() => {
    animations.forEach((clip) => { clip.duration -= 1 / 24; });
  }, [animations]);
  const { actions } = useAnimations(animations, group);

  useEffect(() => {
    Object.values(actions).forEach((a) => a?.reset().play());
  }, [actions]);

  useLayoutEffect(() => {
    scene.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      if (o.name.startsWith('hit_')) {
        o.visible = false;
      } else {
        o.raycast = () => null;
      }
    });
  }, [scene]);

  // Tracks whether the physical cursor has moved since hover was last set.
  // Leaning the camera slides the (world-static) proxies across the screen, and
  // R3F re-raycasts as that happens — so a perfectly still cursor gets a
  // spurious pointerout. That feedback loop is the hover/camera oscillation:
  // lean in -> proxy shifts off cursor -> unhover -> lean back -> hover again.
  // Honouring only exits that follow real pointer movement breaks the loop.
  const pointerMoved = useRef(false);

  // Capture phase matters: this must run *before* R3F's canvas handler, so that
  // handleOver's reset lands after the flag is raised. On the bubble phase the
  // order inverts and every hover immediately re-raises it, defeating the guard.
  useEffect(() => {
    const onMove = () => { pointerMoved.current = true; };
    window.addEventListener('pointermove', onMove, { capture: true, passive: true });
    return () => window.removeEventListener('pointermove', onMove, { capture: true });
  }, []);

  // Only hit_ proxies are raycastable, so any pointer event here is a section.
  const handleOver = (e: PointerEvent3D) => {
    e.stopPropagation();
    const { section } = e.object.userData as Partial<HitProxyUserData>;
    if (!section) return;

    // Touch has no hover state to preserve, and the guard below would strand it.
    if (e.pointerType === 'touch') return;

    if (releaseTimer.current !== null) {
      clearTimeout(releaseTimer.current);
      releaseTimer.current = null;
    }
    pointerMoved.current = false;
    setHovered(section);
  };

  const handleOut = (e?: PointerEvent3D) => {
    // A tap fires pointerover -> down -> up -> out with no pointermove in
    // between, so the stationary-cursor guard below would never release and
    // hover stuck forever on touch — leaving the camera leaning and a nav label
    // lit. Touch exits are always honoured.
    if (e?.pointerType === 'touch') {
      setHovered(null);
      return;
    }
    if (!pointerMoved.current) return;
    if (releaseTimer.current !== null) clearTimeout(releaseTimer.current);
    releaseTimer.current = window.setTimeout(() => {
      setHovered(null);
      releaseTimer.current = null;
    }, HOVER_RELEASE_MS);
  };

  useEffect(() => {
    document.body.style.cursor = hovered ? 'pointer' : 'auto';
  }, [hovered]);

  useEffect(() => {
    return () => {
      if (releaseTimer.current !== null) clearTimeout(releaseTimer.current);
      document.body.style.cursor = 'auto';
    };
  }, []);

  return (
    <>
      <group
        ref={group}
        position={isNarrow ? MODEL_POSITION_MOBILE : MODEL_POSITION}
        scale={MODEL_SCALE}
      >
        <primitive
          object={scene}
          onPointerOver={handleOver}
          onPointerOut={handleOut}
          onClick={(e: PointerEvent3D) => {
            e.stopPropagation();
            const userData = e.object.userData as Partial<HitProxyUserData>;
            if (userData.section) onNavigate(userData.section);
          }}
        />
      </group>
      <PracticalLights scene={scene} reduced={coarse} />
      <RadioWaves scene={scene} />
      {/* Driven by the shared hover state, so pointing at a nav label leans the
          camera exactly as pointing at the tower itself does. The lean is a
          mouse affordance, so it's suppressed on touch. */}
      <CameraRig
        scene={scene}
        active={activeSection}
        hovered={coarse ? null : hoveredSection}
        narrow={isNarrow}
      />
    </>
  );
}

interface ModelViewerProps {
  activeSection: Section | null;
  hoveredSection: Section | null;
  onNavigate: (section: Section) => void;
  onHover: (section: Section | null) => void;
  onClose: () => void;
  modelUrl: string;
}

export default function ModelViewer({
  activeSection,
  hoveredSection,
  onNavigate,
  onHover,
  onClose,
  modelUrl,
}: ModelViewerProps) {
  const coarse = useCoarsePointer();
  const isNarrow = useIsNarrow();

  // Throttle — do NOT stop — the render loop while a mobile panel is open.
  //
  // The sheet is bg-black/70 with a blur, not opaque, so the tower stays visible
  // through it and that drifting motion is part of the look. Freezing the loop
  // outright is cheaper but kills it.
  //
  // The cost being managed is real though: at full rate the scene redraws 60x a
  // second AND the panel's backdrop-blur re-blurs the whole viewport each time,
  // which is what made opening a panel stutter on a phone. Behind a 24px blur
  // at 70% black, a lower frame rate is not perceptible, so this keeps the
  // movement at a fraction of the work.
  //
  // Desktop is untouched: there the panel is a half-width column and the tower
  // is in full view at full rate.
  //
  // Deferred by the length of the panel's slide so the transition itself — the
  // one moment smoothness actually shows — still runs at full rate.
  const covered = isNarrow && activeSection !== null;
  const [throttled, setThrottled] = useState(false);
  // Restoring full rate has to be immediate, and adjusting state during render
  // is React's sanctioned way to do that — an effect would leave the tower
  // running slow for a frame as the panel slides away.
  if (!covered && throttled) setThrottled(false);
  useEffect(() => {
    if (!covered) return;
    const t = setTimeout(() => setThrottled(true), 350);   // panel transition is 300ms
    return () => clearTimeout(t);
  }, [covered]);

  return (
    <div className="w-full h-dvh">
      <Canvas
        style={{ background: 'transparent' }}
        onPointerMissed={onClose}
        // 'demand' renders only when something calls invalidate() — FrameThrottle
        // below does that at a fixed rate. Animations still advance correctly
        // because useFrame receives the real (larger) delta.
        frameloop={throttled ? 'demand' : 'always'}
        // R3F defaults to [1, 2]; 2x on a 390x844 phone is ~1.3M pixels with
        // MSAA on top. 1.5x is a big saving at basically no visible cost.
        dpr={coarse ? [1, 1.5] : [1, 2]}
        gl={{ antialias: !coarse, powerPreference: 'high-performance' }}
      >
        <FrameThrottle fps={throttled ? PANEL_FPS : null} />

        <Suspense fallback={null}>
          {/* Ambient / key — dim on purpose so the tower's own fixtures carry
              the scene, but lifted on mobile to compensate for the missing HDR
              and the reduced practical lights. */}
          <ambientLight
            intensity={coarse ? AMBIENT_LIGHT_MOBILE : AMBIENT_LIGHT}
            color={AMBIENT_COLOR}
          />
          <directionalLight
            position={KEY_LIGHT_POSITION}
            intensity={coarse ? KEY_LIGHT_INTENSITY_MOBILE : KEY_LIGHT_INTENSITY}
            color={KEY_LIGHT_COLOR}
          />

          {/* Environment for reflections.
              Self-hosted: drei's `preset` fetches ~1.5MB of HDR from
              raw.githack.com at runtime — a dev CDN, not production infra.
              Skipped entirely on touch, where a hemisphere light stands in for
              a fraction of the cost and payload. */}
          {coarse ? (
            <hemisphereLight
              args={[ENV_FALLBACK_SKY, ENV_FALLBACK_GROUND, ENV_FALLBACK_INTENSITY]}
            />
          ) : (
            <Environment files={ENVIRONMENT_FILE} environmentIntensity={ENVIRONMENT_INTENSITY} />
          )}

          {/* 3D Model + camera rig */}
          <Scene
            activeSection={activeSection}
            hoveredSection={hoveredSection}
            onNavigate={onNavigate}
            onHover={onHover}
            modelUrl={modelUrl}
          />

          {/* Ground shadow. drei defaults to frames={Infinity}, which re-renders
              the scene into a 512² depth target plus four blur passes EVERY
              frame, forever. The tower's base never moves, so one pass is
              enough — this is the single cheapest perf win in the file. */}
          <ContactShadows
            frames={1}
            position={[0, 0, 0]}
            opacity={SHADOW_OPACITY}
            scale={15}
            blur={SHADOW_BLUR}
            far={10}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
