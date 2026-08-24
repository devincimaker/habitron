import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, StyleProp, TextInputProps, TextStyle, ViewStyle } from 'react-native';
import { SPACING, BORDER_RADIUS, TYPOGRAPHY, INPUT_HEIGHTS, type Colors } from '../../constants/theme';
import { useThemedStyles } from '../../hooks/useColors';

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
  const [styles, colors] = useThemedStyles(createStyles);
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
        placeholderTextColor={colors.textLight}
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

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      marginBottom: SPACING.md,
    },
    label: {
      ...TYPOGRAPHY.label,
      color: colors.text,
      marginBottom: SPACING.xs,
    },
    input: {
      backgroundColor: colors.surface,
      borderRadius: BORDER_RADIUS.md,
      paddingHorizontal: SPACING.md,
      ...TYPOGRAPHY.bodyLarge,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
    },
    inputFocused: {
      borderColor: colors.primary,
    },
    inputError: {
      borderColor: colors.error,
    },
    multiline: {
      minHeight: 100,
      textAlignVertical: 'top',
    },
    error: {
      ...TYPOGRAPHY.bodySmall,
      color: colors.error,
      marginTop: SPACING.xs,
    },
  });
