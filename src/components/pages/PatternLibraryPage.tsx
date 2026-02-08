import { useState } from 'react';
import type { Ultra } from '@xsense/autoblow-sdk';
import type { PatternDefinition } from '@/types/patterns';
import { PATTERN_DEFINITIONS } from '@/lib/patternDefinitions';
import { usePatternFilters } from '@/hooks/usePatternFilters';
import { PatternFilters } from '@/components/pattern-library/PatternFilters';
import { PatternGrid } from '@/components/pattern-library/PatternGrid';
import { PatternDetailDialog } from '@/components/pattern-library/PatternDetailDialog';
import { InsertPositionDialog } from '@/components/pattern-library/InsertPositionDialog';

interface PatternLibraryPageProps {
  onInsert: (pattern: PatternDefinition, position: 'cursor' | 'end') => void;
  isCreationMode?: boolean;
  ultra: Ultra | null;
  isDeviceConnected: boolean;
}

/**
 * Pattern Library page - presentation component for browsing and inserting patterns
 * Filter state is local to this page (per research recommendation)
 */
export function PatternLibraryPage({
  onInsert,
  isCreationMode = false,
  ultra,
  isDeviceConnected,
}: PatternLibraryPageProps) {
  // Filter state
  const {
    searchText,
    setSearchText,
    intensities,
    toggleIntensity,
    styles,
    toggleStyle,
    directions,
    toggleDirection,
    clearFilters,
    filteredPatterns,
  } = usePatternFilters(PATTERN_DEFINITIONS);

  // Dialog state
  const [selectedPattern, setSelectedPattern] = useState<PatternDefinition | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showInsertDialog, setShowInsertDialog] = useState(false);

  // Handle pattern card click
  const handlePatternClick = (pattern: PatternDefinition) => {
    setSelectedPattern(pattern);
    setShowDetailDialog(true);
  };

  // Handle insert button click in detail dialog
  const handleInsertClick = (pattern: PatternDefinition) => {
    setShowDetailDialog(false);

    // In creation mode, always insert at end (no cursor position available)
    if (isCreationMode) {
      onInsert(pattern, 'end');
      setSelectedPattern(null);
    } else {
      // Show position dialog for normal mode
      setSelectedPattern(pattern);
      setShowInsertDialog(true);
    }
  };

  // Handle position selection in insert dialog
  const handlePositionSelect = (position: 'cursor' | 'end') => {
    if (selectedPattern) {
      onInsert(selectedPattern, position);
      setShowInsertDialog(false);
      setSelectedPattern(null);
    }
  };

  // Handle quick add (creation mode only)
  const handleQuickAdd = (pattern: PatternDefinition) => {
    onInsert(pattern, 'end');
  };

  // Close dialogs
  const handleCloseDetailDialog = () => {
    setShowDetailDialog(false);
    setSelectedPattern(null);
  };

  const handleCloseInsertDialog = () => {
    setShowInsertDialog(false);
    setSelectedPattern(null);
  };

  return (
    <div
      role="tabpanel"
      id="panel-pattern-library"
      aria-labelledby="tab-pattern-library"
      className="container mx-auto px-4 py-6"
    >
      <h1 className="text-2xl font-bold text-foreground mb-6">
        Pattern Library
      </h1>

      {/* Filters */}
      <PatternFilters
        searchText={searchText}
        onSearchChange={setSearchText}
        intensities={intensities}
        onToggleIntensity={toggleIntensity}
        styles={styles}
        onToggleStyle={toggleStyle}
        directions={directions}
        onToggleDirection={toggleDirection}
      />

      {/* Grid */}
      <PatternGrid
        patterns={filteredPatterns}
        totalCount={PATTERN_DEFINITIONS.length}
        onPatternClick={handlePatternClick}
        onClearFilters={clearFilters}
        isCreationMode={isCreationMode}
        onQuickAdd={handleQuickAdd}
      />

      {/* Detail Dialog */}
      <PatternDetailDialog
        pattern={selectedPattern}
        isOpen={showDetailDialog}
        onClose={handleCloseDetailDialog}
        onInsert={handleInsertClick}
        ultra={ultra}
        isDeviceConnected={isDeviceConnected}
      />

      {/* Insert Position Dialog */}
      <InsertPositionDialog
        isOpen={showInsertDialog}
        onClose={handleCloseInsertDialog}
        onInsert={handlePositionSelect}
      />
    </div>
  );
}
