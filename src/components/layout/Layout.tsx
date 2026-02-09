import type { ReactNode } from 'react';

interface LayoutProps {
  header: ReactNode;
  navbar: ReactNode;
  children: ReactNode;
}

/**
 * App shell layout with fixed header, navbar, scrollable content, and optional fixed timeline.
 * Pure composition component - no state management.
 */
export function Layout({ header, navbar, children }: LayoutProps) {
  return (
    <div
      className="min-h-screen text-stone-200"
      style={{
        fontFamily: 'var(--font-body)',
        background:
          'radial-gradient(ellipse at 20% 0%, rgba(180,130,80,0.04) 0%, transparent 50%), radial-gradient(ellipse at 80% 100%, rgba(180,130,80,0.025) 0%, transparent 50%), #0e0d0c',
      }}
    >
      {/* Fixed header at top */}
      <header
        className="sticky top-0 z-50 border-b border-stone-800/80"
        style={{ background: 'rgba(14,13,12,0.92)', backdropFilter: 'blur(12px)' }}
      >
        {header}
      </header>

      {/* Main content area */}
      <main>
        {/* Navbar scrolls with content, sits below header */}
        <nav
          className="border-b border-stone-800/80 overflow-x-auto"
          style={{ background: 'rgba(14,13,12,0.8)' }}
        >
          {navbar}
        </nav>

        {/* Scrollable content container */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
