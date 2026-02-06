import { useState } from 'react';
import { parseFunscriptFile, type ZodFunscript } from '@/lib/schemas';

interface UseFunscriptFileReturn {
  funscriptFile: File | null;
  funscriptData: ZodFunscript | null;
  funscriptName: string | null;
  loadFunscript: (file: File) => Promise<void>;
  clearFunscript: () => void;
  error: string | null;
  isLoading: boolean;
}

export function useFunscriptFile(): UseFunscriptFileReturn {
  const [funscriptFile, setFunscriptFile] = useState<File | null>(null);
  const [funscriptData, setFunscriptData] = useState<ZodFunscript | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadFunscript = async (file: File) => {
    setError(null);
    setIsLoading(true);

    try {
      const data = await parseFunscriptFile(file);
      setFunscriptFile(file);
      setFunscriptData(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load funscript';
      setError(errorMessage);
      setFunscriptFile(null);
      setFunscriptData(null);
    } finally {
      setIsLoading(false);
    }
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
    clearFunscript,
    error,
    isLoading,
  };
}
