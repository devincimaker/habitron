import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { InstructActionRow } from '@habits-coach/shared';
import { BORDER_RADIUS, SHADOWS, SPACING, TAB_BAR, TYPOGRAPHY, type Colors } from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';
import { useInstructLogStore } from '../stores/useInstructLogStore';
import { actionTitle, currentAction, queueCounts } from '../utils/instruct';

/** How long each completion's ✓/✗ stays up before the pill rolls on. */
const FLASH_MS = 1200;
/** How long "N done" rests before the pill fades away. */
const REST_MS = 3000;
/** How long a client-side notice (didn't catch that, upload failed) stays. */
const NOTICE_MS = 3500;
const POLL_MS = 2500;

interface Flash {
  kind: 'applied' | 'failed';
  label: string;
}

/**
 * The one floating pill above the tab bar: a summary of the instruct queue,
 * never one pill per instruction. It narrates the working item, flashes each
 * landing, rests at "N done", and refuses to fade while a failure is neither
 * retried nor dismissed. Tapping it opens the Coach activity sheet.
 *
 * It also owns the polling: the log refreshes on an interval while the queue
 * is alive, and whenever the app returns to the foreground.
 */
export function InstructTickerPill({ recording }: { recording: boolean }) {
  const [styles, colors] = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();

  const actions = useInstructLogStore((s) => s.actions);
  const uploading = useInstructLogStore((s) => s.uploading);
  const notice = useInstructLogStore((s) => s.notice);
  const reinstructOf = useInstructLogStore((s) => s.reinstructOf);
  const refresh = useInstructLogStore((s) => s.refresh);
  const clearNotice = useInstructLogStore((s) => s.clearNotice);
  const disarmReinstruct = useInstructLogStore((s) => s.disarmReinstruct);
  const setSheetOpen = useInstructLogStore((s) => s.setSheetOpen);

  const settlingCount = useInstructLogStore((s) => Object.keys(s.settling).length);
  const { pending, failed } = queueCounts(actions);
  const live = pending > 0 || uploading > 0 || settlingCount > 0;

  // --- polling: while the queue is alive, and on returning to the foreground
  useEffect(() => {
    void refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [live, refresh]);

  // --- landings: diff the log, flash each completion, count the dones
  const seenRef = useRef<Map<string, InstructActionRow['status']>>(new Map());
  const [flash, setFlash] = useState<Flash | null>(null);
  const flashQueue = useRef<Flash[]>([]);
  const [doneCount, setDoneCount] = useState(0);

  useEffect(() => {
    const seen = seenRef.current;
    for (const action of actions) {
      const before = seen.get(action.id);
      if (before !== action.status) seen.set(action.id, action.status);
      // Flash only transitions witnessed live, from a state this session saw pending.
      const landed = action.status === 'applied' || action.status === 'failed';
      const wasPending = before === 'queued' || before === 'working';
      if (landed && wasPending) {
        flashQueue.current.push({ kind: action.status as Flash['kind'], label: actionTitle(action) });
        if (action.status === 'applied') setDoneCount((count) => count + 1);
      }
    }
    setFlash((current) => current ?? flashQueue.current.shift() ?? null);
  }, [actions]);

  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(flashQueue.current.shift() ?? null), FLASH_MS);
    return () => clearTimeout(timer);
  }, [flash]);

  // --- drained: rest at "N done", then fade (unless a failure holds the pill)
  const atRest = !live && !flash && doneCount > 0;
  useEffect(() => {
    if (!atRest || failed > 0) return;
    const timer = setTimeout(() => setDoneCount(0), REST_MS);
    return () => clearTimeout(timer);
  }, [atRest, failed]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(clearNotice, NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice, clearNotice]);

  if (recording) return null;

  const bottom = TAB_BAR.height + insets.bottom + 16;

  if (reinstructOf) {
    return (
      <Pressable
        style={[styles.bar, { bottom }]}
        onPress={disarmReinstruct}
        accessibilityRole="button"
        accessibilityLabel="Cancel re-instruct"
      >
        <Ionicons name="mic-outline" size={16} color={colors.primary} />
        <Text style={styles.barText} numberOfLines={2}>
          Hold Coach and speak — the correction re-runs against “{actionTitle(reinstructOf)}”
        </Text>
      </Pressable>
    );
  }

  const visible = notice !== null || live || flash !== null || failed > 0 || doneCount > 0;
  if (!visible) return null;

  const current = currentAction(actions);
  // The badge counts what waits behind whatever the label narrates.
  const narrated = flash || notice ? 0 : current || uploading > 0 ? 1 : 0;
  const behind = Math.max(0, pending + uploading - narrated);

  let icon = <ActivityIndicator size="small" color={colors.primary} />;
  let label: string;
  let failing = notice !== null;

  if (notice) {
    icon = <Ionicons name="alert-circle" size={18} color={colors.error} />;
    label = notice;
  } else if (flash) {
    failing = flash.kind === 'failed';
    icon = failing ? (
      <Ionicons name="close-circle" size={18} color={colors.error} />
    ) : (
      <Ionicons name="checkmark-circle" size={18} color={colors.success} />
    );
    label = flash.label;
  } else if (live) {
    label = current ? actionTitle(current) : uploading > 0 ? 'Sending…' : 'Working…';
  } else {
    // Drained. A lingering failure keeps the pill (and its red edge) on screen.
    failing = failed > 0;
    icon = failing ? (
      <Ionicons name="close-circle" size={18} color={colors.error} />
    ) : (
      <Ionicons name="checkmark-circle" size={18} color={colors.success} />
    );
    // Completions that landed while the app was away were never flashed or
    // counted; a bare "0 done" would misread, so the zero stays off the label.
    const done = `${doneCount} done`;
    if (failed === 0) label = done;
    else label = doneCount > 0 ? `${done} · ${failed} failed` : `${failed} failed`;
  }

  return (
    <Pressable
      style={[styles.pill, failing && styles.pillFailing, { bottom }]}
      onPress={() => setSheetOpen(true)}
      accessibilityRole="button"
      accessibilityLabel="Coach activity"
      testID="instruct-ticker-pill"
    >
      {icon}
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      {behind > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>+{behind}</Text>
        </View>
      )}
    </Pressable>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    pill: {
      position: 'absolute',
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      maxWidth: '86%',
      paddingVertical: SPACING.sm,
      paddingHorizontal: SPACING.md,
      borderRadius: BORDER_RADIUS.full,
      backgroundColor: colors.background,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      ...SHADOWS.medium,
    },
    pillFailing: {
      borderWidth: 1,
      borderColor: colors.error,
    },
    label: {
      ...TYPOGRAPHY.label,
      flexShrink: 1,
      color: colors.text,
    },
    badge: {
      paddingHorizontal: SPACING.xs,
      paddingVertical: 1,
      borderRadius: BORDER_RADIUS.full,
      backgroundColor: colors.primaryLight,
    },
    badgeText: {
      ...TYPOGRAPHY.caption,
      fontWeight: '700',
      color: colors.primary,
    },
    bar: {
      position: 'absolute',
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      marginHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      paddingHorizontal: SPACING.md,
      borderRadius: BORDER_RADIUS.lg,
      backgroundColor: colors.primaryLight,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    barText: {
      ...TYPOGRAPHY.caption,
      flexShrink: 1,
      color: colors.text,
    },
  });
