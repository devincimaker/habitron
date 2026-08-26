/**
 * One ramp for every axis, because every axis is higher-is-better — calm, not
 * stress. Opacity by value, so a low day reads pale and a good one reads solid
 * without a second hue implying a second meaning.
 */
const RAMP = [0.28, 0.4, 0.6, 0.82, 1];

/** The primary at the value's weight, or null when the axis was never rated. */
export function rampColor(primary: string, value: number | undefined): string | null {
  if (!value) return null;
  const opacity = RAMP[value - 1];
  return opacity === undefined ? null : `${primary}${alphaHex(opacity)}`;
}

function alphaHex(opacity: number): string {
  return Math.round(opacity * 255)
    .toString(16)
    .padStart(2, '0');
}
