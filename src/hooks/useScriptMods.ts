/**
 * Saved script mods — loading, creating and deleting via the backend.
 * Applying a mod to playback lives in useScriptPlayback; this hook only owns
 * the collection.
 */

import { useState, useEffect, useCallback } from 'react';
import type { CreateScriptModRequest, ScriptMod } from '@server/types/shared';
import { scriptModApi } from '@/lib/apiClient';

interface UseScriptModsReturn {
  mods: ScriptMod[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createMod: (data: CreateScriptModRequest) => Promise<ScriptMod>;
  renameMod: (id: number, name: string) => Promise<void>;
  deleteMod: (id: number) => Promise<void>;
}

export function useScriptMods(): UseScriptModsReturn {
  const [mods, setMods] = useState<ScriptMod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setMods(await scriptModApi.getAll());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load mods');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createMod = useCallback(async (data: CreateScriptModRequest): Promise<ScriptMod> => {
    const created = await scriptModApi.create(data);
    await refresh();
    return created;
  }, [refresh]);

  const renameMod = useCallback(async (id: number, name: string) => {
    await scriptModApi.update(id, { name });
    await refresh();
  }, [refresh]);

  const deleteMod = useCallback(async (id: number) => {
    await scriptModApi.deleteMod(id);
    await refresh();
  }, [refresh]);

  return { mods, loading, error, refresh, createMod, renameMod, deleteMod };
}
