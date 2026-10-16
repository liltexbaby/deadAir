'use client';

import { motion } from 'framer-motion';
import { SECTIONS, SECTION_LABELS, type Section } from '@/lib/sections';

// Shared by the label and its light copy inside the bar, so the two line up
// exactly. The padding is the bar's box (and the tap target).
const ITEM =
  'px-1.5 py-2.5 sm:px-3 sm:py-1 font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.1em] sm:tracking-[0.2em] whitespace-nowrap';

interface NavigationProps {
  selectedSection: Section | null;
  hoveredSection: Section | null;
  onSectionClick: (section: Section) => void;
  onSectionHover: (section: Section | null) => void;
  /** False until the scene has loaded; the items come online when it flips. */
  booted?: boolean;
}

// Boot: when the interface comes online, items appear left to right, each
// with one pass of the selection bar sweeping across it.
const BOOT_DELAY_S = 0.95;   // after the tower starts appearing (logo is at ~0.5)
const BOOT_STAGGER_S = 0.09;

export default function Navigation({
  selectedSection,
  hoveredSection,
  onSectionClick,
  onSectionHover,
  booted = true,
}: NavigationProps) {
  // The dark bar sits on whatever is pointed at — here or on the 3D tower,
  // which also sets hoveredSection — and rests on the open section otherwise.
  const barOn = hoveredSection ?? selectedSection;

  return (
    // Phones get 10px type, tighter tracking and gaps so all six items sit on
    // one line from 360px up (measured; desktop's 11px/0.2em needs ~420px).
    // Wrapping stays on as the fallback for anything narrower — every section
    // stays reachable without a hidden-overflow gesture nobody would discover.
    // Spacing now comes mostly from each button's own padding (the bar's box),
    // so the gaps are small; the text-to-text distance is unchanged.
    <nav data-sfx="hover-only" className="ui-nav flex flex-wrap items-center justify-center gap-x-0 gap-y-1 sm:gap-x-1 px-2 sm:px-3">
      {SECTIONS.map((section, i) => {
        const bootDelay = BOOT_DELAY_S + i * BOOT_STAGGER_S;
        const isSelected = selectedSection === section;
        const hasBar = barOn === section;

        const label = SECTION_LABELS[section];

        return (
          <motion.button
            key={section}
            initial={false}
            animate={{ opacity: booted ? 1 : 0 }}
            transition={{ duration: 0.18, delay: booted ? bootDelay : 0 }}
            onClick={() => onSectionClick(section)}
            onMouseEnter={() => onSectionHover(section)}
            onMouseLeave={() => onSectionHover(null)}
            aria-current={isSelected ? 'page' : undefined}
            className={`ui-nav-item relative ${ITEM} cursor-pointer transition-colors duration-200 ${
              isSelected ? 'text-black' : 'text-black/50 hover:text-black/70'
            }`}
          >
            {label}

            {/* NieR-style selection, as in the MGMT roster: a dark bar wipes in
                from the left over a light copy of the label, so the text flips
                exactly where the bar's edge passes. Always mounted — it only
                ever wipes in place, so there's no origin to fly in from. */}
            <span
              aria-hidden
              className={`ui-wipe absolute inset-0 ${ITEM} bg-black/80 text-white transition-[clip-path] ease-[cubic-bezier(0.16,1,0.3,1)] ${
                hasBar ? '[clip-path:inset(0_0_0_0)] duration-300' : '[clip-path:inset(0_100%_0_0)] duration-200'
              }`}
            >
              {label}
            </span>

            {/* The boot sweep: one pass of the bar, in from the left and out to
                the right, as the item appears. Clipped away afterwards. */}
            {booted && (
              <motion.span
                aria-hidden
                className={`ui-wipe pointer-events-none absolute inset-0 ${ITEM} bg-black/80 text-white`}
                initial={{ clipPath: 'inset(0% 100% 0% 0%)' }}
                animate={{ clipPath: ['inset(0% 100% 0% 0%)', 'inset(0% 0% 0% 0%)', 'inset(0% 0% 0% 100%)'] }}
                transition={{ delay: bootDelay, duration: 0.5, times: [0, 0.45, 1], ease: [0.16, 1, 0.3, 1] }}
              >
                {label}
              </motion.span>
            )}
          </motion.button>
        );
      })}
    </nav>
  );
}
