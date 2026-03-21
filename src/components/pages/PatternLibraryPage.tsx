import { useState, useEffect } from 'react';
import type { PatternDefinition, CustomPatternDefinition, AnyPattern } from '@/types/patterns';
import { isCustomPattern } from '@/types/patterns';
import { PATTERN_DEFINITIONS } from '@/lib/patternDefinitions';
import { usePatternFilters } from '@/hooks/usePatternFilters';
import { usePatternEditor } from '@/hooks/usePatternEditor';
import { useWaypointBuilder } from '@/hooks/useWaypointBuilder';
import { useDevice } from '@/contexts/DeviceContext';
import { PatternFilters } from '@/components/pattern-library/PatternFilters';
import { PatternGrid } from '@/components/pattern-library/PatternGrid';
import { PatternDetailDialog } from '@/components/pattern-library/PatternDetailDialog';
import { PatternEditorDialog } from '@/components/pattern-library/PatternEditorDialog';
import { WaypointBuilderDialog } from '@/components/pattern-library/WaypointBuilderDialog';
import { InsertPositionDialog } from '@/components/pattern-library/InsertPositionDialog';
import { createEditableCopy } from '@/lib/patternTransform';
import { customPatternApi } from '@/lib/apiClient';
import type { LibraryItem } from '@server/types/shared';
import { generateRandomizedScript } from '@/lib/randomizer';
import type { RandomizedScript } from '@/types/randomizer';
import { RandomizerToolbar } from '@/components/pattern-library/RandomizerToolbar';
import { RandomizerPreviewDialog } from '@/components/pattern-library/RandomizerPreviewDialog';

interface PatternLibraryPageProps {
  onInsert: (pattern: AnyPattern, position: 'cursor' | 'end') => void;
  isCreationMode?: boolean;
}

/**
 * Converts LibraryItem to CustomPatternDefinition
 */
function itemToCustomPattern(item: LibraryItem): CustomPatternDefinition {
  const parsed = JSON.parse(item.funscriptData);
  const actions = Array.isArray(parsed) ? parsed : parsed.actions || [];
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
    audioFile: metadata.audioFile || undefined,
  };
}

/**
 * Pattern Library page - presentation component for browsing and inserting patterns
 * Filter state is local to this page (per research recommendation)
 */
export function PatternLibraryPage({
  onInsert,
  isCreationMode = false,
}: PatternLibraryPageProps) {
  const { ultra, isDeviceConnected } = useDevice();
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

  // Waypoint builder hook
  const waypointBuilder = useWaypointBuilder();

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

  // Randomize mode state
  const [isRandomizeMode, setIsRandomizeMode] = useState(false);
  const [selectedPatternIds, setSelectedPatternIds] = useState<Set<string>>(new Set());
  const [randomizerDuration, setRandomizerDuration] = useState(5);
  const [randomizedScript, setRandomizedScript] = useState<RandomizedScript | null>(null);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);

  // Dialog state
  const [selectedPattern, setSelectedPattern] = useState<AnyPattern | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showInsertDialog, setShowInsertDialog] = useState(false);

  // Copy name prompt state
  const [pendingCopyPattern, setPendingCopyPattern] = useState<PatternDefinition | null>(null);
  const [copyName, setCopyName] = useState('');

  // Handle pattern card click
  const handlePatternClick = (pattern: AnyPattern) => {
    setSelectedPattern(pattern);
    setShowDetailDialog(true);
  };

  // Handle edit copy button click — show name prompt first
  const handleEditCopy = (pattern: AnyPattern) => {
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

    setCopyName(`${pattern.name} (Copy)`);
    setPendingCopyPattern(patternDef);
  };

  // Handle editing an existing custom pattern directly
  const handleEdit = (pattern: AnyPattern) => {
    if (!isCustomPattern(pattern)) return;
    patternEditor.openEditor(pattern);
  };

  // Handle deleting a custom pattern (soft delete)
  const handleDelete = async (pattern: AnyPattern) => {
    if (!isCustomPattern(pattern) || !pattern.libraryItemId) return;
    try {
      await customPatternApi.delete(pattern.libraryItemId);
      // Reload custom patterns to reflect deletion
      const libraryItems = await customPatternApi.getAll();
      setCustomPatterns(libraryItems.map(itemToCustomPattern));
    } catch (err) {
      console.error('Failed to delete custom pattern:', err);
    }
  };

  // Confirm copy name and open editor
  const handleCopyNameConfirm = () => {
    if (!pendingCopyPattern || !copyName.trim()) return;
    const copy = createEditableCopy(pendingCopyPattern);
    copy.name = copyName.trim();
    patternEditor.openEditor(copy);
    setPendingCopyPattern(null);
    setCopyName('');
  };

  const handleCopyNameCancel = () => {
    setPendingCopyPattern(null);
    setCopyName('');
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

  const toggleRandomizeMode = () => {
    setIsRandomizeMode((prev) => {
      if (prev) setSelectedPatternIds(new Set());
      return !prev;
    });
  };

  const togglePatternSelection = (patternId: string) => {
    setSelectedPatternIds((prev) => {
      const next = new Set(prev);
      if (next.has(patternId)) next.delete(patternId);
      else next.add(patternId);
      return next;
    });
  };

  const handleGenerate = () => {
    const allPatterns: AnyPattern[] = [...PATTERN_DEFINITIONS, ...customPatterns];
    const selected = allPatterns.filter((p) => selectedPatternIds.has(p.id));
    if (selected.length < 2) return;

    const script = generateRandomizedScript(selected, randomizerDuration * 60 * 1000);
    setRandomizedScript(script);
    setShowPreviewDialog(true);
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

  // Handle waypoint pattern save
  const handleWaypointSave = async () => {
    await waypointBuilder.savePattern();
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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-stone-200" style={{ fontFamily: 'var(--font-display)' }}>
          Patterns
        </h1>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleRandomizeMode}
            className={`px-4 py-2 rounded-lg font-medium shadow-sm transition-colors ${
              isRandomizeMode
                ? 'bg-amber-600 text-white hover:bg-amber-500'
                : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
            }`}
          >
            {isRandomizeMode ? 'Exit Randomize' : 'Randomize Mode'}
          </button>
          <button
            onClick={waypointBuilder.openBuilder}
            className="px-4 py-2 rounded-lg bg-amber-700 text-white hover:bg-amber-600 transition-colors font-medium shadow-sm"
          >
            + Create Pattern
          </button>
        </div>
      </div>

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
        isRandomizeMode={isRandomizeMode}
        selectedPatternIds={selectedPatternIds}
        onToggleSelect={togglePatternSelection}
      />

      {/* Detail Dialog */}
      <PatternDetailDialog
        pattern={selectedPattern}
        isOpen={showDetailDialog}
        onClose={handleCloseDetailDialog}
        onInsert={handleInsertClick}
        onEditCopy={handleEditCopy}
        onEdit={handleEdit}
        onDelete={handleDelete}
        ultra={ultra}
        isDeviceConnected={isDeviceConnected}
      />

      {/* Pattern Editor Dialog */}
      <PatternEditorDialog
        pattern={patternEditor.editedPattern}
        isOpen={patternEditor.isEditorOpen}
        onClose={patternEditor.closeEditor}
        onActionsChange={patternEditor.updateActions}
        onNameChange={patternEditor.changeName}
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
        audioFile={patternEditor.editedPattern?.audioFile}
        audioFileSize={patternEditor.audioFileSize ?? undefined}
        isUploadingAudio={patternEditor.isUploadingAudio}
        audioError={patternEditor.audioError}
        onUploadAudio={patternEditor.uploadAudio}
        onRemoveAudio={patternEditor.removeAudio}
      />

      {/* Insert Position Dialog */}
      <InsertPositionDialog
        isOpen={showInsertDialog}
        onClose={handleCloseInsertDialog}
        onInsert={handlePositionSelect}
      />

      {/* Copy Name Prompt */}
      {pendingCopyPattern && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) handleCopyNameCancel(); }}
        >
          <div className="bg-stone-900 border border-stone-700 rounded-lg w-full max-w-sm p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-stone-200 mb-4" style={{ fontFamily: 'var(--font-display)' }}>
              Name Your Copy
            </h2>
            <input
              type="text"
              value={copyName}
              onChange={(e) => setCopyName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCopyNameConfirm(); if (e.key === 'Escape') handleCopyNameCancel(); }}
              autoFocus
              className="w-full px-3 py-2 rounded-lg bg-stone-800 border border-stone-700 text-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700/40 focus:border-amber-700"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleCopyNameConfirm}
                disabled={!copyName.trim()}
                className="flex-1 px-4 py-2 rounded-lg bg-amber-700 text-white hover:bg-amber-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Copy
              </button>
              <button
                onClick={handleCopyNameCancel}
                className="px-4 py-2 rounded-lg border border-stone-600 text-stone-200 hover:bg-stone-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Randomizer Toolbar */}
      {isRandomizeMode && (
        <RandomizerToolbar
          selectedCount={selectedPatternIds.size}
          durationMinutes={randomizerDuration}
          onDurationChange={setRandomizerDuration}
          onGenerate={handleGenerate}
          onCancel={toggleRandomizeMode}
        />
      )}

      {/* Randomizer Preview Dialog */}
      {showPreviewDialog && randomizedScript && (
        <RandomizerPreviewDialog
          script={randomizedScript}
          isOpen={showPreviewDialog}
          onClose={() => {
            setShowPreviewDialog(false);
            setRandomizedScript(null);
          }}
          onRegenerate={handleGenerate}
          ultra={ultra}
          isDeviceConnected={isDeviceConnected}
        />
      )}

      {/* Waypoint Builder Dialog */}
      <WaypointBuilderDialog
        waypoints={waypointBuilder.waypoints}
        patternName={waypointBuilder.patternName}
        selectedIndex={waypointBuilder.selectedIndex}
        isOpen={waypointBuilder.isOpen}
        isSaving={waypointBuilder.isSaving}
        saveError={waypointBuilder.saveError}
        isDemoPlaying={waypointBuilder.isDemoPlaying}
        demoError={waypointBuilder.demoError}
        canAddWaypoint={waypointBuilder.canAddWaypoint}
        canRemoveWaypoint={waypointBuilder.canRemoveWaypoint}
        totalDurationMs={waypointBuilder.totalDurationMs}
        isDeviceConnected={isDeviceConnected}
        onClose={waypointBuilder.closeBuilder}
        onPatternNameChange={waypointBuilder.setPatternName}
        onAddWaypoint={waypointBuilder.addWaypoint}
        onUpdateWaypoint={waypointBuilder.updateWaypoint}
        onRemoveWaypoint={waypointBuilder.removeWaypoint}
        onSelectWaypoint={waypointBuilder.selectWaypoint}
        onGenerateActions={waypointBuilder.generateActions}
        onStartDemo={() => ultra && waypointBuilder.startDemo(ultra)}
        onStopDemo={() => ultra && waypointBuilder.stopDemo(ultra)}
        onSave={handleWaypointSave}
      />
    </div>
  );
}
