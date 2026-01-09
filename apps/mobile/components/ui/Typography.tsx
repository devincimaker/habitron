import { Text, StyleSheet, TextStyle, TextProps } from 'react-native';
import { COLORS, TYPOGRAPHY } from '../../constants/theme';

interface TypographyProps extends TextProps {
  children: React.ReactNode;
  color?: string;
  style?: TextStyle;
}

export function DisplayLarge({ children, color = COLORS.text, style, ...props }: TypographyProps) {
  return (
    <Text style={[styles.displayLarge, { color }, style]} {...props}>
      {children}
    </Text>
  );
}

export function DisplayMedium({ children, color = COLORS.text, style, ...props }: TypographyProps) {
  return (
    <Text style={[styles.displayMedium, { color }, style]} {...props}>
      {children}
    </Text>
  );
}

export function HeadingLarge({ children, color = COLORS.text, style, ...props }: TypographyProps) {
  return (
    <Text style={[styles.headingLarge, { color }, style]} {...props}>
      {children}
    </Text>
  );
}

export function HeadingMedium({ children, color = COLORS.text, style, ...props }: TypographyProps) {
  return (
    <Text style={[styles.headingMedium, { color }, style]} {...props}>
      {children}
    </Text>
  );
}

export function BodyLarge({ children, color = COLORS.text, style, ...props }: TypographyProps) {
  return (
    <Text style={[styles.bodyLarge, { color }, style]} {...props}>
      {children}
    </Text>
  );
}

export function BodyMedium({ children, color = COLORS.textSecondary, style, ...props }: TypographyProps) {
  return (
    <Text style={[styles.bodyMedium, { color }, style]} {...props}>
      {children}
    </Text>
  );
}

export function BodySmall({ children, color = COLORS.textSecondary, style, ...props }: TypographyProps) {
  return (
    <Text style={[styles.bodySmall, { color }, style]} {...props}>
      {children}
    </Text>
  );
}

export function Label({ children, color = COLORS.text, style, ...props }: TypographyProps) {
  return (
    <Text style={[styles.label, { color }, style]} {...props}>
      {children}
    </Text>
  );
}

export function Caption({ children, color = COLORS.textLight, style, ...props }: TypographyProps) {
  return (
    <Text style={[styles.caption, { color }, style]} {...props}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  displayLarge: TYPOGRAPHY.displayLarge,
  displayMedium: TYPOGRAPHY.displayMedium,
  headingLarge: TYPOGRAPHY.headingLarge,
  headingMedium: TYPOGRAPHY.headingMedium,
  bodyLarge: TYPOGRAPHY.bodyLarge,
  bodyMedium: TYPOGRAPHY.bodyMedium,
  bodySmall: TYPOGRAPHY.bodySmall,
  label: TYPOGRAPHY.label,
  caption: TYPOGRAPHY.caption,
});
