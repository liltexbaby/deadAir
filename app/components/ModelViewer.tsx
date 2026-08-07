'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations, Environment, ContactShadows } from '@react-three/drei';
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

import type { Section } from '@/lib/sections';

interface HitProxyUserData {
  section: Section;
  label: string;
  route: string;
  order: number;
}

type PointerEvent3D = THREE.Event & {
  object: THREE.Object3D;
  stopPropagation: () => void;
};

/* ==========================================
   🎨 ART DIRECTION CONTROLS
   ==========================================
   Adjust these values to customize the scene
*/

// MODEL SETTINGS
const MODEL_SCALE = 0.35;
const MODEL_POSITION = [-10, -3, 0] as [number, number, number];

// LIGHTING SETTINGS — dusk / overcast.
// Kept deliberately dim: the tower's own fixtures below are meant to read as
// the brightest things in frame, which they can't do against a bright HDRI.
const AMBIENT_LIGHT = 0.25;
const AMBIENT_COLOR = '#8fa3b0';        // cool overcast fill
const KEY_LIGHT_INTENSITY = 0.55;
const KEY_LIGHT_COLOR = '#b9c7d2';      // weak, low sun
const KEY_LIGHT_POSITION = [10, 15, 10] as [number, number, number];
const ENVIRONMENT_PRESET = 'dawn';      // swap for 'city' / 'sunset' / 'night' to retune
const ENVIRONMENT_INTENSITY = 0.35;

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
    if (r > 1.0) discard;

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

    float alpha = ring * lobe * radial * uOpacity;
    if (alpha < 0.01) discard;
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

interface CameraRigProps {
  scene: THREE.Object3D;
  active: Section | null;
  hovered: Section | null;
}

function CameraRig({ scene, active, hovered }: CameraRigProps) {
  useFrame((state, dt) => {
    const target = scene.getObjectByName(active ? `cam_${active}` : 'cam_home');
    if (!target) return;

    target.getWorldPosition(targetPos);
    target.getWorldQuaternion(targetQuat);

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
    state.camera.position.lerp(targetPos, k);
    state.camera.quaternion.slerp(targetQuat, k);
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

function PracticalLights({ scene }: { scene: THREE.Object3D }) {
  const attached = useRef<AttachedLight[]>([]);

  useLayoutEffect(() => {
    const created: AttachedLight[] = [];
    const restore: { mesh: THREE.Mesh; material: THREE.Material | THREE.Material[] }[] = [];

    FIXTURES.forEach((fixture) => {
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
  }, [scene]);

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
}

function Scene({ activeSection, hoveredSection, onNavigate, onHover }: SceneProps) {
  const group = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState<Section | null>(null);
  const releaseTimer = useRef<number | null>(null);

  // Publish 3D hover upward so the nav labels light up in step with the tower.
  // Held in a ref so a re-created callback can't retrigger the effect.
  const onHoverRef = useRef(onHover);
  onHoverRef.current = onHover;
  useEffect(() => {
    onHoverRef.current(hovered);
  }, [hovered]);
  const { scene, animations } = useGLTF('/DA.glb');
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
    if (releaseTimer.current !== null) {
      clearTimeout(releaseTimer.current);
      releaseTimer.current = null;
    }
    pointerMoved.current = false;
    setHovered(section);
  };

  const handleOut = () => {
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
      <group ref={group} position={MODEL_POSITION} scale={MODEL_SCALE}>
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
      <PracticalLights scene={scene} />
      <RadioWaves scene={scene} />
      {/* Driven by the shared hover state, so pointing at a nav label leans the
          camera exactly as pointing at the tower itself does. */}
      <CameraRig scene={scene} active={activeSection} hovered={hoveredSection} />
    </>
  );
}

interface ModelViewerProps {
  activeSection: Section | null;
  hoveredSection: Section | null;
  onNavigate: (section: Section) => void;
  onHover: (section: Section | null) => void;
  onClose: () => void;
}

export default function ModelViewer({
  activeSection,
  hoveredSection,
  onNavigate,
  onHover,
  onClose,
}: ModelViewerProps) {
  return (
    <div className="w-full h-screen">
      <Canvas
        style={{ background: 'transparent' }}
        onPointerMissed={onClose}
      >
        <Suspense fallback={null}>
          {/* Ambient / key — dim on purpose so the tower's own fixtures carry the scene */}
          <ambientLight intensity={AMBIENT_LIGHT} color={AMBIENT_COLOR} />
          <directionalLight
            position={KEY_LIGHT_POSITION}
            intensity={KEY_LIGHT_INTENSITY}
            color={KEY_LIGHT_COLOR}
          />

          {/* 3D Model + camera rig */}
          <Scene
            activeSection={activeSection}
            hoveredSection={hoveredSection}
            onNavigate={onNavigate}
            onHover={onHover}
          />

          {/* Environment for reflections */}
          <Environment preset={ENVIRONMENT_PRESET} environmentIntensity={ENVIRONMENT_INTENSITY} />

          {/* Ground shadow */}
          <ContactShadows
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
