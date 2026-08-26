import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { HabitSection } from '@habits-coach/shared';
import { BodyLarge, Caption, HeadingMedium, Input, Label } from './ui';
import { HabitChip } from './HabitChip';
import { HabitScheduleSection } from './HabitScheduleSection';
import { TimePickerModal } from './TimePickerModal';
import { createHabitCardStyles } from './habitComposerStyles';
import { SPACING, TYPOGRAPHY, type Colors } from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';
import type { HabitDetailsState } from '../utils/habitDraft';
import { getHabitIconLabel, getHabitIconOption, type HabitIconName } from '../utils/habitIcons';
import { formatReminderTime } from '../utils/habitTime';

interface HabitDetailsStepProps {
  /** Step 1 read back at the top of a new habit's details; absent when editing. */
  summary?: { name: string; icon: HabitIconName };
  details: HabitDetailsState;
  onDetailsChange: (patch: Partial<HabitDetailsState>) => void;
  scheduleError: string | null;
  sections: HabitSection[];
  customUnits: string[];
  onAddSection: (name: string) => Promise<HabitSection>;
  onRemoveSection: (sectionId: string) => Promise<void>;
}

/** Step 2 of the composer: schedule, section, reminders and the rest. */
export function HabitDetailsStep({
  summary,
  details,
  onDetailsChange,
  scheduleError,
  sections,
  customUnits,
  onAddSection,
  onRemoveSection,
}: HabitDetailsStepProps) {
  const [styles, colors] = useThemedStyles(createStyles);
  const [isPickingReminder, setIsPickingReminder] = useState(false);
  const [editingReminder, setEditingReminder] = useState<string | null>(null);
  const { sectionId, reminderTimes, constantReminder, autoPopupLog, reason } = details;

  const handleAddSection = () => {
    Alert.prompt('New Section', 'Name for the new section', async (text) => {
      const sectionName = text?.trim();
      if (!sectionName) return;
      if (sections.some((section) => section.name.toLowerCase() === sectionName.toLowerCase())) {
        Alert.alert('Section exists', `You already have a "${sectionName}" section.`);
        return;
      }
      const section = await onAddSection(sectionName);
      onDetailsChange({ sectionId: section.id });
    });
  };

  const handleRemoveSection = (section: HabitSection) => {
    Alert.alert(
      'Delete Section',
      `Delete "${section.name}"? Habits in it will become unsorted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await onRemoveSection(section.id);
            if (sectionId === section.id) {
              onDetailsChange({ sectionId: undefined });
            }
          },
        },
      ]
    );
  };

  const closeReminderPicker = () => {
    setIsPickingReminder(false);
    setEditingReminder(null);
  };

  const handleReminderDone = (time: string) => {
    const next = reminderTimes.filter((existing) => existing !== editingReminder);
    if (!next.includes(time)) next.push(time);
    onDetailsChange({ reminderTimes: next.sort() });
    closeReminderPicker();
  };

  const handleReminderClear = () => {
    onDetailsChange({
      reminderTimes: reminderTimes.filter((existing) => existing !== editingReminder),
    });
    closeReminderPicker();
  };

  return (
    <>
      {summary ? (
        <View style={[styles.surfaceCard, styles.summaryRow]}>
          <View
            style={[
              styles.summaryIcon,
              {
                backgroundColor:
                  getHabitIconOption(summary.icon)?.accentColor ?? colors.primary,
              },
            ]}
          >
            <Ionicons name={summary.icon} size={20} color={colors.white} />
          </View>
          <View style={styles.summaryCopy}>
            <HeadingMedium style={styles.summaryTitle}>
              {summary.name.trim() || 'New habit'}
            </HeadingMedium>
            <Caption>{getHabitIconLabel(summary.icon)}</Caption>
          </View>
        </View>
      ) : null}

      <HabitScheduleSection
        details={details}
        onChange={onDetailsChange}
        scheduleError={scheduleError}
        customUnits={customUnits}
      />

      <View style={styles.surfaceCard}>
        <View style={styles.cardHeader}>
          <Label>Section</Label>
          <Pressable hitSlop={8} onPress={handleAddSection} accessibilityLabel="Add section">
            <Ionicons name="add" size={22} color={colors.textSecondary} />
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.sectionChips}>
            {sections.map((section) => (
              <HabitChip
                key={section.id}
                label={section.name}
                selected={section.id === sectionId}
                onPress={() => onDetailsChange({ sectionId: section.id })}
                onLongPress={() => handleRemoveSection(section)}
              />
            ))}
          </View>
        </ScrollView>
      </View>

      <View style={styles.surfaceCard}>
        <Label>Reminder</Label>
        <View style={styles.reminderRow}>
          {reminderTimes.map((time) => (
            <HabitChip
              key={time}
              label={formatReminderTime(time)}
              selected
              onPress={() => {
                setEditingReminder(time);
                setIsPickingReminder(true);
              }}
            />
          ))}
          <Pressable
            style={styles.addReminder}
            onPress={() => {
              setEditingReminder(null);
              setIsPickingReminder(true);
            }}
            accessibilityLabel="Add reminder"
          >
            <Ionicons name="add" size={20} color={colors.primaryDark} />
            <Text style={styles.addReminderText}>Add</Text>
          </Pressable>
        </View>
        <View style={styles.divider} />
        <View style={styles.toggleRow}>
          <BodyLarge>Constant Reminder</BodyLarge>
          <Switch
            value={constantReminder}
            onValueChange={(value) => onDetailsChange({ constantReminder: value })}
            trackColor={{ true: colors.primary }}
            disabled={reminderTimes.length === 0}
          />
        </View>
        {reminderTimes.length === 0 ? (
          <Caption>Add a reminder time to keep nudging until you log the habit.</Caption>
        ) : null}
      </View>

      <View style={styles.surfaceCard}>
        <View style={styles.toggleRow}>
          <BodyLarge>Auto pop-up of habit log</BodyLarge>
          <Switch
            value={autoPopupLog}
            onValueChange={(value) => onDetailsChange({ autoPopupLog: value })}
            trackColor={{ true: colors.primary }}
          />
        </View>
      </View>

      <View style={styles.surfaceCard}>
        <Input
          label="Why it matters"
          placeholder="What this supports in your life"
          value={reason}
          onChangeText={(value) => onDetailsChange({ reason: value })}
          multiline
          containerStyle={styles.fieldNoMargin}
        />
      </View>

      <TimePickerModal
        visible={isPickingReminder}
        value={editingReminder ?? undefined}
        onCancel={closeReminderPicker}
        onDone={handleReminderDone}
        onClear={editingReminder ? handleReminderClear : undefined}
      />
    </>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    ...createHabitCardStyles(colors),
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    summaryIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: SPACING.md,
    },
    summaryCopy: {
      flex: 1,
    },
    summaryTitle: {
      marginBottom: 2,
    },
    sectionChips: {
      flexDirection: 'row',
      gap: SPACING.sm,
    },
    reminderRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: SPACING.sm,
      marginTop: SPACING.sm,
      marginBottom: SPACING.sm,
    },
    addReminder: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      minHeight: 42,
      paddingHorizontal: SPACING.sm,
    },
    addReminderText: {
      ...TYPOGRAPHY.bodyLarge,
      color: colors.primaryDark,
      fontWeight: '600',
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 44,
    },
  });
