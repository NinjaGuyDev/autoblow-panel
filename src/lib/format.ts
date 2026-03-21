/**
 * Shared formatting utilities for time, duration, and relative dates
 */

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

/**
 * Format relative time from ISO date string to human-readable description
 * @param dateString - ISO date string
 * @returns Relative time string like "5 minutes ago", "Yesterday", or formatted date
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  // Format as date for older items
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Format duration in seconds to mm:ss
 * @param seconds - Duration in seconds, or null
 * @returns Formatted duration string like "3:05" or "--:--" for null
 */
export function formatDuration(seconds: number | null): string {
  if (seconds === null) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format time from milliseconds to m:ss
 * @param ms - Time in milliseconds
 * @returns Formatted time string like "2:05"
 */
export function formatTimeMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
