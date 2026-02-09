/**
 * Extract a human-readable message from an unknown caught error.
 * Returns the Error's message if available, otherwise the provided fallback.
 */
export function getErrorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}
