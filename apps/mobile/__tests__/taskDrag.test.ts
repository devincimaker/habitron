import { getRowShift, resolveDropIndex, type RowFrame } from '../utils/taskDrag';

/** Three 50pt rows stacked from the top of the list. */
const frames: RowFrame[] = [
  { top: 0, height: 50 },
  { top: 50, height: 50 },
  { top: 100, height: 50 },
];

describe('resolveDropIndex', () => {
  it('stays at the origin until the pointer passes a neighbour\'s midpoint', () => {
    expect(resolveDropIndex(frames, 0, 10)).toBe(0);
    expect(resolveDropIndex(frames, 0, 74)).toBe(0);
    expect(resolveDropIndex(frames, 0, 76)).toBe(1);
    expect(resolveDropIndex(frames, 0, 130)).toBe(2);
  });

  it('counts only the other rows when dragging upwards', () => {
    expect(resolveDropIndex(frames, 2, 20)).toBe(0);
    expect(resolveDropIndex(frames, 2, 60)).toBe(1);
    expect(resolveDropIndex(frames, 2, 110)).toBe(2);
  });

  it('clamps a pointer above or below the list to its ends', () => {
    expect(resolveDropIndex(frames, 1, -500)).toBe(0);
    expect(resolveDropIndex(frames, 1, 5000)).toBe(2);
  });

  it('resolves to zero for an empty list', () => {
    expect(resolveDropIndex([], 0, 100)).toBe(0);
  });

  it('honours frames that start below the top of the window', () => {
    const offset = frames.map((frame) => ({ ...frame, top: frame.top + 300 }));
    expect(resolveDropIndex(offset, 0, 76)).toBe(0);
    expect(resolveDropIndex(offset, 0, 376)).toBe(1);
  });
});

describe('getRowShift', () => {
  it('slides the rows between the origin and the drop up when dragging down', () => {
    expect([0, 1, 2, 3].map((index) => getRowShift(index, 0, 2, 50))).toEqual([0, -50, -50, 0]);
  });

  it('slides the rows between the drop and the origin down when dragging up', () => {
    expect([0, 1, 2, 3].map((index) => getRowShift(index, 2, 0, 50))).toEqual([50, 50, 0, 0]);
  });

  it('moves nothing when the drop is the origin', () => {
    expect([0, 1, 2].map((index) => getRowShift(index, 1, 1, 50))).toEqual([0, 0, 0]);
  });
});
