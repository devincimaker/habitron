import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { InstructActionRow, InstructActionStatus } from '@habits-coach/shared';
import { SPACING, TYPOGRAPHY, type Colors } from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';
import { useInstructLogStore } from '../stores/useInstructLogStore';
import { actionTitle } from '../utils/instruct';
import type { InstructVerb } from '../services/api';

const STATUS_LABEL: Record<InstructActionStatus, string> = {
  queued: 'Queued',
  working: 'Working…',
  applied: 'Applied',
  failed: 'Failed',
  rewound: 'Rewound',
  canceled: 'Canceled',
};

const STATUS_ICON: Record<InstructActionStatus, keyof typeof Ionicons.glyphMap> = {
  queued: 'time-outline',
  working: 'time-outline', // replaced by a spinner below
  applied: 'checkmark',
  failed: 'close',
  rewound: 'arrow-undo-outline',
  canceled: 'remove',
};

/** Row actions by status — the whole verb table of the log. */
function verbsFor(status: InstructActionStatus): { verb: InstructVerb | 'reinstruct'; label: string }[] {
  switch (status) {
    case 'queued':
    case 'working':
      return [{ verb: 'cancel', label: 'Cancel' }];
    case 'applied':
      return [
        { verb: 'rewind', label: 'Rewind' },
        { verb: 'reinstruct', label: 'Re-instruct' },
      ];
    case 'rewound':
      return [
        { verb: 'restore', label: 'Restore' },
        { verb: 'reinstruct', label: 'Re-instruct' },
      ];
    case 'failed':
      return [
        { verb: 'retry', label: 'Retry' },
        { verb: 'dismiss', label: 'Dismiss' },
        { verb: 'reinstruct', label: 'Re-instruct' },
      ];
    case 'canceled':
      return [];
  }
}

function ActionRow({ action }: { action: InstructActionRow }) {
  const [styles, colors] = useThemedStyles(createStyles);
  const act = useInstructLogStore((s) => s.act);
  const armReinstruct = useInstructLogStore((s) => s.armReinstruct);
  const pendingVerb = useInstructLogStore((s) => s.busy[action.id]);

  const struck = action.status === 'rewound' || action.status === 'canceled';

  return (
    <View style={styles.row}>
      <View style={styles.puck}>
        {action.status === 'working' || pendingVerb ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Ionicons
            name={STATUS_ICON[action.status]}
            size={18}
            color={action.status === 'failed' ? colors.error : colors.textSecondary}
          />
        )}
      </View>

      <View style={styles.body}>
        <Text style={[styles.title, struck && styles.titleStruck]} numberOfLines={2}>
          {actionTitle(action)}
        </Text>
        <Text style={styles.meta} numberOfLines={2}>
          “{action.transcript}”
        </Text>
        {verbsFor(action.status).length > 0 && (
          <View style={styles.verbs}>
            {verbsFor(action.status).map(({ verb, label }) => (
              <Pressable
                key={verb}
                onPress={() => (verb === 'reinstruct' ? armReinstruct(action) : void act(action.id, verb))}
                disabled={pendingVerb !== undefined}
                accessibilityRole="button"
                accessibilityLabel={`${label} instruction`}
                style={({ pressed }) => [styles.verb, pressed && styles.verbPressed]}
              >
                <Text style={[styles.verbText, verb === 'dismiss' && styles.verbTextMuted]}>{label}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <Text style={[styles.chip, action.status === 'failed' && styles.chipFailed]}>
        {STATUS_LABEL[action.status]}
      </Text>
    </View>
  );
}

/**
 * The Coach activity log: every instruction of the day, newest first, with
 * the rewind/retry/re-instruct controls. Opened from the ticker pill and the
 * Coach hub row.
 */
export function CoachActivitySheet() {
  const [styles, colors] = useThemedStyles(createStyles);
  const open = useInstructLogStore((s) => s.sheetOpen);
  const setSheetOpen = useInstructLogStore((s) => s.setSheetOpen);
  const actions = useInstructLogStore((s) => s.actions);

  return (
    <Modal
      visible={open}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setSheetOpen(false)}
    >
      <View style={styles.sheet}>
        <View style={styles.grabber} />
        <View style={styles.header}>
          <Text style={styles.heading}>Coach activity</Text>
          <Pressable
            onPress={() => setSheetOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Close activity"
            hitSlop={8}
          >
            <Ionicons name="close" size={22} color={colors.textSecondary} />
          </Pressable>
        </View>
        <FlatList
          data={actions}
          keyExtractor={(action) => action.id}
          renderItem={({ item }) => <ActionRow action={item} />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>Nothing yet today. Hold the Coach tab and say what to change.</Text>
          }
        />
      </View>
    </Modal>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    sheet: {
      flex: 1,
      backgroundColor: colors.background,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingTop: SPACING.sm,
    },
    grabber: {
      alignSelf: 'center',
      width: 36,
      height: 5,
      borderRadius: 3,
      backgroundColor: colors.border,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.md,
    },
    heading: {
      ...TYPOGRAPHY.headingLarge,
      color: colors.textStrong,
    },
    list: {
      paddingHorizontal: SPACING.md,
      paddingBottom: SPACING.xl,
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginVertical: SPACING.sm,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: SPACING.sm,
    },
    puck: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    body: {
      flex: 1,
      gap: 2,
    },
    title: {
      ...TYPOGRAPHY.bodyMedium,
      fontWeight: '600',
      color: colors.text,
    },
    titleStruck: {
      textDecorationLine: 'line-through',
      color: colors.textSecondary,
    },
    meta: {
      ...TYPOGRAPHY.caption,
      fontStyle: 'italic',
      color: colors.textLight,
    },
    verbs: {
      flexDirection: 'row',
      gap: SPACING.md,
      marginTop: SPACING.xs,
    },
    verb: {
      paddingVertical: 2,
    },
    verbPressed: {
      opacity: 0.5,
    },
    verbText: {
      ...TYPOGRAPHY.caption,
      fontWeight: '600',
      color: colors.primary,
    },
    verbTextMuted: {
      color: colors.textSecondary,
    },
    chip: {
      ...TYPOGRAPHY.caption,
      color: colors.textSecondary,
    },
    empty: {
      ...TYPOGRAPHY.bodyMedium,
      textAlign: 'center',
      color: colors.textSecondary,
      paddingVertical: SPACING.xl,
    },
    chipFailed: {
      color: colors.error,
      fontWeight: '600',
    },
  });
