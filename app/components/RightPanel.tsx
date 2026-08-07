'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { ReactNode } from 'react';

interface RightPanelProps {
  isOpen: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}

export default function RightPanel({ isOpen, title, children, onClose }: RightPanelProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'tween', duration: 0.3, ease: 'easeInOut' }}
          className="fixed top-0 right-0 w-1/2 h-screen bg-black/40 backdrop-blur-xl border-l border-white/15 z-40 overflow-hidden"
        >
          {/* Header */}
          <div className="relative px-8 py-5 border-b border-white/10">
            <h2 className="font-mono text-xs uppercase tracking-[0.25em] text-white/90">
              {title}
            </h2>

            <button
              onClick={onClose}
              className="absolute top-4 right-8 font-mono text-[10px] uppercase tracking-[0.2em] text-white/45 hover:text-white/90 transition-colors cursor-pointer"
            >
              [esc] close
            </button>
          </div>

          {/* Content area */}
          <div className="h-[calc(100vh-72px)] overflow-y-auto px-8 py-6">{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
