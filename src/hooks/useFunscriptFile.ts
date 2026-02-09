import { useState } from 'react';
import { parseFunscriptFile, type ZodFunscript } from '@/lib/schemas';
import { getErrorMessage } from '@/lib/getErrorMessage';

interface UseFunscriptFileReturn {
  funscriptFile: File | null;
  funscriptData: ZodFunscript | null;
  funscriptName: string | null;
  loadFunscript: (file: File) => Promise<void>;
  loadFunscriptFromData: (name: string, data: ZodFunscript) => void;
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
      const errorMessage = getErrorMessage(err, 'Failed to load funscript');
      setError(errorMessage);
      setFunscriptFile(null);
      setFunscriptData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const loadFunscriptFromData = (name: string, data: ZodFunscript) => {
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
