import path from 'path';

/**
 * Reduce a client-supplied multipart filename to a safe basename.
 *
 * `file.originalname` is taken verbatim from the request's multipart header, so
 * it can carry path separators, traversal segments, or leading dots. Multer's
 * disk storage joins the value it is given with the destination directory
 * without inspecting it, so an unsanitized name lets an upload land anywhere
 * the server process can write.
 *
 * @param originalName the client-supplied name.
 * @param fallback used when nothing usable survives sanitization.
 */
export function sanitizeUploadFilename(originalName: string, fallback: string): string {
  // Windows-style separators survive posix basename(), so strip them first
  const lastSeparator = Math.max(
    originalName.lastIndexOf('/'),
    originalName.lastIndexOf('\\'),
  );
  const base = path.basename(originalName.slice(lastSeparator + 1));

  // Stem and extension are sanitized separately: stripping the whole name at
  // once lets a fully non-ASCII stem ("видео.mp4") collapse to a bare "mp4",
  // which stores an extensionless file that the media listing filters out and
  // that every other such upload then overwrites.
  const ext = path.extname(base);
  const stem = base.slice(0, base.length - ext.length);
  const safeStem = stem.replace(/[^a-zA-Z0-9._-]/g, '').replace(/^\.+/, '');
  const safeExt = ext.replace(/[^a-zA-Z0-9]/g, '');

  if (safeStem === '') {
    // Keep the real container extension so the stored file still lists and
    // serves with the right content type
    const fallbackStem = path.basename(fallback, path.extname(fallback));
    return safeExt === '' ? fallback : `${fallbackStem}.${safeExt}`;
  }
  return safeExt === '' ? safeStem : `${safeStem}.${safeExt}`;
}
