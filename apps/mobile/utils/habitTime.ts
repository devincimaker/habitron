export interface ClockTime {
  hour12: number; // 1-12
  minute: number; // 0-59
  period: 'AM' | 'PM';
}

/** Parse "HH:MM" (24h) into 12-hour picker parts. */
export function parseClockTime(time: string): ClockTime {
  const [hourPart, minutePart] = time.split(':');
  const hour24 = Number(hourPart);
  const minute = Number(minutePart);
  return {
    hour12: hour24 % 12 === 0 ? 12 : hour24 % 12,
    minute,
    period: hour24 >= 12 ? 'PM' : 'AM',
  };
}

/** Format 12-hour picker parts as "HH:MM" (24h). */
export function toClockTimeString(parts: ClockTime): string {
  const hour24 =
    parts.period === 'AM' ? parts.hour12 % 12 : (parts.hour12 % 12) + 12;
  return `${String(hour24).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
}

/** "15:00" → "3:00 PM" */
export function formatReminderTime(time: string): string {
  const { hour12, minute, period } = parseClockTime(time);
  return `${hour12}:${String(minute).padStart(2, '0')} ${period}`;
}

/** Split "HH:MM" into numeric hour/minute for notification triggers. */
export function getHourMinute(time: string): { hour: number; minute: number } {
  const [hour, minute] = time.split(':').map(Number);
  return { hour, minute };
}

/** Add minutes to "HH:MM", wrapping past midnight. */
export function addMinutesToTime(time: string, minutes: number): string {
  const { hour, minute } = getHourMinute(time);
  const total = (hour * 60 + minute + minutes) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
