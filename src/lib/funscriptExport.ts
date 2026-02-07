import type { FunscriptAction } from '@/types/funscript';

/**
 * Exports a funscript to a downloadable .funscript JSON file
 * @param actions - Array of funscript actions to export
 * @param filename - Optional filename (defaults to 'script.funscript')
 */
export function exportFunscript(
  actions: FunscriptAction[],
  filename: string = 'script.funscript'
): void {
  // Create a sorted copy of actions (never mutate input)
  const sortedActions = [...actions].sort((a, b) => a.at - b.at);

  // Map to clean format with only pos and at fields
  const cleanActions = sortedActions.map(({ pos, at }) => ({ pos, at }));

  // Build funscript object
  const funscript = {
    version: '1.0',
    inverted: false,
    range: 100,
    actions: cleanActions,
  };

  // Serialize with pretty formatting
  const jsonString = JSON.stringify(funscript, null, 2);

  // Create Blob with correct MIME type
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  // Use temporary anchor element for secure download (per CLAUDE.md)
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener noreferrer';

  // Trigger download
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  // Clean up Blob URL after a short delay
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
