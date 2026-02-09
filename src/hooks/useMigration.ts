import { useState, useEffect } from 'react';
import { db } from '@/lib/db';
import { libraryApi } from '@/lib/apiClient';
import { getErrorMessage } from '@/lib/getErrorMessage';
import type { CreateLibraryItemRequest } from '@/../server/types/shared';

interface UseMigrationReturn {
  migrating: boolean;
  migrated: boolean;
  error: string | null;
}

/**
 * Hook that automatically migrates IndexedDB data to SQLite backend on first connection
 *
 * Migration process:
 * 1. Check if migration already completed
 * 2. If not, read all IndexedDB records
 * 3. Transform to backend format
 * 4. Send to migration endpoint
 * 5. Clear IndexedDB on success
 * 6. Mark migration complete
 *
 * Idempotent: safe to call multiple times, only runs once
 * Graceful: if backend unreachable, sets error but doesn't crash app
 */
export function useMigration(): UseMigrationReturn {
  const [migrating, setMigrating] = useState(false);
  const [migrated, setMigrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const runMigration = async () => {
      try {
        setMigrating(true);
        setError(null);

        // Step 1: Check if migration already completed
        const status = await libraryApi.getMigrationStatus();
        if (status.migrated) {
          setMigrated(true);
          setMigrating(false);
          return;
        }

        // Step 2: Read all records from IndexedDB
        const sessions = await db.workSessions.toArray();

        // Step 3: Transform to backend format
        const items: CreateLibraryItemRequest[] = sessions.map(session => ({
          videoName: session.videoName,
          funscriptName: session.funscriptName,
          funscriptData: session.funscriptData,
          duration: null, // Not tracked in old schema
        }));

        // Step 4: Send to migration endpoint (even if empty to mark complete)
        const result = await libraryApi.migrate({ data: items });

        // Step 5: Clear IndexedDB on success
        if (result.success && sessions.length > 0) {
          await db.workSessions.clear();
        }

        setMigrated(true);
        setMigrating(false);
      } catch (err) {
        // Graceful error handling - backend may be unreachable
        const errorMessage = getErrorMessage(err, 'Migration failed');
        setError(errorMessage);
        setMigrating(false);
        console.warn('Migration failed, app will continue with IndexedDB fallback:', errorMessage);
      }
    };

    runMigration();
  }, []); // Run once on mount

  return {
    migrating,
    migrated,
    error,
  };
}
