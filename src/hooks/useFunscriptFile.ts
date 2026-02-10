import { useState } from 'react';
import { parseFunscriptFile } from '@/lib/schemas';
import { getErrorMessage } from '@/lib/getErrorMessage';
import type { Funscript } from '@/types/funscript';

interface UseFunscriptFileReturn {
  funscriptFile: File | null;
  funscriptData: Funscript | null;
  funscriptName: string | null;
  loadFunscript: (file: File) => Promise<void>;
  loadFunscriptFromData: (name: string, data: Funscript) => void;
  clearFunscript: () => void;
  error: string | null;
  isLoading: boolean;
}

export function useFunscriptFile(): UseFunscriptFileReturn {
  const [funscriptFile, setFunscriptFile] = useState<File | null>(null);
  const [funscriptData, setFunscriptData] = useState<Funscript | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadFunscript = async (file: File) => {
    setError(null);
    setIsLoading(true);

    try {
      const data = await parseFunscriptFile(file) as Funscript;
      setFunscriptFile(file);
      setFunscriptData(data);
    } catch (err) {
      const errorMessage = getErrorMessage(err, 'Failed to load funscript');
      setError(errorMessage);
      setFunscriptFile(null);
      setFunscriptData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const loadFunscriptFromData = (name: string, data: Funscript) => {
    setError(null);
    setIsLoading(false);
    // Create a synthetic file-like state for library-loaded funscripts
    setFunscriptFile(new File([], name, { type: 'application/json' }));
    setFunscriptData(data);
  };

  const clearFunscript = () => {
    setFunscriptFile(null);
    setFunscriptData(null);
    setError(null);
    setIsLoading(false);
  };

  const funscriptName = funscriptFile?.name ?? null;

  return {
    funscriptFile,
    funscriptData,
    funscriptName,
    loadFunscript,
    loadFunscriptFromData,
    clearFunscript,
    error,
    isLoading,
  };
}
