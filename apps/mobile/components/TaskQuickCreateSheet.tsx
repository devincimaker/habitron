/* eslint-disable max-lines -- HAB-89: split pending */
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type NativeSyntheticEvent,
  type TextInputSelectionChangeEventData,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Priority, TodoDraft } from '@habits-coach/shared';
import { DatePickerModal } from './DatePickerModal';
import {
  TaskQuickCreatePopover,
  type TaskQuickCreatePopoverContent,
} from './TaskQuickCreatePopover';
import { BORDER_RADIUS, SHADOWS, SPACING, TYPOGRAPHY, type Colors } from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';
import { useTodosStore } from '../stores/useTodosStore';
import { formatRelativeDateLabel } from '../utils/dateUtils';
import {
  applyTagAtSelection,
  buildQuickCreateTodoDraft,
  getActiveInlineTagContext,
  getInlineTagName,
  getQuickCreateTextSegments,
  insertTagTriggerAtSelection,
  rankTagSuggestions,
  type TextSelectionRange,
} from '../utils/taskQuickCreateTags';
import { getTodoPriorityOption } from '../utils/todoPriority';

interface TaskQuickCreateSheetProps {
  visible: boolean;
  onClose: () => void;
  onSave: (draft: TodoDraft) => Promise<void>;
  defaultScheduledDate?: string;
}

type QuickCreatePicker = 'priority' | 'tags';

interface QuickAction {
  key: string;
  ref?: RefObject<View | null>;
  icon: keyof typeof Ionicons.glyphMap;
  /** Set when the icon carries its own colour (the priority flag). */
  iconColor?: string;
  label: string;
  badge?: string;
  isActive: boolean;
  onPress: () => void;
}

const INITIAL_SELECTION: TextSelectionRange = { start: 0, end: 0 };

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
  const sheetRef = useRef<View>(null);
  const priorityButtonRef = useRef<View>(null);
  const tagButtonRef = useRef<View>(null);
  const [title, setTitle] = useState('');
  const [selection, setSelection] = useState<TextSelectionRange>(INITIAL_SELECTION);
  const [isSaving, setIsSaving] = useState(false);
  const [scheduledDate, setScheduledDate] = useState(defaultScheduledDate);
  const [priority, setPriority] = useState<Priority | undefined>();
  const [isPickingDate, setIsPickingDate] = useState(false);
  const [picker, setPicker] = useState<QuickCreatePicker | null>(null);
  const saveDraft = useMemo(
    () => buildQuickCreateTodoDraft(title, scheduledDate, priority),
    [priority, scheduledDate, title]
  );
  const highlightedTextSegments = useMemo(() => getQuickCreateTextSegments(title), [title]);
  const activeInlineTag = useMemo(
    () => getActiveInlineTagContext(title, selection),
    [selection, title]
  );
  const tagSuggestions = useMemo(
    () => (activeInlineTag ? rankTagSuggestions(tags, activeInlineTag.query) : []),
    [activeInlineTag, tags]
  );
  const canSave = Boolean(saveDraft) && !isSaving;
  const priorityOption = getTodoPriorityOption(priority);
  // Only the first line's tag is the category; checklist lines below do not count.
  const hasInlineTag = Boolean(getInlineTagName(title.split('\n')[0] ?? ''));

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
      setPriority(undefined);
      setPicker(null);
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

  const closePicker = () => setPicker(null);

  const handleOpenTagPicker = () => {
    if (tags.length === 0) {
      // Nothing to pick from: drop a `#` at the caret so a new tag can be typed.
      const nextState = insertTagTriggerAtSelection(title, selection);
      updateTitleAndSelection(nextState.text, nextState.selection);
      return;
    }
    setPicker('tags');
  };

  const handleSelectPriority = (nextPriority: Priority | undefined) => {
    setPriority(nextPriority);
    setPicker(null);
  };

  const handleSelectTag = (tagName: string) => {
    const nextState = applyTagAtSelection(title, selection, tagName);
    updateTitleAndSelection(nextState.text, nextState.selection);
    setPicker(null);
  };

  const handleChangeTitle = (nextTitle: string) => {
    setTitle(nextTitle);
    // Typing is a dismissal, like tapping outside; the inline `#` list takes over.
    setPicker(null);
  };

  // The tag button lists every tag; typing `#` lists the matches, above the same button.
  const pickerTags = picker === 'tags' ? tags : tagSuggestions;
  const pickerContent: TaskQuickCreatePopoverContent | null =
    picker === 'priority'
      ? { kind: 'priority', selected: priority, onSelect: handleSelectPriority }
      : pickerTags.length > 0
        ? { kind: 'tags', tags: pickerTags, onSelect: handleSelectTag }
        : null;

  const quickActions: QuickAction[] = [
    {
      key: 'date',
      icon: 'calendar-outline',
      label: scheduledDate
        ? `Scheduled ${formatRelativeDateLabel(scheduledDate)}, change date`
        : 'Schedule task',
      badge: scheduledDate ? formatRelativeDateLabel(scheduledDate) : undefined,
      isActive: !!scheduledDate,
      onPress: handleOpenDatePicker,
    },
    {
      key: 'priority',
      ref: priorityButtonRef,
      icon: priorityOption ? 'flag' : 'flag-outline',
      iconColor: priorityOption?.color,
      label: priorityOption
        ? `Priority ${priorityOption.label}, change priority`
        : 'Set priority',
      isActive: !!priorityOption || picker === 'priority',
      onPress: () => setPicker('priority'),
    },
    {
      key: 'tag',
      ref: tagButtonRef,
      icon: 'pricetag-outline',
      label: 'Set category',
      isActive: hasInlineTag || picker === 'tags',
      onPress: handleOpenTagPicker,
    },
  ];

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
        <Pressable style={styles.backdrop} onPress={picker ? closePicker : handleClose} />

        <View
          ref={sheetRef}
          style={[styles.sheet, { paddingBottom: insets.bottom + SPACING.md }]}
        >
          <View style={styles.handle} />

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
                onChangeText={handleChangeTitle}
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
                {quickActions.map((action) => (
                  <Pressable
                    key={action.key}
                    ref={action.ref}
                    style={[
                      styles.quickActionButton,
                      action.isActive && styles.quickActionButtonActive,
                    ]}
                    onPress={action.onPress}
                    accessibilityRole="button"
                    accessibilityLabel={action.label}
                  >
                    <Ionicons
                      name={action.icon}
                      size={18}
                      color={
                        action.iconColor ??
                        (action.isActive ? colors.primaryDark : colors.textSecondary)
                      }
                    />
                    {action.badge ? (
                      <Text style={styles.quickActionBadge}>{action.badge}</Text>
                    ) : null}
                  </Pressable>
                ))}
              </View>

              <Pressable
                style={[
                  styles.trailingActionButton,
                  canSave && styles.trailingActionButtonActive,
                ]}
                onPress={canSave ? handleSave : undefined}
                disabled={isSaving || !canSave}
                accessibilityRole="button"
                accessibilityLabel={canSave ? 'Create task' : 'Task title required'}
              >
                {isSaving ? (
                  <ActivityIndicator
                    size="small"
                    color={canSave ? colors.white : colors.textSecondary}
                  />
                ) : (
                  <Ionicons
                    name="arrow-up"
                    size={18}
                    color={canSave ? colors.white : colors.textSecondary}
                  />
                )}
              </Pressable>
            </View>
          </View>

          {pickerContent ? (
            <TaskQuickCreatePopover
              // Remount when the anchor changes, or the date badge moves it: the card
              // measures its place once, on mount.
              key={`${pickerContent.kind}-${scheduledDate ?? ''}`}
              anchorRef={pickerContent.kind === 'priority' ? priorityButtonRef : tagButtonRef}
              containerRef={sheetRef}
              content={pickerContent}
              onClose={picker ? closePicker : undefined}
            />
          ) : null}
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
      // Slack under minHeight sits above the composer, so the actions row always
      // rides the bottom edge the popover is measured from.
      justifyContent: 'flex-end',
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
    },
    quickActionBadge: {
      ...TYPOGRAPHY.caption,
      color: colors.primaryDark,
      fontWeight: '600',
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
