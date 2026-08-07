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

  return (
    <main className="relative w-full h-screen overflow-hidden bg-[#0b0b0c]">
      {/* 3D Model Overlay */}
      <div className="absolute inset-0 z-10">
        <ModelViewer
          activeSection={selectedSection}
          hoveredSection={hoveredSection}
          onNavigate={handleSectionClick}
          onHover={setHoveredSection}
          onClose={handleClose}
        />
      </div>

      {/* Logo + nav. The panel takes the right half, so this shifts a quarter of
          the viewport left to stay centred in what's still visible. */}
      <motion.div
        className="fixed top-0 left-0 right-0 z-50 flex flex-col items-center gap-5 pt-7"
        animate={{ x: isPanelOpen ? '-25vw' : 0 }}
        transition={{ type: 'tween', duration: 0.3, ease: 'easeInOut' }}
      >
        <Image src="/dA.png" alt="Dead Air" width={56} height={55} priority className="opacity-90" />

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
