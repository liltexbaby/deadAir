'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import ModelViewer from './ModelViewer';
import Navigation from './Navigation';
import RightPanel from './RightPanel';
import CatalogGrid from './catalog/CatalogGrid';
import MgmtPanel from './panels/MgmtPanel';
import LivePanel from './panels/LivePanel';
import ContactPanel from './panels/ContactPanel';

import type { Section } from '@/lib/sections';
import type { SiteContent } from '@/lib/queries';
import { useIsNarrow } from '@/lib/useCoarsePointer';
import SceneLoader from './SceneLoader';
import SceneErrorBoundary from './SceneErrorBoundary';
import ClientErrorReporter from './ClientErrorReporter';

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

  const handleClose = () => {
    setSelectedSection(null);
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
      case 'store':
        return (
          <div className="font-mono text-white/90">
            <p className="text-xs uppercase tracking-[0.2em] text-white/50">□ STORE SECTION</p>
            <p className="mt-3 text-sm text-white/60">Merchandise and physical releases coming soon...</p>
          </div>
        );
      case 'contact':
        return <ContactPanel settings={content.settings} />;
      case 'mgmt':
        return <MgmtPanel artists={content.managedArtists} />;
      case 'gallery':
        return (
          <div className="font-mono text-white/90">
            <p className="text-xs uppercase tracking-[0.2em] text-white/50">□ GALLERY SECTION</p>
            <p className="mt-3 text-sm text-white/60">Photos and media gallery coming soon...</p>
          </div>
        );
      default:
        return null;
    }
  };

  const isPanelOpen = selectedSection !== null;
  const isNarrow = useIsNarrow();

  // Decide the model once, before the Canvas mounts. useGLTF caches by URL, so
  // swapping it after load would refetch the whole thing; and resolving it in an
  // effect (rather than during render) keeps SSR and first client render
  // identical, so there's nothing for hydration to mismatch on.
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  useEffect(() => {
    const small = window.matchMedia('(max-width: 639px)').matches;
    setModelUrl(small ? '/DA.mobile.glb' : '/DA.glb');
  }, []);

  return (
    <main className="relative w-full h-dvh overflow-hidden bg-[#0b0b0c]">
      {/* 3D Model Overlay. Boundary is deliberately INSIDE this wrapper so a
          WebGL failure only takes down the scene — the nav and panels above
          keep working rather than the whole client tree unwinding. */}
      <div className="absolute inset-0 z-10">
        <SceneErrorBoundary>
          {modelUrl && (
            <ModelViewer
              activeSection={selectedSection}
              hoveredSection={hoveredSection}
              onNavigate={handleSectionClick}
              onHover={setHoveredSection}
              onClose={handleClose}
              modelUrl={modelUrl}
            />
          )}
        </SceneErrorBoundary>
      </div>

      <ClientErrorReporter />

      <SceneLoader />

      {/* Logo + nav. On desktop the panel takes the right half, so this shifts a
          quarter of the viewport left to stay centred in what's still visible.
          On mobile the panel is a full-width sheet that covers this entirely, so
          the shift would only push the nav off-screen. */}
      <motion.div
        className="fixed top-0 left-0 right-0 z-50 flex flex-col items-center gap-4 sm:gap-5 pt-[calc(env(safe-area-inset-top,0px)+1.75rem)] sm:pt-[calc(env(safe-area-inset-top,0px)+2.25rem)]"
        animate={{
          x: isPanelOpen && !isNarrow ? '-25vw' : 0,
          // On mobile the panel is a full-screen sheet, so a z-50 header would
          // sit on top of its content. Desktop keeps the header visible because
          // the panel only takes the right half.
          opacity: isPanelOpen && isNarrow ? 0 : 1,
        }}
        style={{ pointerEvents: isPanelOpen && isNarrow ? 'none' : 'auto' }}
        transition={{ type: 'tween', duration: 0.3, ease: 'easeInOut' }}
      >
        <Image
          src="/dA.png"
          alt="Dead Air"
          width={56}
          height={55}
          priority
          className="w-11 h-auto sm:w-14 opacity-90"
        />

        <Navigation
          selectedSection={selectedSection}
          hoveredSection={hoveredSection}
          onSectionClick={handleSectionClick}
          onSectionHover={setHoveredSection}
        />
      </motion.div>

      {/* Right Panel with content */}
      <RightPanel
        isOpen={isPanelOpen}
        title={selectedSection?.toUpperCase() || ''}
        onClose={handleClose}
      >
        {renderPanelContent()}
      </RightPanel>
    </main>
  );
}
