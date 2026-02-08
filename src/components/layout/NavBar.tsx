import type { TabId } from '@/types/navigation';
import { TABS } from '@/types/navigation';
import { cn } from '@/lib/utils';

interface NavBarProps {
  activeTab: TabId;
  onTabChange: (id: TabId) => void;
}

/**
 * Horizontal tab navigation with ARIA roles and keyboard navigation.
 * Supports arrow keys, Home, and End for keyboard navigation.
 */
export function NavBar({ activeTab, onTabChange }: NavBarProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    let targetIndex: number | null = null;

    switch (e.key) {
      case 'ArrowLeft':
        // Move to previous tab (stop at first)
        if (currentIndex > 0) {
          targetIndex = currentIndex - 1;
        }
        e.preventDefault();
        break;

      case 'ArrowRight':
        // Move to next tab (stop at last)
        if (currentIndex < TABS.length - 1) {
          targetIndex = currentIndex + 1;
        }
        e.preventDefault();
        break;

      case 'Home':
        // Move to first tab
        targetIndex = 0;
        e.preventDefault();
        break;

      case 'End':
        // Move to last tab
        targetIndex = TABS.length - 1;
        e.preventDefault();
        break;
    }

    // Change tab and focus the target button
    if (targetIndex !== null) {
      const targetTab = TABS[targetIndex];
      onTabChange(targetTab.id);

      // Focus the newly active tab button
      setTimeout(() => {
        const targetButton = document.getElementById(`tab-${targetTab.id}`);
        targetButton?.focus();
      }, 0);
    }
  };

  return (
    <div className="border-b border-muted bg-card/50">
      <div className="container mx-auto px-4">
        <div role="tablist" aria-label="Main navigation" className="flex gap-1">
          {TABS.map((tab, index) => {
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                role="tab"
                aria-selected={isActive}
                aria-controls={`panel-${tab.id}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => onTabChange(tab.id)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                className={cn(
                  'px-6 py-3 text-sm font-medium border-b-2 transition-colors',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted'
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
