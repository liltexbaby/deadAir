'use client';

import { SECTIONS, SECTION_LABELS, type Section } from '@/lib/sections';

interface NavigationProps {
  selectedSection: Section | null;
  hoveredSection: Section | null;
  onSectionClick: (section: Section) => void;
  onSectionHover: (section: Section | null) => void;
}


export default function Navigation({
  selectedSection,
  hoveredSection,
  onSectionClick,
  onSectionHover,
}: NavigationProps) {
  return (
    // Phones get 10px type, tighter tracking and gaps so all six items sit on
    // one line from 360px up (measured; desktop's 11px/0.2em needs ~420px).
    // Wrapping stays on as the fallback for anything narrower — every section
    // stays reachable without a hidden-overflow gesture nobody would discover.
    <nav className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 sm:gap-x-7 px-2 sm:px-3">
      {SECTIONS.map((section) => {
        const isSelected = selectedSection === section;
        // hoveredSection is also set by the 3D tower, so pointing at a hit proxy
        // lights up the matching label here.
        const isHovered = hoveredSection === section;
        const isActive = isSelected || isHovered;

        return (
          <button
            key={section}
            onClick={() => onSectionClick(section)}
            onMouseEnter={() => onSectionHover(section)}
            onMouseLeave={() => onSectionHover(null)}
            className={`
              relative font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.1em] sm:tracking-[0.2em]
              py-2.5 sm:py-0 transition-all duration-200 cursor-pointer
              ${isSelected ? 'text-black font-bold' : isHovered ? 'text-black/70' : 'text-black/45'}
            `}
          >
            <span
              aria-hidden
              className={`absolute -left-2.5 transition-opacity duration-200 ${
                isSelected ? 'opacity-100' : isHovered ? 'opacity-40' : 'opacity-0'
              }`}
            >
              [
            </span>

            {SECTION_LABELS[section]}
            {/* Store leaves the site (new tab) — say so before the click. */}
            {section === 'store' && <span aria-hidden className="ml-0.5">↗</span>}

            <span
              aria-hidden
              className={`absolute -right-2.5 transition-opacity duration-200 ${
                isSelected ? 'opacity-100' : isHovered ? 'opacity-40' : 'opacity-0'
              }`}
            >
              ]
            </span>

            {/* Always mounted, toggled by opacity.
                This used to be a `layoutId` shared-layout element rendered only
                while active. That makes framer animate the box *between*
                buttons, and on the first hover there is no previous position to
                travel from — so it flew in from the far left of the viewport.
                A plain fade has no origin to get wrong: the box only ever
                appears where it already is. */}
            <span
              aria-hidden
              className={`absolute -inset-x-3 -inset-y-1 -z-10 bg-black/[0.06] transition-opacity duration-200 ${
                isActive ? 'opacity-100' : 'opacity-0'
              }`}
            />
          </button>
        );
      })}
    </nav>
  );
}
