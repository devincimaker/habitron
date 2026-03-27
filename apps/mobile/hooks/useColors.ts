import { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { COLORS_LIGHT, COLORS_DARK, type Colors } from '../constants/theme';

const ColorsContext = createContext<Colors | null>(null);

export const ColorsProvider = ColorsContext.Provider;

export function useColorsValue(): Colors {
  const scheme = useColorScheme();
  return scheme === 'dark' ? COLORS_DARK : COLORS_LIGHT;
}

export function useColors(): Colors {
  const ctx = useContext(ColorsContext);
  if (!ctx) throw new Error('useColors must be used within a ColorsProvider');
  return ctx;
}

export function useThemedStyles<T>(factory: (colors: Colors) => T): [T, Colors] {
  const colors = useColors();
  const styles = useMemo(() => factory(colors), [colors, factory]);
  return [styles, colors];
}
