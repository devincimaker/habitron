/** Two decimal places is what every rate and average in this package reports. */
export function round(value: number, places = 2): number {
  const f = 10 ** places;
  return Math.round(value * f) / f;
}

/** `null` for an empty set — never 0, which would read as a real measurement. */
export function averageOf(values: number[]): number | null {
  return values.length ? round(values.reduce((sum, v) => sum + v, 0) / values.length) : null;
}
