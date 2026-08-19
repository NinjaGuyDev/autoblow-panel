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

  // Anything outside the allowlist goes, then leading dots, which would
  // otherwise leave traversal segments ("..") or dotfiles (".bashrc")
  const safe = base.replace(/[^a-zA-Z0-9._-]/g, '').replace(/^\.+/, '');

  return safe === '' ? fallback : safe;
}
