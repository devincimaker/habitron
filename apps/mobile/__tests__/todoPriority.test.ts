import { TODO_PRIORITY_OPTIONS, getTodoPriorityOption } from '../utils/todoPriority';

describe('todoPriority', () => {
  it('lists the four priorities in the order the editor shows them', () => {
    expect(TODO_PRIORITY_OPTIONS.map((option) => [option.value, option.label])).toEqual([
      [1, 'Urgent'],
      [2, 'High'],
      [3, 'Normal'],
      [4, 'Low'],
    ]);
  });

  it('gives every priority its own colour', () => {
    const colors = TODO_PRIORITY_OPTIONS.map((option) => option.color);
    expect(new Set(colors).size).toBe(colors.length);
    for (const color of colors) {
      expect(color).toMatch(/^#[0-9A-F]{6}$/u);
    }
  });

  it('resolves a priority value to its label and colour', () => {
    expect(getTodoPriorityOption(1)).toEqual({ value: 1, label: 'Urgent', color: '#F44336' });
    expect(getTodoPriorityOption(4)?.label).toBe('Low');
  });

  it('resolves an unset priority to nothing', () => {
    expect(getTodoPriorityOption(undefined)).toBeUndefined();
  });
});
