'use client';

import { Component, type ReactNode } from 'react';

/**
 * Keeps a 3D failure contained.
 *
 * Without this, anything thrown while mounting the Canvas (WebGL context
 * refused, GPU memory cap, a decoder failing) unwinds the whole client tree.
 * The server-rendered nav stays painted but is completely dead — no click
 * handlers, no canvas — which looks like "the site is frozen" rather than "the
 * 3D scene failed". The rest of the UI should survive the tower dying.
 *
 * On failure it also surfaces the message on screen, because the devices where
 * this actually happens (phones) are the ones without a console to check.
 */
interface State {
  error: Error | null;
}

export default class SceneErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  State
> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error('[scene] failed to render:', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="absolute inset-0 flex items-center justify-center p-8 pointer-events-none">
        <div className="max-w-sm text-center pointer-events-auto">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/40">
            3d scene unavailable
          </p>
          <p className="mt-3 font-mono text-[10px] leading-relaxed text-white/30 break-words">
            {this.state.error.message || String(this.state.error)}
          </p>
          <p className="mt-4 font-mono text-[10px] text-white/25">
            the rest of the site still works — use the menu above
          </p>
        </div>
      </div>
    );
  }
}
