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
export function Layout({ header, navbar, timeline, children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Fixed header at top */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-sm border-b border-muted">
        {header}
      </header>

      {/* Main content area with padding for fixed header only */}
      <main className="pt-16">
        {/* Navbar scrolls with content, sits below fixed header */}
        {navbar}

        {/* Scrollable content container */}
        <div className="container mx-auto px-4 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
