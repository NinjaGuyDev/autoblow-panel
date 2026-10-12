/**
 * Video container extensions the local video loader accepts.
 * Single source of truth for the dropzone filter and the load-time check.
 */
export const ACCEPTED_VIDEO_EXTENSIONS = ['.mp4', '.webm', '.ogg', '.mkv'] as const;

/**
 * Check a file against the accepted video extensions.
 * Matches on extension rather than MIME type because browsers report
 * MKV inconsistently (`video/x-matroska`, `video/matroska`, or empty).
 */
export function isAcceptedVideoFile(file: Pick<File, 'name'>): boolean {
  const name = file.name.toLowerCase();
  return ACCEPTED_VIDEO_EXTENSIONS.some(extension => name.endsWith(extension));
}
