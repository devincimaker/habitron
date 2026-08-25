import { Text, StyleSheet, TextStyle, TextProps } from 'react-native';
import { TYPOGRAPHY } from '../../constants/theme';
import { useColors } from '../../hooks/useColors';

interface TypographyProps extends TextProps {
  children: React.ReactNode;
  color?: string;
  style?: TextStyle;
}

export function DisplayLarge({ children, color, style, ...props }: TypographyProps) {
  const colors = useColors();
  return (
    <Text style={[styles.displayLarge, { color: color ?? colors.text }, style]} {...props}>
      {children}
    </Text>
  );
}

export function DisplayMedium({ children, color, style, ...props }: TypographyProps) {
  const colors = useColors();
  return (
    <Text style={[styles.displayMedium, { color: color ?? colors.text }, style]} {...props}>
      {children}
    </Text>
  );
}

export function HeadingLarge({ children, color, style, ...props }: TypographyProps) {
  const colors = useColors();
  return (
    <Text style={[styles.headingLarge, { color: color ?? colors.text }, style]} {...props}>
      {children}
    </Text>
  );
}

export function HeadingMedium({ children, color, style, ...props }: TypographyProps) {
  const colors = useColors();
  return (
    <Text style={[styles.headingMedium, { color: color ?? colors.text }, style]} {...props}>
      {children}
    </Text>
  );
}

export function BodyLarge({ children, color, style, ...props }: TypographyProps) {
  const colors = useColors();
  return (
    <Text style={[styles.bodyLarge, { color: color ?? colors.text }, style]} {...props}>
      {children}
    </Text>
  );
}

export function BodyMedium({ children, color, style, ...props }: TypographyProps) {
  const colors = useColors();
  return (
    <Text style={[styles.bodyMedium, { color: color ?? colors.textSecondary }, style]} {...props}>
      {children}
    </Text>
  );
}

export function BodySmall({ children, color, style, ...props }: TypographyProps) {
  const colors = useColors();
  return (
    <Text style={[styles.bodySmall, { color: color ?? colors.textSecondary }, style]} {...props}>
      {children}
    </Text>
  );
}

export function Label({ children, color, style, ...props }: TypographyProps) {
  const colors = useColors();
  return (
    <Text style={[styles.label, { color: color ?? colors.text }, style]} {...props}>
      {children}
    </Text>
  );
}

/** The muted label at the top of a task section card. */
export function SectionLabel({ children, color, style, ...props }: TypographyProps) {
  const colors = useColors();
  return (
    <Text style={[styles.sectionLabel, { color: color ?? colors.textLight }, style]} {...props}>
      {children}
    </Text>
  );
}

export function Caption({ children, color, style, ...props }: TypographyProps) {
  const colors = useColors();
  return (
    <Text style={[styles.caption, { color: color ?? colors.textLight }, style]} {...props}>
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
  sectionLabel: TYPOGRAPHY.sectionLabel,
  caption: TYPOGRAPHY.caption,
});
