export function normalizeHabitName(name: string): string {
  const trimmedName = name.trim();

  if (!trimmedName) {
    return '';
  }

  return trimmedName.charAt(0).toLocaleUpperCase() + trimmedName.slice(1);
}
