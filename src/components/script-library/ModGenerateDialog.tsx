/**
 * Create a script mod from natural language.
 *
 * Claude is only involved here, at authoring time — once saved, applying a mod
 * is pure local computation. Requires `ant auth login` on the machine running
 * the backend; the endpoint reports a clear 503 when that is missing.
 */

import { useState, useCallback } from 'react';
import { X, Sparkles, RefreshCw, Save, ChevronDown, ChevronRight } from 'lucide-react';
import type { GenerateScriptModResponse, ScriptMod } from '@server/types/shared';
import { scriptModApi } from '@/lib/apiClient';
import { describeMod } from '@/lib/modSummary';

interface ModGenerateDialogProps {
  /** Length of the currently playing script, used as context for the model. */
  scriptDurationMs: number | null;
  onClose: () => void;
  onSave: (name: string, description: string | null, generated: GenerateScriptModResponse) => Promise<ScriptMod>;
}

const EXAMPLES = [
  'Randomly increase the speed by 2x for 4 to 10 seconds, followed by a change to 75% of the original speed for 8 seconds before returning to the original speed.',
  'Without going more than 2x the speed or less than 75% of the original speed, randomly vary the speed every 5 to 20 seconds, with 2-second pauses at random intervals — no more than one pause every 5 seconds.',
];

export function ModGenerateDialog({ scriptDurationMs, onClose, onSave }: ModGenerateDialogProps) {
  const [instruction, setInstruction] = useState('');
  const [name, setName] = useState('');
  const [generated, setGenerated] = useState<GenerateScriptModResponse | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showJson, setShowJson] = useState(false);

  const handleGenerate = useCallback(async () => {
    if (instruction.trim() === '') return;

    setIsGenerating(true);
    setError(null);
    try {
      setGenerated(await scriptModApi.generate({
        instruction: instruction.trim(),
        scriptDurationMs: scriptDurationMs && scriptDurationMs > 0 ? scriptDurationMs : null,
      }));
    } catch (err) {
      setGenerated(null);
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setIsGenerating(false);
    }
  }, [instruction, scriptDurationMs]);

  const handleSave = useCallback(async () => {
    if (!generated || name.trim() === '') return;

    setIsSaving(true);
    setError(null);
    try {
      await onSave(name.trim(), generated.modelNotes, generated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save mod');
    } finally {
      setIsSaving(false);
    }
  }, [generated, name, onSave, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-stone-900 border border-stone-800 rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-800">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-400" />
            <h2 className="text-lg font-semibold text-stone-200" style={{ fontFamily: 'var(--font-display)' }}>
              Create Mod from Text
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-500 hover:text-stone-200 hover:bg-stone-800 rounded-lg transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Instruction */}
          <div>
            <label htmlFor="mod-instruction" className="block text-sm text-stone-400 mb-1.5">
              Describe the speed program
            </label>
            <textarea
              id="mod-instruction"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              rows={4}
              placeholder="e.g. speed up to 2x for a few seconds every 30 seconds, then drop to three quarters speed"
              className="w-full px-3 py-2 bg-stone-950/50 border border-stone-800 rounded-lg text-stone-200 placeholder:text-stone-600 focus:outline-none focus:ring-2 focus:ring-violet-700/40 resize-y"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {EXAMPLES.map((example, index) => (
                <button
                  key={example}
                  onClick={() => setInstruction(example)}
                  className="px-2 py-1 text-xs bg-stone-800/60 text-stone-400 rounded hover:bg-stone-800 hover:text-stone-200 transition-colors"
                >
                  Example {index + 1}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={isGenerating || instruction.trim() === ''}
            className="flex items-center gap-2 px-4 py-2 bg-violet-700 text-white rounded-lg hover:bg-violet-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {isGenerating ? 'Generating...' : generated ? 'Regenerate' : 'Generate'}
          </button>

          {error && (
            <div className="bg-orange-700/10 border border-orange-700 text-orange-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Preview */}
          {generated && (
            <div className="space-y-3 border-t border-stone-800 pt-4">
              <div>
                <h3 className="text-sm font-medium text-stone-300 mb-1">Preview</h3>
                <p className="text-sm text-stone-400">{describeMod(generated.definition)}</p>
                {generated.modelNotes && (
                  <p className="mt-2 text-xs text-stone-500 italic">{generated.modelNotes}</p>
                )}
              </div>

              <div>
                <button
                  onClick={() => setShowJson(v => !v)}
                  className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-300 transition-colors"
                >
                  {showJson ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  Raw definition
                </button>
                {showJson && (
                  <pre
                    className="mt-2 p-3 bg-stone-950 border border-stone-800 rounded-lg text-xs text-stone-400 overflow-x-auto"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    {JSON.stringify(generated.definition, null, 2)}
                  </pre>
                )}
              </div>

              <div>
                <label htmlFor="mod-name" className="block text-sm text-stone-400 mb-1.5">
                  Name
                </label>
                <input
                  id="mod-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Chaos Mode"
                  className="w-full px-3 py-2 bg-stone-950/50 border border-stone-800 rounded-lg text-stone-200 placeholder:text-stone-600 focus:outline-none focus:ring-2 focus:ring-violet-700/40"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-stone-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-stone-400 hover:text-stone-200 hover:bg-stone-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!generated || name.trim() === '' || isSaving}
            className="flex items-center gap-2 px-4 py-2 bg-amber-700 text-white rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save Mod'}
          </button>
        </div>
      </div>
    </div>
  );
}
