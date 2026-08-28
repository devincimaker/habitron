import { Feather } from '@expo/vector-icons';
import type { TrendAxis } from '../utils/dayTrend';

/**
 * The glyph for each axis, in the app's own icon language.
 *
 * Feather's own geometry is what the axes wanted: `smile` is a circle with an
 * arc mouth and two eye ticks, `battery` a rounded cell with a terminal,
 * `trending-up` a rising polyline with an arrowhead, `wind` stacked waves. They
 * are stroked at one weight, take `color`, and so flip with the theme — which
 * is the whole reason these are not emoji.
 */
const AXIS_GLYPHS: Record<TrendAxis, keyof typeof Feather.glyphMap> = {
  happy: 'smile',
  energy: 'battery',
  momentum: 'trending-up',
  calm: 'wind',
};

interface AxisIconProps {
  axis: TrendAxis;
  size: number;
  color: string;
}

export function AxisIcon({ axis, size, color }: AxisIconProps) {
  return <Feather name={AXIS_GLYPHS[axis]} size={size} color={color} />;
}
