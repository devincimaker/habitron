import {
  getContrastRatio,
  getTodoTagChipColors,
  getTodoTagColor,
  TAG_CHIP_MIN_CONTRAST,
  TODO_TAG_COLOR_PALETTE,
  type TagChipTheme,
} from '../utils/todoTagColors';

const THEMES: TagChipTheme[] = ['light', 'dark'];

// Hexes the palette does not contain: the coach can set any colour through
// create_tag / update_tag, and pure white and black are the ends of the range.
const EDGE_COLORS = ['#FFEB3B', '#B2FF59', '#E0E0E0', '#FFFFFF', '#000000'];

function ratioOf(color: string, theme: TagChipTheme): number {
  const chip = getTodoTagChipColors(color, theme);
  if (!chip) throw new Error(`no chip colours for ${color}`);
  return getContrastRatio(chip.label, chip.background);
}

describe('todoTagColors', () => {
  it('assigns a stable palette color for the same tag name', () => {
    expect(getTodoTagColor('brand')).toBe(getTodoTagColor('brand'));
    expect(getTodoTagColor('Brand')).toBe(getTodoTagColor('brand'));
  });

  it('always returns a color from the supported palette', () => {
    expect(TODO_TAG_COLOR_PALETTE).toContain(getTodoTagColor('relationships'));
    expect(TODO_TAG_COLOR_PALETTE).toContain(getTodoTagColor('fun'));
  });
});

describe('getContrastRatio', () => {
  it('spans the WCAG range', () => {
    expect(getContrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 5);
    expect(getContrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
  });

  it('is symmetric, and treats an unparseable colour as no contrast', () => {
    expect(getContrastRatio('#FFD54F', '#876700')).toBeCloseTo(
      getContrastRatio('#876700', '#FFD54F'),
      10
    );
    expect(getContrastRatio('rebeccapurple', '#FFFFFF')).toBe(1);
  });
});

describe('getTodoTagChipColors', () => {
  it.each(THEMES)('clears the contrast floor for all 16 palette colours in %s', (theme) => {
    const failures = TODO_TAG_COLOR_PALETTE.filter(
      (color) => ratioOf(color, theme) < TAG_CHIP_MIN_CONTRAST
    );
    expect(failures).toEqual([]);
  });

  it.each(THEMES)('clears the floor for off-palette and extreme colours in %s', (theme) => {
    const failures = EDGE_COLORS.filter((color) => ratioOf(color, theme) < TAG_CHIP_MIN_CONTRAST);
    expect(failures).toEqual([]);
  });

  // The four colours the design canvas shows, and the ratios the issue predicted.
  it.each([
    ['#FFD54F', 'light', '#FFECB0', '#876700', 4.5],
    ['#AED581', 'light', '#DBECC6', '#4D6F25', 4.65],
    ['#9575CD', 'light', '#CFC1E9', '#623CA5', 4.6],
    ['#26A69A', 'light', '#9DD7D2', '#165F59', 4.65],
    ['#FFD54F', 'dark', '#6B5D2F', '#FFD54F', 4.6],
    ['#AED581', 'dark', '#4F5D41', '#B8DA90', 4.53],
    ['#9575CD', 'dark', '#463B5B', '#B8A2DD', 4.54],
    ['#26A69A', 'dark', '#204C49', '#2EC7B9', 4.56],
  ] as const)('derives %s in %s as %s / %s', (color, theme, background, label, ratio) => {
    expect(getTodoTagChipColors(color, theme)).toEqual({ background, label });
    expect(getContrastRatio(label, background)).toBeCloseTo(ratio, 2);
  });

  it('leaves a colour that already clears the floor untouched', () => {
    // Dark mode steps lightness *up*, and #FFD54F starts above the floor.
    expect(getTodoTagChipColors('#FFD54F', 'dark')?.label).toBe('#FFD54F');
  });

  it('measures contrast on the rounded hex, not the unrounded step', () => {
    // The rounded value is what ships. For these two the unrounded check is the
    // optimistic one: it accepts a step that renders at 4.49 and 4.48.
    expect(getContrastRatio('#EBD800', '#FFF9C4')).toBeLessThan(TAG_CHIP_MIN_CONTRAST);
    expect(ratioOf('#FFEB3B', 'light')).toBeGreaterThanOrEqual(TAG_CHIP_MIN_CONTRAST);
    expect(ratioOf('#90A4AE', 'dark')).toBeGreaterThanOrEqual(TAG_CHIP_MIN_CONTRAST);
  });

  it('has no colours to offer when the tag has none, or an unparseable one', () => {
    expect(getTodoTagChipColors(undefined, 'light')).toBeUndefined();
    expect(getTodoTagChipColors('', 'light')).toBeUndefined();
    expect(getTodoTagChipColors('#ABC', 'light')).toBeUndefined();
    expect(getTodoTagChipColors('rebeccapurple', 'dark')).toBeUndefined();
  });
});
