import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useAuthStore } from '../../stores/useAuthStore';
import { Button, Input, DisplayLarge, BodyMedium } from '../../components/ui';
import { SPACING, TYPOGRAPHY, type Colors } from '../../constants/theme';
import { useThemedStyles } from '../../hooks/useColors';

export default function LoginScreen() {
  const [styles] = useThemedStyles(createStyles);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { signIn, isLoading } = useAuthStore();
  const router = useRouter();

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setError(null);
    const { error } = await signIn(email, password);

    if (error) {
      setError(error.message);
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
          <DisplayLarge style={styles.title}>Welcome Back</DisplayLarge>
          <BodyMedium>Sign in to continue your journey</BodyMedium>
        </View>

        <View style={styles.form}>
          <Input
            label="Email"
            placeholder="Enter your email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            error={error && !email ? 'Email is required' : undefined}
          />

          <Input
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            error={error && !password ? 'Password is required' : undefined}
          />

          {error && email && password && <Text style={styles.error}>{error}</Text>}

          <View style={styles.buttonContainer}>
            <Button
              title="Sign In"
              onPress={handleLogin}
              loading={isLoading}
              disabled={isLoading}
              size="lg"
              fullWidth
            />
          </View>
        </View>

        <View style={styles.footer}>
          <BodyMedium>Don't have an account? </BodyMedium>
          <Link href="/(auth)/signup" asChild>
            <TouchableOpacity>
              <Text style={styles.link}>Sign Up</Text>
            </TouchableOpacity>
          </Link>
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
  },
  title: {
    marginBottom: SPACING.xs,
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
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  link: {
    ...TYPOGRAPHY.bodyLarge,
    color: colors.primary,
    fontWeight: '600',
  },
});
