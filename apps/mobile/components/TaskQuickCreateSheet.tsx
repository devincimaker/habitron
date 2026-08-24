import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type NativeSyntheticEvent,
  type TextInputSelectionChangeEventData,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { TodoDraft } from '@habits-coach/shared';
import { DatePickerModal } from './DatePickerModal';
import { BodyMedium } from './ui';
import { BORDER_RADIUS, SHADOWS, SPACING, TYPOGRAPHY, type Colors } from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';
import { useTodosStore } from '../stores/useTodosStore';
import { formatRelativeDateLabel } from '../utils/dateUtils';
import {
  buildQuickCreateTodoDraft,
  getActiveInlineTagContext,
  getQuickCreateTextSegments,
  insertTagTriggerAtSelection,
  replaceActiveInlineTagContext,
  type TextSelectionRange,
} from '../utils/taskQuickCreateTags';
import { getTodoTagTintColor } from '../utils/todoTagColors';

interface TaskQuickCreateSheetProps {
  visible: boolean;
  onClose: () => void;
  onSave: (draft: TodoDraft) => Promise<void>;
  defaultScheduledDate?: string;
}

const QUICK_ACTIONS = [
  { icon: 'calendar-outline', label: 'Schedule task', action: 'date' },
  { icon: 'flag-outline', label: 'Set priority', action: null },
  { icon: 'pricetag-outline', label: 'Set category', action: 'tag' },
  { icon: 'ellipsis-horizontal', label: 'More task actions', action: null },
] as const;

const INITIAL_SELECTION: TextSelectionRange = { start: 0, end: 0 };

function getTagSuggestionRank(tagName: string, normalizedQuery: string) {
  const normalizedTagName = tagName.toLowerCase();

  if (!normalizedQuery) {
    return 0;
  }

  if (normalizedTagName.startsWith(normalizedQuery)) {
    return 0;
  }

  if (normalizedTagName.includes(normalizedQuery)) {
    return 1;
  }

  return 2;
}

export function TaskQuickCreateSheet({
  visible,
  onClose,
  onSave,
  defaultScheduledDate,
}: TaskQuickCreateSheetProps) {
  const [styles, colors] = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const tags = useTodosStore((state) => state.tags);
  const inputRef = useRef<TextInput>(null);
  const [title, setTitle] = useState('');
  const [selection, setSelection] = useState<TextSelectionRange>(INITIAL_SELECTION);
  const [isSaving, setIsSaving] = useState(false);
  const [scheduledDate, setScheduledDate] = useState(defaultScheduledDate);
  const [isPickingDate, setIsPickingDate] = useState(false);
  const saveDraft = useMemo(
    () => buildQuickCreateTodoDraft(title, scheduledDate),
    [scheduledDate, title]
  );
  const highlightedTextSegments = useMemo(() => getQuickCreateTextSegments(title), [title]);
  const activeInlineTag = useMemo(
    () => getActiveInlineTagContext(title, selection),
    [selection, title]
  );
  const tagSuggestions = useMemo(() => {
    if (!activeInlineTag) {
      return [];
    }

    const normalizedQuery = activeInlineTag.query.trim().toLowerCase();
    return tags
      .filter((tag) =>
        normalizedQuery ? tag.name.toLowerCase().includes(normalizedQuery) : true
      )
      .slice()
      .sort(
        (leftTag, rightTag) =>
          getTagSuggestionRank(leftTag.name, normalizedQuery) -
            getTagSuggestionRank(rightTag.name, normalizedQuery) ||
          leftTag.name.localeCompare(rightTag.name)
      );
  }, [activeInlineTag, tags]);
  const hasText = title.trim().length > 0;
  const canSave = Boolean(saveDraft) && !isSaving;
  const shouldShowTagSuggestions = Boolean(activeInlineTag) && tagSuggestions.length > 0;

  const focusComposer = useCallback((delayMs = 0) => {
    requestAnimationFrame(() => {
      if (delayMs > 0) {
        setTimeout(() => {
          inputRef.current?.focus();
        }, delayMs);
        return;
      }

      inputRef.current?.focus();
    });
  }, []);

  useEffect(() => {
    if (!visible) {
      setTitle('');
      setSelection(INITIAL_SELECTION);
      setIsSaving(false);
      setIsPickingDate(false);
      return;
    }

    setScheduledDate(defaultScheduledDate);
  }, [defaultScheduledDate, visible]);

  const handleClose = () => {
    if (isSaving) return;
    Keyboard.dismiss();
    onClose();
  };

  const handleSave = async () => {
    if (!saveDraft) return;

    setIsSaving(true);
    try {
      await onSave(saveDraft);
      Keyboard.dismiss();
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const updateTitleAndSelection = useCallback(
    (nextText: string, nextSelection: TextSelectionRange) => {
      setTitle(nextText);
      setSelection(nextSelection);
      focusComposer();
    },
    [focusComposer]
  );

  const handleOpenDatePicker = useCallback(() => {
    Keyboard.dismiss();
    setIsPickingDate(true);
  }, []);

  const handleCloseDatePicker = useCallback(() => {
    setIsPickingDate(false);
    focusComposer(120);
  }, [focusComposer]);

  const handleSelectionChange = useCallback(
    (event: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
      setSelection(event.nativeEvent.selection);
    },
    []
  );

  const handleInsertTagTrigger = useCallback(() => {
    const nextState = insertTagTriggerAtSelection(title, selection);
    updateTitleAndSelection(nextState.text, nextState.selection);
  }, [selection, title, updateTitleAndSelection]);

  const handleSelectTagSuggestion = useCallback(
    (tagName: string) => {
      if (!activeInlineTag) {
        return;
      }

      const nextState = replaceActiveInlineTagContext(title, activeInlineTag, tagName);
      updateTitleAndSelection(nextState.text, nextState.selection);
    },
    [activeInlineTag, title, updateTitleAndSelection]
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
      onShow={() => focusComposer(250)}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={handleClose} />

        <View style={[styles.sheet, { paddingBottom: insets.bottom + SPACING.md }]}>
          <View style={styles.handle} />

          {shouldShowTagSuggestions ? (
            <View style={styles.tagSuggestionsPanel}>
              <ScrollView
                style={styles.tagSuggestionsScroll}
                contentContainerStyle={styles.tagSuggestionsContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {tagSuggestions.map((tag) => (
                  <Pressable
                    key={tag.id}
                    style={[
                      styles.tagSuggestionButton,
                      tag.color
                        ? {
                            backgroundColor: getTodoTagTintColor(tag.color, '14'),
                            borderColor: getTodoTagTintColor(tag.color, '2E'),
                          }
                        : undefined,
                    ]}
                    onPress={() => handleSelectTagSuggestion(tag.name)}
                    accessibilityRole="button"
                    accessibilityLabel={`Use tag #${tag.name}`}
                  >
                    <View
                      style={[
                        styles.tagSuggestionDot,
                        tag.color ? { backgroundColor: tag.color } : undefined,
                      ]}
                    />
                    <BodyMedium color={tag.color ?? colors.text}>#{tag.name}</BodyMedium>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}

          <View style={styles.composer}>
            <View style={styles.inputStack}>
              {title ? (
                <Text pointerEvents="none" style={styles.inputHighlightText}>
                  {highlightedTextSegments.map((segment, index) => (
                    <Text
                      key={`${segment.kind}-${index}`}
                      style={
                        segment.kind === 'scheduledTime'
                          ? styles.inputHighlightScheduledTime
                          : segment.kind === 'estimate'
                            ? styles.inputHighlightEstimate
                            : styles.inputHighlightDefault
                      }
                    >
                      {segment.text}
                    </Text>
                  ))}
                </Text>
              ) : null}

              <TextInput
                ref={inputRef}
                style={[
                  styles.input,
                  title ? styles.inputWithHighlightOverlay : undefined,
                ]}
                placeholder="What needs to happen?"
                placeholderTextColor={colors.textLight}
                value={title}
                onChangeText={setTitle}
                selection={selection}
                onSelectionChange={handleSelectionChange}
                selectionColor={colors.primary}
                autoFocus
                multiline
                textAlignVertical="top"
                showSoftInputOnFocus
              />
            </View>

            <View style={styles.actionsRow}>
              <View style={styles.quickActions}>
                {QUICK_ACTIONS.map((action) => {
                  const isActive =
                    (action.action === 'tag' && !!activeInlineTag) ||
                    (action.action === 'date' && !!scheduledDate);

                  return (
                    <Pressable
                      key={action.label}
                      style={[
                        styles.quickActionButton,
                        action.action && styles.quickActionButtonEnabled,
                        isActive && styles.quickActionButtonActive,
                      ]}
                      onPress={
                        action.action === 'tag'
                          ? handleInsertTagTrigger
                          : action.action === 'date'
                            ? handleOpenDatePicker
                            : undefined
                      }
                      accessibilityRole="button"
                      accessibilityLabel={
                        action.action === 'date' && scheduledDate
                          ? `Scheduled ${formatRelativeDateLabel(scheduledDate)}, change date`
                          : action.label
                      }
                      accessibilityState={{ disabled: !action.action }}
                      disabled={!action.action}
                    >
                      <Ionicons
                        name={action.icon}
                        size={18}
                        color={isActive ? colors.primaryDark : colors.textSecondary}
                      />
                      {action.action === 'date' && scheduledDate ? (
                        <Text style={styles.quickActionBadge}>
                          {formatRelativeDateLabel(scheduledDate)}
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                style={[
                  styles.trailingActionButton,
                  canSave && styles.trailingActionButtonActive,
                ]}
                onPress={canSave ? handleSave : undefined}
                disabled={isSaving || !canSave}
                accessibilityRole="button"
                accessibilityLabel={
                  canSave ? 'Create task' : hasText ? 'Task title required' : 'Voice task input'
                }
              >
                {isSaving ? (
                  <ActivityIndicator
                    size="small"
                    color={canSave ? colors.white : colors.textSecondary}
                  />
                ) : hasText ? (
                  <Ionicons
                    name="arrow-up"
                    size={18}
                    color={canSave ? colors.white : colors.textSecondary}
                  />
                ) : (
                  <Ionicons name="mic-outline" size={18} color={colors.textSecondary} />
                )}
              </Pressable>
            </View>
          </View>
        </View>

        <DatePickerModal
          visible={isPickingDate}
          title="Schedule task"
          value={scheduledDate}
          showQuickOptions
          onCancel={handleCloseDatePicker}
          onDone={(date) => {
            setScheduledDate(date);
            handleCloseDatePicker();
          }}
          onClear={
            scheduledDate
              ? () => {
                  setScheduledDate(undefined);
                  handleCloseDatePicker();
                }
              : undefined
          }
        />
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(16, 18, 24, 0.24)',
    },
    sheet: {
      minHeight: 284,
      backgroundColor: colors.background,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingTop: SPACING.sm,
      paddingHorizontal: SPACING.md,
      ...SHADOWS.medium,
    },
    handle: {
      alignSelf: 'center',
      width: 44,
      height: 5,
      borderRadius: BORDER_RADIUS.full,
      backgroundColor: colors.border,
      marginBottom: SPACING.md,
    },
    tagSuggestionsPanel: {
      width: '62%',
      maxHeight: 220,
      marginBottom: SPACING.sm,
      backgroundColor: colors.background,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.border,
      ...SHADOWS.small,
    },
    tagSuggestionsScroll: {
      maxHeight: 220,
    },
    tagSuggestionsContent: {
      paddingVertical: SPACING.xs,
    },
    tagSuggestionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      paddingHorizontal: SPACING.md,
      paddingVertical: 10,
      marginHorizontal: SPACING.xs,
      marginVertical: 2,
      borderRadius: BORDER_RADIUS.lg,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    tagSuggestionDot: {
      width: 8,
      height: 8,
      borderRadius: BORDER_RADIUS.full,
      backgroundColor: colors.textLight,
    },
    composer: {
      backgroundColor: colors.background,
      borderRadius: 22,
      padding: SPACING.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    input: {
      minHeight: 124,
      maxHeight: 200,
      paddingTop: SPACING.xs,
      paddingBottom: SPACING.md,
      color: colors.text,
      ...TYPOGRAPHY.bodyLarge,
    },
    inputStack: {
      position: 'relative',
      minHeight: 124,
    },
    inputHighlightText: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      paddingTop: SPACING.xs,
      paddingBottom: SPACING.md,
      color: colors.text,
      ...TYPOGRAPHY.bodyLarge,
    },
    inputHighlightDefault: {
      color: colors.text,
    },
    inputHighlightScheduledTime: {
      color: '#2F80ED',
      fontWeight: '600',
    },
    inputHighlightEstimate: {
      color: colors.textSecondary,
      fontWeight: '600',
    },
    inputWithHighlightOverlay: {
      color: 'transparent',
    },
    actionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: SPACING.sm,
    },
    quickActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.xs,
    },
    quickActionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      minWidth: 32,
      height: 32,
      paddingHorizontal: SPACING.xs,
      borderRadius: BORDER_RADIUS.full,
      opacity: 0.45,
    },
    quickActionBadge: {
      ...TYPOGRAPHY.caption,
      color: colors.primaryDark,
      fontWeight: '600',
    },
    quickActionButtonEnabled: {
      opacity: 1,
    },
    quickActionButtonActive: {
      backgroundColor: colors.primaryLight,
    },
    trailingActionButton: {
      width: 36,
      height: 36,
      borderRadius: BORDER_RADIUS.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    trailingActionButtonActive: {
      backgroundColor: colors.primary,
    },
  });
