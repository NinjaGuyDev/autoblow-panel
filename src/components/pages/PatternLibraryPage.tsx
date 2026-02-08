import { useState, useEffect } from 'react';
import type { Ultra } from '@xsense/autoblow-sdk';
import type { PatternDefinition, CustomPatternDefinition, AnyPattern } from '@/types/patterns';
import { PATTERN_DEFINITIONS } from '@/lib/patternDefinitions';
import { usePatternFilters } from '@/hooks/usePatternFilters';
import { usePatternEditor } from '@/hooks/usePatternEditor';
import { PatternFilters } from '@/components/pattern-library/PatternFilters';
import { PatternGrid } from '@/components/pattern-library/PatternGrid';
import { PatternDetailDialog } from '@/components/pattern-library/PatternDetailDialog';
import { PatternEditorDialog } from '@/components/pattern-library/PatternEditorDialog';
import { InsertPositionDialog } from '@/components/pattern-library/InsertPositionDialog';
import { createEditableCopy } from '@/lib/patternTransform';
import { customPatternApi } from '@/lib/apiClient';
import type { LibraryItem } from '../../../server/types/shared';

interface PatternLibraryPageProps {
  onInsert: (pattern: AnyPattern, position: 'cursor' | 'end') => void;
  isCreationMode?: boolean;
  ultra: Ultra | null;
  isDeviceConnected: boolean;
}

/**
 * Converts LibraryItem to CustomPatternDefinition
 */
function itemToCustomPattern(item: LibraryItem): CustomPatternDefinition {
  const actions = JSON.parse(item.funscriptData);
  const metadata = item.patternMetadata ? JSON.parse(item.patternMetadata) : {};

  return {
    id: `custom-${item.id}`,
    name: metadata.name || 'Custom Pattern',
    intensity: metadata.intensity || 'medium',
    tags: metadata.tags || [],
    durationMs: metadata.durationMs || 5000,
    actions,
    isCustom: true,
    originalPatternId: item.originalPatternId || 'unknown',
    lastModified: new Date(item.lastModified).getTime(),
    libraryItemId: item.id,
  };
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
  // Custom patterns state
  const [customPatterns, setCustomPatterns] = useState<CustomPatternDefinition[]>([]);

  // Fetch custom patterns on mount
  useEffect(() => {
    const loadCustomPatterns = async () => {
      try {
        const libraryItems = await customPatternApi.getAll();
        const mappedPatterns = libraryItems.map(itemToCustomPattern);
        setCustomPatterns(mappedPatterns);
      } catch (err) {
        console.error('Failed to load custom patterns:', err);
      }
    };

    loadCustomPatterns();
  }, []);

  // Pattern editor hook
  const patternEditor = usePatternEditor();

  // Filter state (now includes custom patterns)
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
  } = usePatternFilters(PATTERN_DEFINITIONS, customPatterns);

  // Dialog state
  const [selectedPattern, setSelectedPattern] = useState<AnyPattern | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showInsertDialog, setShowInsertDialog] = useState(false);

  // Handle pattern card click
  const handlePatternClick = (pattern: AnyPattern) => {
    setSelectedPattern(pattern);
    setShowDetailDialog(true);
  };

  // Handle edit copy button click
  const handleEditCopy = (pattern: AnyPattern) => {
    // Convert AnyPattern to PatternDefinition for createEditableCopy
    const patternDef: PatternDefinition = 'generator' in pattern && typeof pattern.generator === 'function'
      ? pattern as PatternDefinition
      : {
          id: pattern.id,
          name: pattern.name,
          intensity: pattern.intensity,
          tags: pattern.tags,
          durationMs: pattern.durationMs,
          generator: () => (pattern as CustomPatternDefinition).actions,
        };

    const copy = createEditableCopy(patternDef);
    patternEditor.openEditor(copy);
  };

  // Handle insert button click in detail dialog
  const handleInsertClick = (pattern: AnyPattern) => {
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
  const handleQuickAdd = (pattern: AnyPattern) => {
    onInsert(pattern, 'end');
  };

  // Refresh custom patterns after save
  const handlePatternSave = async () => {
    await patternEditor.savePattern();
    // Reload custom patterns
    try {
      const libraryItems = await customPatternApi.getAll();
      const mappedPatterns = libraryItems.map(itemToCustomPattern);
      setCustomPatterns(mappedPatterns);
    } catch (err) {
      console.error('Failed to reload custom patterns:', err);
    }
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
        onEditCopy={handleEditCopy}
        ultra={ultra}
        isDeviceConnected={isDeviceConnected}
      />

      {/* Pattern Editor Dialog */}
      <PatternEditorDialog
        pattern={patternEditor.editedPattern}
        isOpen={patternEditor.isEditorOpen}
        onClose={patternEditor.closeEditor}
        onActionsChange={patternEditor.updateActions}
        onDurationChange={patternEditor.changeDuration}
        onIntensityChange={patternEditor.changeIntensity}
        onStartDemo={() => ultra && patternEditor.startDemo(ultra)}
        onStopDemo={() => ultra && patternEditor.stopDemo(ultra)}
        onSave={handlePatternSave}
        isDemoPlaying={patternEditor.isDemoPlaying}
        demoError={patternEditor.demoError}
        isSaving={patternEditor.isSaving}
        saveError={patternEditor.saveError}
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
