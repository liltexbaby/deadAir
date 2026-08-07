'use client';

import { motion } from 'framer-motion';

import { SECTIONS, type Section } from '@/lib/sections';

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
    <nav className="flex items-center justify-center gap-7">
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
              relative font-mono text-[11px] uppercase tracking-[0.2em]
              transition-all duration-200 cursor-pointer
              ${isSelected ? 'text-white font-bold' : isHovered ? 'text-white/70' : 'text-white/45'}
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

            {section}

            <span
              aria-hidden
              className={`absolute -right-2.5 transition-opacity duration-200 ${
                isSelected ? 'opacity-100' : isHovered ? 'opacity-40' : 'opacity-0'
              }`}
            >
              ]
            </span>

            {isActive && (
              <motion.span
                aria-hidden
                layoutId="nav-glow"
                transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                className="absolute -inset-x-3 -inset-y-1 -z-10 bg-white/[0.06]"
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}
