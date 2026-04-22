import { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useProfileStore } from '../../stores/useProfileStore';
import { Button, Input, DisplayLarge, BodyMedium } from '../../components/ui';
import { SPACING, TYPOGRAPHY, type Colors } from '../../constants/theme';
import { useThemedStyles } from '../../hooks/useColors';

export default function NameOnboardingScreen() {
  const [styles] = useThemedStyles(createStyles);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { updateName, isLoading } = useProfileStore();
  const router = useRouter();

  const handleContinue = async () => {
    const trimmedName = name.trim();

    if (trimmedName.length < 2) {
      setError(trimmedName ? 'Name must be at least 2 characters' : 'Please enter your name');
      return;
    }

    setError(null);
    const { error } = await updateName(trimmedName);

    if (error) {
      setError('Failed to save name. Please try again.');
    } else {
      router.replace('/(tabs)/tasks');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.emoji}>👋</Text>
          <DisplayLarge style={styles.title}>Welcome!</DisplayLarge>
          <BodyMedium style={styles.subtitle}>
            What should Thrive Coach call you?
          </BodyMedium>
        </View>

        <View style={styles.form}>
          <Input
            label="Your name"
            placeholder="Enter your first name"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoCorrect={false}
            autoFocus
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.buttonContainer}>
            <Button
              title="Continue"
              onPress={handleContinue}
              loading={isLoading}
              disabled={isLoading || !name.trim()}
              size="lg"
              fullWidth
            />
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },
  header: {
    marginBottom: SPACING.xxl,
    alignItems: 'center',
  },
  emoji: {
    fontSize: 64,
    marginBottom: SPACING.md,
  },
  title: {
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    color: colors.textSecondary,
  },
  form: {
    marginBottom: SPACING.xl,
  },
  error: {
    ...TYPOGRAPHY.bodySmall,
    color: colors.error,
    marginBottom: SPACING.md,
  },
  buttonContainer: {
    marginTop: SPACING.sm,
  },
});
