'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, useAnimations, Environment, ContactShadows } from '@react-three/drei';
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import * as THREE from 'three';

import type { Section } from '@/lib/sections';
import { useCoarsePointer, useIsNarrow } from '@/lib/useCoarsePointer';
import { applyTrim, liveTrims } from './cameraTrims';
import CameraTuner from './CameraTuner';

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
const AMBIENT_LIGHT = 0.0;
const AMBIENT_COLOR = '#8fa3b0';        // cool overcast fill
const KEY_LIGHT_INTENSITY = 0.0;
const KEY_LIGHT_COLOR = '#000000';      // weak, low sun
const KEY_LIGHT_POSITION = [10, 15, 10] as [number, number, number];
// Self-hosted copy of drei's 'dawn' preset (kiara_1_dawn_1k.hdr). Served from
// our own domain instead of raw.githack.com — see scripts/fetch-hdr.sh.
const ENVIRONMENT_FILE = '/hdr/kiara_1_dawn_1k.hdr';
const ENVIRONMENT_INTENSITY = 0.1;
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

// PIXEL LOOK
// The artist built the tower for a low-res, hard-edged look. The scene renders
// at 1/N of the CSS resolution and the browser scales the canvas up
// nearest-neighbour (`image-rendering: pixelated`), so each rendered pixel
// lands as a crisp N-px square. Measured in CSS pixels, so blocks are the same
// physical size on a retina screen as a regular one. Only the 3D scene is
// affected; nav, panels and the background photo stay sharp.
//
// The wide home shot takes a finer grain than the section close-ups — 2 there
// reads as noise. Fractional sizes are fine: 1.5 is exactly 3 device pixels on
// a retina screen; on a 1x monitor blocks alternate 1px/2px. Either can be 0
// for smooth (supersampled) rendering instead.
// In dev, `?homepixel=N` and `?pixel=N` override these for comparing sizes.
const HOME_PIXEL_SIZE = 1.1;
const PIXEL_SIZE = 2;
// Entering/leaving a section steps the resolution geometrically between the
// two rather than snapping — a mosaic transition timed to land while the
// camera is still flying.
const PIXEL_STEPS = 4;
const PIXEL_STEP_MS = 90;

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

// Shared GLSL. Our ShaderMaterials don't get three's fog chunks, so the beams
// and waves fade with the scene fog via these instead (same linear smoothstep
// three uses). They fade alpha rather than mixing toward fogColor — the same
// thing over a light backdrop, and correct for premultiplied output.
const FOG_FADE_VERT = /* glsl */ `
  varying float vFogDepth;
`;
const FOG_FADE_FRAG = /* glsl */ `
  uniform float fogNear;
  uniform float fogFar;
  varying float vFogDepth;
  float fogKeep() { return 1.0 - smoothstep(fogNear, fogFar, vFogDepth); }
`;

// Value noise, shared by the beams and the fog layers.
const NOISE_GLSL = /* glsl */ `
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float vnoise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x),
          mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x),
          mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }

  // Three octaves (Blender's detail 2), normalised to 0..1.
  float fbm3(vec3 p) {
    return (vnoise(p) + 0.5 * vnoise(p * 2.0) + 0.25 * vnoise(p * 4.0)) / 1.75;
  }
`;

const WAVES_VERT = /* glsl */ `
  varying vec2 vUv;
  ${FOG_FADE_VERT}
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vFogDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
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
  ${FOG_FADE_FRAG}

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

    float alpha = ring * lobe * radial * uOpacity * inDisc * fogKeep();
    gl_FragColor = vec4(uColor, alpha);
  }
`;

/* ------------------------------------------
   LIGHT BEAMS
   The spotlight cones, one parented to each lamp housing. In Blender their alpha is a procedural chain — a gradient along the
   cone mixed with noise in Generated coordinates, through a Color Ramp that
   caps it around 0.28, then Screen-blended with a grunge image projected in
   *screen space* and scrolled by a frame driver. glTF can't carry any of that,
   so the exporter falls back to the raw grunge as alpha (~50% opaque
   everywhere) and the cones render as solid grey. Rebuilt here node-for-node;
   the numbers below are read straight off DA.blend. Plane.011 is hidden in
   the artist's viewport but renders, so DA_fixed6.blend unhides it to get it
   through the visible-only export.
------------------------------------------ */
interface BeamSpec {
  object: string;
  color: [number, number, number]; // emission colour, linear RGB as in Blender
  emission: number;       // emission strength (Blender units)
  litBase: number;        // how much the unlit base colour still shows
  flicker: boolean;       // emission switched on/off by a noise threshold
  noiseScale: number;     // Noise Texture scale
  noiseStretch: number;   // Mapping X scale on Generated coords
  rampLo: number;         // noise Color Ramp: black stop...
  rampHi: number;         // ...and the grey it ramps up to
  grungeLo: number;       // grunge Color Ramp: black stop...
  grungeHi: number;       // ...and the grey it ramps up to
  grungeScaleX: number;   // Mapping rotation folded into per-axis scales
  grungeScaleY: number;
  grungeSpeed: number;    // screen widths/sec (Blender driver frame/N at 24fps)
  screenMix: number;      // Mix (Screen) factor
}

const BEAMS: BeamSpec[] = [
  {
    // outline.001 — constant glow
    object: 'Plane.015', color: [0.204, 0.444, 0.8], emission: 2.9, litBase: 0, flicker: false,
    noiseScale: 5.3, noiseStretch: 4.3, rampLo: 0.5, rampHi: 0.28,
    grungeLo: 0.823, grungeHi: 0.06, grungeScaleX: -0.56, grungeScaleY: 1.0,
    grungeSpeed: 24 / 50, screenMix: 0.708,
  },
  {
    // Light lower — emission flickers on/off, base colour carries it when off
    object: 'Plane.014', color: [0.204, 0.444, 0.8], emission: 1.0, litBase: 0.35, flicker: true,
    noiseScale: 5.0, noiseStretch: 1.8, rampLo: 0.486, rampHi: 0.28,
    grungeLo: 0.409, grungeHi: 0.03, grungeScaleX: 1.0, grungeScaleY: 1.0,
    grungeSpeed: 24 / 100, screenMix: 0.792,
  },
  {
    // light R.001 — constant glow; Mapping rotates the grunge ~180° about X
    object: 'Plane.011', color: [0.204, 0.444, 0.8], emission: 2.3, litBase: 0, flicker: false,
    noiseScale: 5.0, noiseStretch: 1.8, rampLo: 0.486, rampHi: 0.28,
    grungeLo: 0.932, grungeHi: 0.06, grungeScaleX: 1.0, grungeScaleY: -1.0,
    grungeSpeed: 24 / 50, screenMix: 0.367,
  },
];
// Global trim. 1.0 is the artist's own emission values. Over the light
// foggy-street background that already reads like their render (on the old
// black backdrop it needed ~3x to show at all — higher now clips to white).
const BEAM_INTENSITY = 1.0;
// Blender's Noise > Color > Color Ramp averages three noise channels, which
// narrows its spread; one channel of value noise needs squashing to match.
const BEAM_NOISE_CONTRAST = 0.6;
// Blender driver: Noise W = frame/200, compared > 0.5 at noise scale 5.
const BEAM_FLICKER_RATE = (24 / 200) * 5;

const BEAM_VERT = /* glsl */ `
  uniform vec3 uBoxMin;
  uniform vec3 uBoxSize;
  varying vec3 vGen;
  ${FOG_FADE_VERT}
  void main() {
    // Blender's Generated coords: position normalised to the mesh's own
    // bounding box. glTF is Y-up, so swap back to Blender's Z-up axes.
    vec3 g = (position - uBoxMin) / uBoxSize;
    vGen = vec3(g.x, 1.0 - g.z, g.y);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vFogDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const BEAM_FRAG = /* glsl */ `
  uniform float uTime;
  uniform vec3  uColor;
  uniform float uEmission;
  uniform float uLitBase;
  uniform float uFlicker;
  uniform float uIntensity;
  uniform float uNoiseScale;
  uniform float uNoiseStretch;
  uniform float uNoiseContrast;
  uniform float uRampLo;
  uniform float uRampHi;
  uniform sampler2D uGrunge;
  uniform float uHasGrunge;
  uniform float uGrungeLo;
  uniform float uGrungeHi;
  uniform float uGrungeScaleX;
  uniform float uGrungeScaleY;
  uniform float uGrungeSpeed;
  uniform float uScreenMix;
  uniform vec2  uResolution;
  varying vec3 vGen;
  ${FOG_FADE_FRAG}
  ${NOISE_GLSL}

  // Detail 2, roughness 0.5, lacunarity 2 — Blender's settings on the beams.
  float fbm(vec3 p) {
    return 0.5 + (fbm3(p) - 0.5) * uNoiseContrast;
  }

  // Linear Color Ramp from black at lo to grey hi at 1.0.
  float ramp(float x, float lo, float hi) {
    return clamp((x - lo) / (1.0 - lo), 0.0, 1.0) * hi;
  }

  void main() {
    // Gradient (Linear, along X) mixed 35/65 with noise, into the ramp.
    vec3 np = vGen * vec3(uNoiseStretch, 1.0, 1.0) * uNoiseScale;
    float m = mix(vGen.x, fbm(np), 0.65);
    float a = ramp(m, uRampLo, uRampHi);

    // Grunge in Window coordinates, scrolled sideways by the frame driver.
    float b = 0.0;
    if (uHasGrunge > 0.5) {
      vec2 w = gl_FragCoord.xy / uResolution;
      vec2 guv = vec2(w.x * uGrungeScaleX + uTime * uGrungeSpeed, w.y * uGrungeScaleY);
      // The exporter repacks the grunge per material — sometimes as greyscale
      // RGBA, sometimes white RGB with the grunge only in alpha — so alpha is
      // the one channel that always holds it. It's the raw sRGB value there;
      // Blender ramps the linear one.
      float g = pow(texture2D(uGrunge, guv).a, 2.2);
      b = ramp(g, uGrungeLo, uGrungeHi);
    }

    float screen = 1.0 - (1.0 - a) * (1.0 - b);
    float alpha = mix(a, screen, uScreenMix);

    // Premultiplied: the emission is well above 1.0, and an 8-bit canvas
    // clamps the colour *before* the blend would scale it by alpha.
    vec3 col = uColor * (uLitBase + uEmission * uFlicker) * uIntensity;
    gl_FragColor = vec4(col * alpha, alpha) * fogKeep();
    #include <colorspace_fragment>
  }
`;

/* ------------------------------------------
   FOG
   Silent Hill-style fog, two layers of it:
   1. Distance fog (scene.fog): geometry fades toward the photo's grey with
      depth, so the tower sits *in* the foggy-street background rather than on
      top of it. Our ShaderMaterials join in via FOG_FADE_*.
   2. Drifting fog sheets: big camera-facing planes of animated noise, behind
      the tower, low around its base and thinly in front, brightening where
      they pass the spotlights so the lamps read as glowing through the murk.

   Each sheet sits on the line from the camera through the tower, pushed past
   the tower's footprint, so it never slices through geometry (no hard
   intersection lines). Everything is sized in tower heights (H) measured off
   the model at runtime, so re-exports and MODEL_SCALE changes carry over.
   The front/ground sheets fade out as the camera closes in for a section
   shot; the back ones only thin, keeping some depth behind close-ups.
   Blender's Volume shaders can't do any of this: volumetrics don't
   survive glTF export at all.
------------------------------------------ */
// Display-space RGB (0-255) sampled off foggy-street.jpg at tower height.
const FOG_COLOR = [201, 200, 201];
// Distance fog range, in tower heights from the camera. The home camera sits
// ~2.3H out, so the near face barely fogs and the far side and top thin out;
// section cameras sit well inside FOG_NEAR and stay clear.
const FOG_NEAR = 1.5;
const FOG_FAR = 5.0;
// Global multiplier on every sheet's opacity — the one knob for "more fog".
// In dev, `?fog=N` overrides it (0 = sheets off; distance fog stays).
const FOG_DENSITY = 1.5;
const FOG_LAMP_COLOR = [207, 234, 255];   // matches the spotlight fixtures
const FOG_LAMP_RADIUS = 0.18;             // glow falloff, in tower heights

interface FogSheet {
  offset: number;          // along camera->tower, in H; + behind the tower, - in front
  height: number;          // centre height above the base, in H
  size: [number, number];  // width, height in H
  opacity: number;
  scale: [number, number]; // noise frequency across the sheet
  drift: [number, number]; // noise scroll, sheet-widths per second
  evolve: number;          // how fast the noise churns in place
  ground: boolean;         // dense at the bottom, thinning upward
  front: boolean;          // between camera and tower: fades out in close-ups
  glow: number;            // spotlight glow strength
}

const FOG_SHEETS: FogSheet[] = [
  // far bank behind everything
  { offset: 1.6, height: 0.5, size: [3.6, 1.3], opacity: 0.4, scale: [3.0, 1.2],
    drift: [0.010, 0.002], evolve: 0.03, ground: false, front: false, glow: 0.0 },
  // close behind the tower, where the lamps light it up
  { offset: 0.6, height: 0.45, size: [3.0, 1.2], opacity: 0.45, scale: [2.5, 1.0],
    drift: [-0.015, 0.003], evolve: 0.05, ground: false, front: false, glow: 1.0 },
  // ground mist just in front of the base — bottom edge sits at base level
  { offset: -0.6, height: 0.18, size: [3.0, 0.36], opacity: 0.65, scale: [3.0, 0.8],
    drift: [0.020, 0.0], evolve: 0.06, ground: true, front: true, glow: 0.6 },
  // thin veil in front
  { offset: -0.75, height: 0.5, size: [3.0, 1.3], opacity: 0.2, scale: [2.0, 0.9],
    drift: [0.030, -0.004], evolve: 0.08, ground: false, front: true, glow: 0.8 },
];

const FOG_SHEET_VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const FOG_SHEET_FRAG = /* glsl */ `
  uniform float uTime;
  uniform vec3  uColor;
  uniform float uOpacity;
  uniform vec2  uScale;
  uniform vec2  uDrift;
  uniform float uEvolve;
  uniform float uSeed;
  uniform float uGround;
  uniform vec3  uLamps[3];
  uniform vec3  uLampColor;
  uniform float uLampRadius;
  uniform float uGlow;
  varying vec2 vUv;
  varying vec3 vWorld;
  ${NOISE_GLSL}

  void main() {
    vec2 p = vUv * uScale + uDrift * uTime * uScale + uSeed;
    float n = fbm3(vec3(p, uTime * uEvolve + uSeed));
    // Wisps rather than a flat veil: only the densest patches of noise show.
    float d = smoothstep(0.45, 0.8, n);

    // Feather every edge so no sheet ever reads as a rectangle. Rounded
    // (sine) profiles rather than smoothstep ramps: a linear-ish ramp still
    // shows as a straight band edge across the dark trees once density rises.
    float ex = pow(sin(3.14159265 * vUv.x), 1.5);
    float eyBank = pow(sin(3.14159265 * vUv.y), 2.0);
    // Ground mist: densest low down, fading out well before the top.
    float eyGround = sin(3.14159265 * min(vUv.y * 1.6, 1.0) * 0.5 + 1.5707963) * smoothstep(0.0, 0.35, vUv.y);
    float a = d * ex * mix(eyBank, eyGround, uGround) * uOpacity;

    // Lamps scatter into the fog around them.
    float glow = 0.0;
    for (int i = 0; i < 3; i++) {
      vec3 dv = vWorld - uLamps[i];
      glow += exp(-dot(dv, dv) / (uLampRadius * uLampRadius));
    }
    glow *= uGlow;
    vec3 col = uColor + uLampColor * glow;
    a = clamp(a * (1.0 + glow), 0.0, 1.0);

    // Display-space colour, premultiplied.
    gl_FragColor = vec4(col * a, a);
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

  // Per-shot fine-tuning from cameraTrims.ts, applied to the authored pose as
  // if the Blender camera itself had been nudged — so the dolly below then
  // backs off along the *trimmed* view axis.
  const shot = active ?? 'home';
  applyTrim(shot, targetPos, targetQuat);

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
  const fov = target instanceof THREE.PerspectiveCamera ? target.fov : FOV_FALLBACK;
  return fov + liveTrims[shot].fov;
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
        applyTrim(hovered, hoverPos, hoverQuat);
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
      // Lets three feed fogNear/fogFar from scene.fog (see FogLayers).
      fog: true,
      uniforms: {
        ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
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

// 1D value noise for the lower beam's on/off flicker, matching the Math
// Greater Than node on Blender's Noise W.
function noise1(x: number): number {
  const h = (n: number) => {
    const s = Math.sin(n * 127.1) * 43758.5453;
    return s - Math.floor(s);
  };
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return h(i) * (1 - u) + h(i + 1) * u;
}

function LightBeams({ scene }: { scene: THREE.Object3D }) {
  const beams = useRef<{ shader: THREE.ShaderMaterial; spec: BeamSpec }[]>([]);
  const size = useMemo(() => new THREE.Vector2(), []);

  useLayoutEffect(() => {
    const created: { shader: THREE.ShaderMaterial; spec: BeamSpec }[] = [];
    const restore: { mesh: THREE.Mesh; material: THREE.Material | THREE.Material[] }[] = [];

    BEAMS.forEach((spec) => {
      const host =
        scene.getObjectByName(spec.object) ??
        scene.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(spec.object));
      if (!(host instanceof THREE.Mesh)) return;

      const geo = host.geometry as THREE.BufferGeometry;
      if (!geo.boundingBox) geo.computeBoundingBox();
      const box = geo.boundingBox!;
      const boxSize = box.getSize(new THREE.Vector3());

      // The exporter left the grunge image on the material as its base map —
      // reuse it rather than shipping it twice.
      const original = host.material;
      const src = Array.isArray(original) ? original[0] : original;
      const grunge = src instanceof THREE.MeshStandardMaterial ? src.map : null;

      const shader = new THREE.ShaderMaterial({
        vertexShader: BEAM_VERT,
        fragmentShader: BEAM_FRAG,
        fog: true,
        uniforms: {
          ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
          uTime: { value: 0 },
          uBoxMin: { value: box.min.clone() },
          uBoxSize: { value: boxSize },
          uColor: { value: new THREE.Vector3(...spec.color) },
          uEmission: { value: spec.emission },
          uLitBase: { value: spec.litBase },
          uFlicker: { value: 1 },
          uIntensity: { value: BEAM_INTENSITY },
          uNoiseScale: { value: spec.noiseScale },
          uNoiseStretch: { value: spec.noiseStretch },
          uNoiseContrast: { value: BEAM_NOISE_CONTRAST },
          uRampLo: { value: spec.rampLo },
          uRampHi: { value: spec.rampHi },
          uGrunge: { value: grunge },
          uHasGrunge: { value: grunge ? 1 : 0 },
          uGrungeLo: { value: spec.grungeLo },
          uGrungeHi: { value: spec.grungeHi },
          uGrungeScaleX: { value: spec.grungeScaleX },
          uGrungeScaleY: { value: spec.grungeScaleY },
          uGrungeSpeed: { value: spec.grungeSpeed },
          uScreenMix: { value: spec.screenMix },
          uResolution: { value: new THREE.Vector2(1, 1) },
        },
        transparent: true,
        depthWrite: false,
        // Alpha-over, as Eevee composites a Blended material. Additive looked
        // the same on the old black backdrop but vanishes against the light
        // foggy-street background — adding blue to near-white is near-white.
        // Over a light sky this tints instead, like the artist's own render.
        blending: THREE.NormalBlending,
        premultipliedAlpha: true,
        side: src.side,
      });

      restore.push({ mesh: host, material: original });
      host.material = shader;
      created.push({ shader, spec });
    });

    beams.current = created;
    return () => {
      restore.forEach(({ mesh, material }) => { mesh.material = material; });
      created.forEach(({ shader }) => shader.dispose());
      beams.current = [];
    };
  }, [scene]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    state.gl.getDrawingBufferSize(size);
    beams.current.forEach(({ shader, spec }) => {
      const u = shader.uniforms;
      u.uTime.value = t;
      (u.uResolution.value as THREE.Vector2).copy(size);
      if (spec.flicker) u.uFlicker.value = noise1(t * BEAM_FLICKER_RATE) > 0.5 ? 1 : 0;
    });
  });

  return null;
}

const LAMP_NAMES = ['lights.004', 'lights.005', 'lights.006'];

function findNode(scene: THREE.Object3D, name: string): THREE.Object3D | undefined {
  return scene.getObjectByName(name) ??
    scene.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(name));
}

function FogLayers({ scene }: { scene: THREE.Object3D }) {
  // Read the root scene inside the effect via get(): it gets mutated (fog,
  // added meshes), which the React lint rightly forbids on a hook's value.
  const get = useThree((s) => s.get);
  const sheets = useRef<{ mesh: THREE.Mesh; shader: THREE.ShaderMaterial; spec: FogSheet }[]>([]);
  const frame = useRef({ base: new THREE.Vector3(), H: 1, density: FOG_DENSITY });

  useLayoutEffect(() => {
    // Tower metrics in world space: base = the platform's origin, H = up to the
    // beacon. Measured after the model group's scale/position are applied.
    const base = findNode(scene, 'floor.003');
    const beacon = findNode(scene, 'Cube.050');
    if (!base || !beacon) return;
    scene.updateWorldMatrix(true, true);
    const basePos = base.getWorldPosition(new THREE.Vector3());
    const H = Math.max(beacon.getWorldPosition(new THREE.Vector3()).y - basePos.y, 1e-3);
    // Dev-only ?fog=N density override. Read here rather than in render: this
    // only ever runs client-side, inside the canvas.
    let density = FOG_DENSITY;
    if (process.env.NODE_ENV !== 'production') {
      const v = parseFloat(new URLSearchParams(window.location.search).get('fog') ?? '');
      if (Number.isFinite(v) && v >= 0) density = v;
    }
    frame.current = { base: basePos, H, density };

    // Built from display values: three mixes fog in *after* the sRGB output
    // conversion, so a normal Color (stored linear) would fog too dark.
    const fogColor = new THREE.Color().setRGB(
      FOG_COLOR[0] / 255, FOG_COLOR[1] / 255, FOG_COLOR[2] / 255, THREE.LinearSRGBColorSpace,
    );
    const root = get().scene;
    const prevFog = root.fog;
    root.fog = new THREE.Fog(fogColor, FOG_NEAR * H, FOG_FAR * H);

    const geometry = new THREE.PlaneGeometry(1, 1);
    const created = FOG_SHEETS.map((spec, i) => {
      const shader = new THREE.ShaderMaterial({
        vertexShader: FOG_SHEET_VERT,
        fragmentShader: FOG_SHEET_FRAG,
        uniforms: {
          uTime: { value: 0 },
          uColor: { value: new THREE.Vector3(...FOG_COLOR.map((c) => c / 255)) },
          uOpacity: { value: 0 },
          uScale: { value: new THREE.Vector2(...spec.scale) },
          uDrift: { value: new THREE.Vector2(...spec.drift) },
          uEvolve: { value: spec.evolve },
          uSeed: { value: i * 17.3 },
          uGround: { value: spec.ground ? 1 : 0 },
          uLamps: { value: LAMP_NAMES.map(() => new THREE.Vector3(1e6, 1e6, 1e6)) },
          uLampColor: { value: new THREE.Vector3(...FOG_LAMP_COLOR.map((c) => c / 255)) },
          uLampRadius: { value: FOG_LAMP_RADIUS * H },
          uGlow: { value: spec.glow },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.NormalBlending,
        premultipliedAlpha: true,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geometry, shader);
      mesh.scale.set(spec.size[0] * H, spec.size[1] * H, 1);
      // Fog never takes clicks or hovers meant for the tower.
      mesh.raycast = () => {};
      mesh.frustumCulled = false;
      root.add(mesh);
      return { mesh, shader, spec };
    });
    sheets.current = created;

    return () => {
      created.forEach(({ mesh, shader }) => {
        root.remove(mesh);
        shader.dispose();
      });
      geometry.dispose();
      root.fog = prevFog;
      sheets.current = [];
    };
  }, [scene, get]);

  const toTower = useMemo(() => new THREE.Vector3(), []);
  const lamp = useMemo(() => new THREE.Vector3(), []);

  useFrame((state) => {
    const { base, H, density } = frame.current;
    const cam = state.camera;
    const t = state.clock.elapsedTime;

    // Horizontal direction from camera to tower; sheets line up along it.
    toTower.set(base.x - cam.position.x, 0, base.z - cam.position.z);
    const dist = Math.max(toTower.length(), 1e-3);
    toTower.divideScalar(dist);
    const distH = dist / H;
    // 1 on the home shot (~2.3H out), 0 in a close-up (~1H or less).
    const wide = THREE.MathUtils.smoothstep(distH, 1.2, 2.0);

    const lamps = LAMP_NAMES.map((n) => findNode(scene, n));

    sheets.current.forEach(({ mesh, shader, spec }) => {
      mesh.position.set(
        base.x + toTower.x * spec.offset * H,
        base.y + spec.height * H,
        base.z + toTower.z * spec.offset * H,
      );
      // Face the camera, but stay upright.
      mesh.lookAt(cam.position.x, mesh.position.y, cam.position.z);

      const u = shader.uniforms;
      u.uTime.value = t;
      const k = spec.front ? wide : 0.5 + 0.5 * wide;
      u.uOpacity.value = spec.opacity * density * k;
      lamps.forEach((l, i) => {
        if (l) (u.uLamps.value as THREE.Vector3[])[i].copy(l.getWorldPosition(lamp));
      });
    });
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
      <LightBeams scene={scene} />
      <FogLayers scene={scene} />
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

// The camera tuner (CameraTuner.tsx) is a dev tool: `npm run dev`, then open
// the site with ?camtune. Never shown in a production build. Read through
// useSyncExternalStore so the server render (false) and the client's first
// render agree, rather than branching on `window` mid-render.
const noSubscribe = () => () => {};
function useCameraTuning(): boolean {
  return useSyncExternalStore(
    noSubscribe,
    () =>
      process.env.NODE_ENV !== 'production' &&
      new URLSearchParams(window.location.search).has('camtune'),
    () => false,
  );
}

// A pixel size, unless overridden in dev with ?<param>=N (0 = smooth).
function usePixelSize(param: string, fallback: number): number {
  return useSyncExternalStore(
    noSubscribe,
    () => {
      if (process.env.NODE_ENV === 'production') return fallback;
      const v = new URLSearchParams(window.location.search).get(param);
      const n = v === null ? NaN : parseFloat(v);
      return Number.isFinite(n) && n >= 0 ? n : fallback;
    },
    () => fallback,
  );
}

type Dpr = number | [number, number];

/**
 * Canvas resolution for the pixel look: `target` is the block size in CSS px,
 * 0 for smooth. Changes step through PIXEL_STEPS intermediate resolutions
 * instead of snapping.
 */
function usePixelTransition(target: number, coarse: boolean): { dpr: Dpr; pixelated: boolean } {
  // The canvas has no MSAA (it would soften the section blocks), so home is
  // smoothed by supersampling: desktop always renders at 2x, which a 1x
  // monitor's filtered downscale turns into anti-aliasing and a retina screen
  // shows natively. Phones keep a [1, 1.5] range — 2x on a 390x844 screen is
  // ~1.3M pixels, and at their density 1.5x shows little aliasing.
  const smooth: Dpr = coarse ? [1, 1.5] : 2;
  const smoothMax = coarse ? 1.5 : 2;
  // null = smooth (the clamped range above); a number = an explicit dpr.
  const [step, setStep] = useState<number | null>(target > 0 ? 1 / target : null);
  const current = useRef(step);

  useEffect(() => {
    const resolveSmooth = () =>
      coarse ? Math.min(Math.max(window.devicePixelRatio || 1, 1), smoothMax) : smoothMax;
    const from = current.current ?? resolveSmooth();
    const to = target > 0 ? 1 / target : resolveSmooth();
    if (Math.abs(from - to) < 1e-3) return;

    const timers: number[] = [];
    for (let i = 1; i <= PIXEL_STEPS; i++) {
      const last = i === PIXEL_STEPS;
      // Geometric, so each step changes block size by the same ratio.
      const value = last ? (target > 0 ? to : null) : from * Math.pow(to / from, i / PIXEL_STEPS);
      timers.push(
        window.setTimeout(() => {
          current.current = value;
          setStep(value);
        }, i * PIXEL_STEP_MS),
      );
    }
    return () => timers.forEach((t) => clearTimeout(t));
  }, [target, smoothMax, coarse]);

  return { dpr: step ?? smooth, pixelated: step !== null };
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
  const tuning = useCameraTuning();
  const homePixel = usePixelSize('homepixel', HOME_PIXEL_SIZE);
  const sectionPixel = usePixelSize('pixel', PIXEL_SIZE);
  const { dpr, pixelated } = usePixelTransition(activeSection ? sectionPixel : homePixel, coarse);

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
        // Nearest-neighbour only while pixelated; on home the browser's normal
        // filtered downscale of the 2x canvas is what anti-aliases it.
        style={{ background: 'transparent', imageRendering: pixelated ? 'pixelated' : 'auto' }}
        onPointerMissed={onClose}
        // 'demand' renders only when something calls invalidate() — FrameThrottle
        // below does that at a fixed rate. Animations still advance correctly
        // because useFrame receives the real (larger) delta.
        frameloop={throttled ? 'demand' : 'always'}
        // Driven by usePixelTransition: smooth on home, 1/PIXEL_SIZE in a
        // section (which is also far cheaper to draw). It has to be this prop
        // rather than a setDpr call — R3F re-applies the prop on every render.
        dpr={dpr}
        // No MSAA: it softened the section blocks. Home gets its smoothing from
        // supersampling instead (see usePixelTransition).
        gl={{ antialias: false, powerPreference: 'high-performance' }}
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
      {tuning && <CameraTuner shot={activeSection ?? 'home'} />}
    </div>
  );
}
