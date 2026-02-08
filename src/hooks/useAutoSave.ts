import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import type { ZodFunscript } from '@/lib/schemas';
import type { WorkSession } from '@/types/funscript';

interface UseAutoSaveReturn {
  saveSession: (videoName: string | null, funscriptName: string | null, funscriptData: ZodFunscript | null) => Promise<void>;
  lastSession: WorkSession | null;
  clearSession: () => Promise<void>;
}

export function useAutoSave(): UseAutoSaveReturn {
  // Use Dexie's reactive hook to watch the latest session
  const lastSession = useLiveQuery(
    async () => {
      const session = await db.workSessions.get(1);
      return session ?? null;
    },
    []
  ) ?? null;

  const saveSession = async (
    videoName: string | null,
    funscriptName: string | null,
    funscriptData: ZodFunscript | null
  ) => {
    // Use fixed id=1 to always update the same record (single session storage)
    await db.workSessions.put({
      id: 1,
      videoName,
      funscriptName,
      funscriptData: funscriptData ? JSON.stringify(funscriptData) : '',
      lastModified: new Date(),
    });
  };

  const clearSession = async () => {
    await db.workSessions.delete(1);
  };

  return {
    saveSession,
    lastSession,
    clearSession,
  };
}
