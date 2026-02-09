import { useDropzone } from 'react-dropzone';
import type { ReactNode } from 'react';

interface FileDropzoneProps {
  onFileAccepted: (file: File) => void;
  accept: Record<string, string[]>;
  label: string;
  description?: string;
  icon?: ReactNode;
  disabled?: boolean;
  error?: string | null;
}

export function FileDropzone({
  onFileAccepted,
  accept,
  label,
  description,
  icon,
  disabled = false,
  error,
}: FileDropzoneProps) {
  const {
    getRootProps,
    getInputProps,
    isDragActive,
    fileRejections,
  } = useDropzone({
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        onFileAccepted(acceptedFiles[0]);
      }
    },
    accept,
    maxFiles: 1,
    disabled,
  });

  // Determine border and background styles based on state
  const getBorderClass = () => {
    if (error) return 'border-orange-500';
    if (isDragActive) return 'border-amber-700';
    return 'border-stone-800';
  };

  const getBgClass = () => {
    if (disabled) return 'bg-stone-800/20';
    if (isDragActive) return 'bg-stone-800/50';
    return 'bg-stone-800/10';
  };

  const getTextClass = () => {
    if (disabled) return 'text-stone-500/50';
    return 'text-stone-500';
  };

  return (
    <div className="w-full">
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8
          cursor-pointer transition-all
          ${getBorderClass()}
          ${getBgClass()}
          ${disabled ? 'cursor-not-allowed' : 'hover:bg-stone-800/30'}
        `}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-2 text-center">
          {icon && <div className="text-4xl mb-2">{icon}</div>}
          <p className="text-lg font-semibold">{label}</p>
          {isDragActive ? (
            <p className="text-sm text-amber-500">Drop file here...</p>
          ) : (
            <>
              <p className={`text-sm ${getTextClass()}`}>
                Drag & drop or click to browse
              </p>
              {description && (
                <p className={`text-xs ${getTextClass()}`}>{description}</p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Show error messages */}
      {error && (
        <p className="text-sm text-orange-400 mt-2">{error}</p>
      )}

      {/* Show file rejection errors */}
      {fileRejections.length > 0 && (
        <div className="mt-2">
          {fileRejections.map(({ file, errors }) => (
            <div key={file.name}>
              {errors.map(e => (
                <p key={e.code} className="text-sm text-orange-400">
                  {file.name}: {e.message}
                </p>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
