import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, StyleProp, TextInputProps, TextStyle, ViewStyle } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, INPUT_HEIGHTS } from '../../constants/theme';

type InputSize = 'sm' | 'md' | 'lg';

interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  size?: InputSize;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
}

export function Input({
  label,
  error,
  size = 'md',
  multiline,
  containerStyle,
  inputStyle,
  ...textInputProps
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false);

  const heightStyle = multiline ? {} : { height: INPUT_HEIGHTS[size] };
  const paddingStyle = multiline
    ? { paddingVertical: SPACING.md }
    : { paddingVertical: SPACING.sm };

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={[
          styles.input,
          heightStyle,
          paddingStyle,
          isFocused && styles.inputFocused,
          error && styles.inputError,
          multiline && styles.multiline,
          inputStyle,
        ]}
        placeholderTextColor={COLORS.textLight}
        onFocus={(e) => {
          setIsFocused(true);
          textInputProps.onFocus?.(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          textInputProps.onBlur?.(e);
        }}
        multiline={multiline}
        {...textInputProps}
      />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.md,
  },
  label: {
    ...TYPOGRAPHY.label,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    ...TYPOGRAPHY.bodyLarge,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  inputFocused: {
    borderColor: COLORS.primary,
  },
  inputError: {
    borderColor: COLORS.error,
  },
  multiline: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  error: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.error,
    marginTop: SPACING.xs,
  },
});
