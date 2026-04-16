import {
  getTodoTagColor,
  getTodoTagTintColor,
  TODO_TAG_COLOR_PALETTE,
} from '../utils/todoTagColors';

describe('todoTagColors', () => {
  it('assigns a stable palette color for the same tag name', () => {
    expect(getTodoTagColor('brand')).toBe(getTodoTagColor('brand'));
    expect(getTodoTagColor('Brand')).toBe(getTodoTagColor('brand'));
  });

  it('always returns a color from the supported palette', () => {
    expect(TODO_TAG_COLOR_PALETTE).toContain(getTodoTagColor('relationships'));
    expect(TODO_TAG_COLOR_PALETTE).toContain(getTodoTagColor('fun'));
  });

  it('builds an alpha tint from a hex tag color', () => {
    expect(getTodoTagTintColor('#64B5F6', '20')).toBe('#64B5F620');
    expect(getTodoTagTintColor(undefined, '20')).toBeUndefined();
  });
});
