'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type WheelEvent } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import ModelViewer, { type HeaderTone } from './ModelViewer';
import SoundEffects from './SoundEffects';
import { playSfx } from '@/lib/sound';
import Navigation from './Navigation';
import RightPanel from './RightPanel';
import CatalogGrid from './catalog/CatalogGrid';
import MgmtPanel from './panels/MgmtPanel';
import LivePanel from './panels/LivePanel';
import StorePanel from './panels/StorePanel';
import GalleryPanel from './panels/GalleryPanel';

import { SECTIONS, SECTION_LABELS, type Section } from '@/lib/sections';
import type { SiteContent } from '@/lib/queries';
import { useIsNarrow } from '@/lib/useCoarsePointer';
import SceneLoader from './SceneLoader';
import SceneErrorBoundary from './SceneErrorBoundary';
import ClientErrorReporter from './ClientErrorReporter';

// The artist's power-lines drawing, in its fainter version (dAweb2).
// `?bg=dark` shows the stronger-lined dAbg instead, for comparison.
const BACKGROUND = '/bg-power-lines-light.jpg';
const BACKGROUND_DARK = '/bg-power-lines.jpg';
const noSubscribe = () => () => {};
function useBackground(): string {
  return useSyncExternalStore(
    noSubscribe,
    () => (new URLSearchParams(window.location.search).get('bg') === 'dark' ? BACKGROUND_DARK : BACKGROUND),
    () => BACKGROUND,
  );
}

// Scroll-to-next-shot (see handleWheel). null = the home shot.
const SHOT_ORDER: (Section | null)[] = [null, ...SECTIONS];
const BOOT_FALLBACK_MS = 15000;
const WHEEL_STEP = 60;      // px of scroll before a gesture counts
const WHEEL_GAP_MS = 250;   // a pause this long ends a gesture

/**
 * All the interactive shell: 3D scene, nav, panel state. Content arrives as a
 * prop from the Server Component in app/page.tsx, which is what lets the site
 * read from the database while this stays a client component.
 */
export default function SiteShell({ content }: { content: SiteContent }) {
  const [selectedSection, setSelectedSection] = useState<Section | null>(null);
  const [hoveredSection, setHoveredSection] = useState<Section | null>(null);

  const handleSectionClick = (section: Section) => {
    setSelectedSection(selectedSection === section ? null : section);
  };

  // Panel sounds come from the section state, not the controls, so the nav,
  // the tower, Escape, the close button and the logo all sound the same:
  // opening from home, closing back to it, or switching while open.
  const shownSection = useRef<Section | null>(null);
  useEffect(() => {
    const prev = shownSection.current;
    shownSection.current = selectedSection;
    if (prev === selectedSection) return;
    if (prev === null) playSfx('panel-open');
    else if (selectedSection === null) playSfx('panel-close');
    else playSfx('press');
  }, [selectedSection]);

  // Pointing at a section on the tower ticks like hovering its nav item.
  const handleTowerHover = (section: Section | null) => {
    if (section && section !== hoveredSection) playSfx('hover');
    setHoveredSection(section);
  };

  const handleClose = () => {
    setSelectedSection(null);
  };

  // dA logo: back to the untouched landing state — panel closed (which also
  // flies the camera home) and no lingering hover lean.
  const handleReset = () => {
    setSelectedSection(null);
    setHoveredSection(null);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const renderPanelContent = () => {
    switch (selectedSection) {
      case 'catalog':
        return <CatalogGrid releases={content.releases} />;
      case 'live':
        return <LivePanel events={content.events} />;
      // Slug is still 'contact' (it's baked into the GLB); the panel is PUBLISHING.
      case 'contact':
        return (
          <MgmtPanel
            artists={content.publishingArtists}
            showContacts={false}
            label="Publishing roster"
            emptyText="no publishing clients listed yet"
          />
        );
      case 'mgmt':
        return <MgmtPanel artists={content.managedArtists} />;
      case 'store':
        return (
          <StorePanel
            products={content.storeProducts}
            knownNames={[...content.managedArtists, ...content.publishingArtists].map((a) => a.name)}
          />
        );
      case 'gallery':
        return <GalleryPanel items={content.gallery} />;
      default:
        return null;
    }
  };

  const isPanelOpen = selectedSection !== null;
  const isNarrow = useIsNarrow();
  // A full-screen phone sheet covers the header, so hide it there; the panel's
  // own header carries the logo/reset meanwhile.
  const hideHeader = isPanelOpen && isNarrow;

  // Desktop: scrolling over the tower steps through the camera shots, in nav
  // order, starting from home. STORE is skipped — it leaves the site.
  //
  // Forgiving by design: a gesture has to travel WHEEL_STEP px to count, and
  // one gesture moves exactly one shot. A gesture ends after a WHEEL_GAP_MS
  // pause, so a trackpad's inertial tail or a fast wheel spin can't skip
  // several sections at once — scroll again to keep going. Scrolling over an
  // open panel never reaches here; it scrolls the panel as usual.
  const wheel = useRef({ accum: 0, last: 0, spent: false });
  const handleWheel = (e: WheelEvent<HTMLDivElement>) => {
    if (isNarrow) return;
    const g = wheel.current;
    const now = performance.now();
    if (now - g.last > WHEEL_GAP_MS) {
      g.accum = 0;
      g.spent = false;
    }
    g.last = now;
    if (g.spent) return;

    // Line-mode wheels (some Firefox setups) report lines, not pixels.
    g.accum += e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    if (Math.abs(g.accum) < WHEEL_STEP) return;
    g.spent = true;

    const i = SHOT_ORDER.indexOf(selectedSection);
    const next = SHOT_ORDER[Math.min(Math.max(i + Math.sign(g.accum), 0), SHOT_ORDER.length - 1)];
    if (next !== selectedSection) {
      setSelectedSection(next);
      setHoveredSection(null);
    }
  };

  // Decide the model once, before the Canvas mounts. useGLTF caches by URL, so
  // swapping it after load would refetch the whole thing; and resolving it in an
  // effect (rather than during render) keeps SSR and first client render
  // identical, so there's nothing for hydration to mismatch on.
  const background = useBackground();
  // Light or dark ink for the logo and nav, measured off the scene behind
  // them (ModelViewer's HeaderToneProbe; styles in globals.css).
  const [headerTone, setHeaderTone] = useState<HeaderTone>('dark');

  // Boot: the logo and nav stay dark until the tower has loaded, then come
  // online with it — so the page assembles as one machine starting up rather
  // than UI first and a 3D model trailing in. If the scene fails, or is
  // still loading after BOOT_FALLBACK_MS, the interface boots on its own.
  const [booted, setBooted] = useState(false);
  const boot = useCallback(() => setBooted(true), []);
  useEffect(() => {
    const t = setTimeout(boot, BOOT_FALLBACK_MS);
    return () => clearTimeout(t);
  }, [boot]);
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  useEffect(() => {
    // The lighter 1K-texture tower everywhere; dev-only ?fulltower loads the
    // full desktop one for comparison (see useFullTowerPreview in ModelViewer).
    const full =
      process.env.NODE_ENV !== 'production' &&
      new URLSearchParams(window.location.search).has('fulltower');
    setModelUrl(full ? '/DA.glb' : '/DA.mobile.glb');
  }, []);

  return (
    <main
      className="ui-stage relative w-full h-dvh overflow-hidden bg-[#f6f3ee] bg-cover bg-center"
      style={{ backgroundImage: `url('${background}')` }}
    >
      {/* Background art sits behind the transparent canvas. The flat colour
          is the drawing's own sky tone, so nothing flashes while it loads. */}
      {/* 3D Model Overlay. Boundary is deliberately INSIDE this wrapper so a
          WebGL failure only takes down the scene — the nav and panels above
          keep working rather than the whole client tree unwinding. */}
      <div className="absolute inset-0 z-10" onWheel={handleWheel}>
        <SceneErrorBoundary onError={boot}>
          {modelUrl && (
            <ModelViewer
              activeSection={selectedSection}
              hoveredSection={hoveredSection}
              onNavigate={handleSectionClick}
              onHover={handleTowerHover}
              onClose={handleClose}
              modelUrl={modelUrl}
              onHeaderTone={setHeaderTone}
              onReady={boot}
            />
          )}
        </SceneErrorBoundary>
      </div>

      <ClientErrorReporter />

      <SceneLoader done={booted} />

      {/* Logo + nav. On desktop the panel takes the right half, so this shifts a
          quarter of the viewport left to stay centred in what's still visible.
          On mobile the panel is a full-width sheet that covers this entirely, so
          the shift would only push the nav off-screen. */}
      <motion.div
        data-tone={headerTone}
        className="ui-header fixed top-0 left-0 right-0 z-50 flex flex-col items-center gap-4 sm:gap-5 pt-[calc(env(safe-area-inset-top,0px)+1.75rem)] sm:pt-[calc(env(safe-area-inset-top,0px)+2.25rem)]"
        animate={{
          x: isPanelOpen && !isNarrow ? '-25vw' : 0,
          // On mobile the panel is a full-screen sheet, so a z-50 header would
          // sit on top of its content. Desktop keeps the header visible because
          // the panel only takes the right half.
          opacity: hideHeader ? 0 : 1,
        }}
        // The box itself never takes clicks: it's full-width and slides 25vw
        // left with a half panel open, so it would sit invisibly over the
        // panel's top-left and swallow clicks there (the panel logo, MGMT's
        // prev button). Only the logo and nav opt back in.
        style={{ pointerEvents: 'none' }}
        transition={{ type: 'tween', duration: 0.3, ease: 'easeInOut' }}
      >
        {/* Client request: clicking the logo always resets the page. */}
        <button
          onClick={handleReset}
          data-sfx="hover-only"
          aria-label="deadAir — back to start"
          className="cursor-pointer"
          style={{ pointerEvents: hideHeader || !booted ? 'none' : 'auto' }}
        >
          {/* Boot: the logo flickers on like a CRT warming up, just after the
              tower starts to appear and before the nav. */}
          <motion.span
            className="block"
            initial={false}
            animate={booted ? { opacity: [0, 1, 0.15, 0.9, 0.4, 1] } : { opacity: 0 }}
            transition={booted ? { delay: 0.5, duration: 0.55, times: [0, 0.15, 0.3, 0.5, 0.7, 1] } : { duration: 0 }}
          >
            <Image
              src="/dA.png"
              alt="Dead Air"
              width={56}
              height={55}
              priority
              // The logo file is white; invert rather than ship a second copy now
              // that the site sits on a light background.
              className="w-11 h-auto sm:w-14 opacity-90 invert"
            />
          </motion.span>
        </button>

        <div style={{ pointerEvents: hideHeader || !booted ? 'none' : 'auto' }}>
          <Navigation
            booted={booted}
            selectedSection={selectedSection}
            hoveredSection={hoveredSection}
            onSectionClick={handleSectionClick}
            onSectionHover={setHoveredSection}
          />
        </div>
      </motion.div>

      <SoundEffects />

      {/* Right Panel with content */}
      <RightPanel
        isOpen={isPanelOpen}
        title={selectedSection ? SECTION_LABELS[selectedSection].toUpperCase() : ''}
        onClose={handleClose}
        onReset={handleReset}
      >
        {renderPanelContent()}
      </RightPanel>
    </main>
  );
}
