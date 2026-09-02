import { COLORS_DARK } from '../../constants/theme';

/** Voice mode is dark in both themes: a face-to-face screen, not a form. */
export const VOICE = {
  ...COLORS_DARK,
  /** The coach's glow. */
  amber: COLORS_DARK.primary,
  amberSoft: 'rgba(245, 166, 35, 0.28)',
  amberFaint: 'rgba(245, 166, 35, 0.10)',
  /** Text that has not been spoken yet, or was cut off. */
  dim: 'rgba(245, 245, 245, 0.38)',
} as const;

export const ORB_SIZE = 260;
export const CONTROL_SIZE = 64;
