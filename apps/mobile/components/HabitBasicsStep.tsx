import { useRef, type Ref } from 'react';
import { Pressable, StyleSheet, View, type TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Caption, HeadingMedium, Input } from './ui';
import { createHabitCardStyles } from './habitComposerStyles';
import { SHADOWS, SPACING, type Colors } from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';
import {
  HABIT_ICON_OPTIONS,
  getHabitIconLabel,
  getHabitIconOption,
  type HabitIconName,
} from '../utils/habitIcons';

interface HabitBasicsStepProps {
  name: string;
  onNameChange: (name: string) => void;
  /** The shell focuses the name once the sheet has landed. */
  nameRef: Ref<TextInput>;
  reason: string;
  onReasonChange: (reason: string) => void;
  selectedIcon: HabitIconName;
  onSelectIcon: (icon: HabitIconName) => void;
}

/** Step 1 of the composer — what and why: the name, why it matters, the icon. All the typing lives here. */
export function HabitBasicsStep({
  name,
  onNameChange,
  nameRef,
  reason,
  onReasonChange,
  selectedIcon,
  onSelectIcon,
}: HabitBasicsStepProps) {
  const [styles, colors] = useThemedStyles(createStyles);
  const reasonRef = useRef<TextInput>(null);
  const selectedOption = getHabitIconOption(selectedIcon);

  return (
    <>
      <View style={styles.surfaceCard}>
        <Caption style={styles.cardEyebrow}>Habit name</Caption>
        <Input
          ref={nameRef}
          placeholder="Daily check-in"
          value={name}
          onChangeText={onNameChange}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => reasonRef.current?.focus()}
          containerStyle={styles.fieldNoMargin}
        />
      </View>

      <View style={styles.surfaceCard}>
        <Input
          ref={reasonRef}
          label="Why it matters"
          placeholder="What this supports in your life"
          value={reason}
          onChangeText={onReasonChange}
          multiline
          inputStyle={styles.reasonInput}
          containerStyle={styles.fieldNoMargin}
        />
      </View>

      <View style={styles.surfaceCard}>
        <View style={styles.cardHeader}>
          <View>
            <HeadingMedium style={styles.cardTitle}>Icon</HeadingMedium>
            <Caption>{getHabitIconLabel(selectedIcon)}</Caption>
          </View>
          {selectedOption ? (
            <View
              style={[
                styles.selectedIconChip,
                { backgroundColor: selectedOption.accentColor },
              ]}
            >
              <Ionicons name={selectedIcon} size={16} color={colors.white} />
            </View>
          ) : null}
        </View>

        <View style={styles.iconGrid}>
          {HABIT_ICON_OPTIONS.map((option) => {
            const isSelected = option.icon === selectedIcon;

            return (
              <Pressable
                key={option.icon}
                style={[
                  styles.iconChoice,
                  isSelected && styles.iconChoiceSelected,
                ]}
                onPress={() => onSelectIcon(option.icon)}
                accessibilityRole="button"
                accessibilityLabel={`Choose ${option.label} icon`}
              >
                <View
                  style={[
                    styles.iconBubble,
                    { backgroundColor: option.accentColor },
                    isSelected && styles.iconBubbleSelected,
                  ]}
                >
                  <Ionicons name={option.icon} size={18} color={colors.white} />
                </View>
                {isSelected ? (
                  <View style={styles.iconCheck}>
                    <Ionicons name="checkmark" size={11} color={colors.white} />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>
    </>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    ...createHabitCardStyles(colors),
    cardEyebrow: {
      marginBottom: SPACING.sm,
      color: colors.textSecondary,
    },
    fieldNoMargin: {
      marginBottom: 0,
    },
    // The canvas's field height: about a line and a half of reason before it
    // grows, rather than Input's multiline 100.
    reasonInput: {
      minHeight: 72,
    },
    cardTitle: {
      marginBottom: 2,
    },
    selectedIconChip: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },
    iconChoice: {
      width: '20%',
      maxWidth: '20%',
      aspectRatio: 1,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: SPACING.sm,
      position: 'relative',
    },
    iconChoiceSelected: {
      transform: [{ scale: 1.04 }],
    },
    iconBubble: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconBubbleSelected: {
      ...SHADOWS.small,
    },
    iconCheck: {
      position: 'absolute',
      right: 1,
      bottom: 1,
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: colors.primaryDark,
      borderWidth: 2,
      borderColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
