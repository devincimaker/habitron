import { COLORS_DARK, COLORS_LIGHT } from '../constants/theme';

export const TODO_TAG_COLOR_PALETTE = [
  '#E57373',
  '#F06292',
  '#BA68C8',
  '#9575CD',
  '#7986CB',
  '#64B5F6',
  '#4FC3F7',
  '#4DB6AC',
  '#81C784',
  '#AED581',
  '#FFD54F',
  '#FFB74D',
  '#FF8A65',
  '#A1887F',
  '#90A4AE',
  '#26A69A',
] as const;

/** WCAG's floor for 12px text, which is the size a chip label is drawn at. */
export const TAG_CHIP_MIN_CONTRAST = 4.5;

/** How much of the tag's own colour survives in the chip fill, over the page background. */
const CHIP_FILL_ALPHA = { light: 0.45, dark: 0.35 } as const;

type Rgb = readonly [number, number, number];
export type TagChipTheme = 'light' | 'dark';

function hashTagName(value: string) {
  let hash = 5381;

  for (const character of value.toLowerCase()) {
    hash = (hash * 33) ^ character.charCodeAt(0);
  }

  return Math.abs(hash);
}

export function getTodoTagColor(name: string) {
  return TODO_TAG_COLOR_PALETTE[
    hashTagName(name.trim()) % TODO_TAG_COLOR_PALETTE.length
  ];
}

function parseHex(color: string): Rgb | undefined {
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return undefined;
  return [
    parseInt(color.slice(1, 3), 16),
    parseInt(color.slice(3, 5), 16),
    parseInt(color.slice(5, 7), 16),
  ];
}

function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b]
    .map((channel) => Math.round(channel).toString(16).padStart(2, '0').toUpperCase())
    .join('')}`;
}

function toHsl([r, g, b]: Rgb): Rgb {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  const delta = max - min;

  if (delta === 0) return [0, 0, lightness * 100];

  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let hue: number;
  if (max === red) hue = (green - blue) / delta + (green < blue ? 6 : 0);
  else if (max === green) hue = (blue - red) / delta + 2;
  else hue = (red - green) / delta + 4;

  return [hue * 60, saturation * 100, lightness * 100];
}

function fromHsl([h, s, l]: Rgb): Rgb {
  const hue = ((h % 360) + 360) % 360;
  const saturation = s / 100;
  const lightness = l / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const second = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const match = lightness - chroma / 2;

  let rgb: Rgb;
  if (hue < 60) rgb = [chroma, second, 0];
  else if (hue < 120) rgb = [second, chroma, 0];
  else if (hue < 180) rgb = [0, chroma, second];
  else if (hue < 240) rgb = [0, second, chroma];
  else if (hue < 300) rgb = [second, 0, chroma];
  else rgb = [chroma, 0, second];

  return [(rgb[0] + match) * 255, (rgb[1] + match) * 255, (rgb[2] + match) * 255];
}

function relativeLuminance([r, g, b]: Rgb): number {
  const channel = (value: number) => {
    const scaled = value / 255;
    return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio between two hex colours, 1:1 to 21:1. */
export function getContrastRatio(a: string, b: string): number {
  const first = parseHex(a);
  const second = parseHex(b);
  if (!first || !second) return 1;

  const lumA = relativeLuminance(first);
  const lumB = relativeLuminance(second);
  const [lighter, darker] = lumA > lumB ? [lumA, lumB] : [lumB, lumA];
  return (lighter + 0.05) / (darker + 0.05);
}

function blend(fg: Rgb, bg: Rgb, alpha: number): Rgb {
  return [
    fg[0] * alpha + bg[0] * (1 - alpha),
    fg[1] * alpha + bg[1] * (1 - alpha),
    fg[2] * alpha + bg[2] * (1 - alpha),
  ];
}

export interface TodoTagChipColors {
  background: string;
  label: string;
}

/**
 * A chip whose fill carries the tag's identity and whose label is a shade of the
 * same hue, dark enough (light theme) or light enough (dark theme) to clear
 * TAG_CHIP_MIN_CONTRAST against that fill.
 *
 * The palette is Material's 300 shades, so the tag colour drawn as *text* fails
 * the floor on all 16 in light mode — #FFD54F is 1.35:1. Moving the identity
 * into the fill is what makes every tag colour legible.
 *
 * Each candidate is rounded to hex before its contrast is measured, because the
 * rounded value is what ships. Three colours change verdict between the two
 * orders, and for #FFEB3B (light) and #90A4AE (dark) the unrounded check is the
 * optimistic one — it would accept a chip that renders below the floor.
 */
export function getTodoTagChipColors(
  color: string | undefined,
  theme: TagChipTheme
): TodoTagChipColors | undefined {
  if (!color) return undefined;
  const rgb = parseHex(color);
  if (!rgb) return undefined;

  const page = parseHex(theme === 'dark' ? COLORS_DARK.background : COLORS_LIGHT.background);
  if (!page) return undefined;

  const background = toHex(blend(rgb, page, CHIP_FILL_ALPHA[theme]));
  const [hue, saturation, lightness] = toHsl(rgb);
  const step = theme === 'dark' ? 1 : -1;

  // Walking from the tag's own lightness means a colour that already clears the
  // floor keeps its exact hex — #FFD54F stays #FFD54F in dark mode.
  let label = toHex(rgb);
  for (let l = lightness; l >= 0 && l <= 100; l += step) {
    label = toHex(fromHsl([hue, saturation, l]));
    if (getContrastRatio(label, background) >= TAG_CHIP_MIN_CONTRAST) break;
  }

  return { background, label };
}
