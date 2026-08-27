/** A row's vertical extent, in the same coordinate space as the pointer. */
export interface RowFrame {
  top: number;
  height: number;
}

/**
 * Where the dragged row lands: the number of *other* rows whose midpoint the
 * pointer has passed. That is its index once it is lifted out and put back,
 * so `moveItem(rows, from, result)` is the new order. Clamped to the list, so
 * a pointer above or below it still resolves to an end.
 */
export function resolveDropIndex(frames: RowFrame[], from: number, pointerY: number): number {
  let index = 0;

  frames.forEach((frame, i) => {
    if (i !== from && pointerY > frame.top + frame.height / 2) index += 1;
  });

  return Math.min(index, Math.max(frames.length - 1, 0));
}

/**
 * How far a resting row moves to open the gap: the rows between the origin
 * and the drop each slide one dragged-row height toward the origin, which
 * leaves exactly one empty slot at `to`.
 */
export function getRowShift(index: number, from: number, to: number, draggedHeight: number): number {
  if (from === to || index === from) return 0;
  if (to > from && index > from && index <= to) return -draggedHeight;
  if (to < from && index >= to && index < from) return draggedHeight;
  return 0;
}
