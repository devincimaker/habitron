/** The part of a keyboard frame this app cares about: where its top edge sits. */
export interface KeyboardFrame {
  screenY: number;
}

/**
 * How much of the screen a keyboard frame covers.
 *
 * iOS reports the end frame in screen coordinates, so the covered height is
 * whatever lies below its top edge. A frame parked at or past the bottom
 * covers nothing — that is what a dismissal, and a frame animating off during
 * a rotation, both look like.
 */
export function keyboardHeightFromFrame(
  frame: KeyboardFrame,
  screenHeight: number
): number {
  return Math.max(0, screenHeight - frame.screenY);
}
