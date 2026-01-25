/**
 * Get today's date in YYYY-MM-DD format
 */
export function getTodayDate(): string {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

/**
 * Format a date to a human-readable string
 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Convert database date string to Unix timestamp (milliseconds)
 * Returns null if the input is null or undefined
 */
export function dbDateToTimestamp(dateString: string | null | undefined): number | null {
  return dateString ? new Date(dateString).getTime() : null;
}
