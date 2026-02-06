/**
 * Format time in seconds to human-readable string
 * @param seconds - Time in seconds (may be NaN, negative, or zero)
 * @returns Formatted time string like "2:05" or "1:02:05"
 */
export function formatTime(seconds: number): string {
  // Handle edge cases
  if (isNaN(seconds) || seconds < 0) {
    return '0:00';
  }

  if (seconds === 0) {
    return '0:00';
  }

  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  // Pad with leading zeros
  const pad = (num: number): string => num.toString().padStart(2, '0');

  if (hours > 0) {
    // h:mm:ss format when hours present
    return `${hours}:${pad(minutes)}:${pad(secs)}`;
  } else {
    // m:ss format when no hours
    return `${minutes}:${pad(secs)}`;
  }
}
