import type { TabId } from '@/types/navigation';
import { TABS } from '@/types/navigation';

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
        if (currentIndex > 0) {
          targetIndex = currentIndex - 1;
        }
        e.preventDefault();
        break;

      case 'ArrowRight':
        if (currentIndex < TABS.length - 1) {
          targetIndex = currentIndex + 1;
        }
        e.preventDefault();
        break;

      case 'Home':
        targetIndex = 0;
        e.preventDefault();
        break;

      case 'End':
        targetIndex = TABS.length - 1;
        e.preventDefault();
        break;
    }

    if (targetIndex !== null) {
      const targetTab = TABS[targetIndex];
      onTabChange(targetTab.id);

      setTimeout(() => {
        const targetButton = document.getElementById(`tab-${targetTab.id}`);
        targetButton?.focus();
      }, 0);
    }
  };

  return (
    <div className="flex px-4 sm:px-6 lg:px-8">
      <div role="tablist" aria-label="Main navigation" className="flex">
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
              className={`px-4 sm:px-5 py-3.5 text-xs font-medium tracking-wide whitespace-nowrap border-b-2 transition-colors
                focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-600
                ${isActive
                  ? 'border-amber-600 text-amber-500'
                  : 'border-transparent text-stone-500 hover:text-stone-300'
                }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
