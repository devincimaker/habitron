import { useEffect, useState } from 'react';
import { TextInput, type StyleProp, type TextStyle } from 'react-native';
import { useColors } from '../hooks/useColors';

interface TaskSheetTextFieldProps {
  value: string;
  placeholder: string;
  accessibilityLabel: string;
  style: StyleProp<TextStyle>;
  /** Called on blur, only when the text actually changed. */
  onCommit: (value: string) => void;
  /** Keeps the stored value when the field is emptied — a title is not erasable. */
  required?: boolean;
}

/**
 * One autosaving field of the task sheet.
 *
 * It owns its draft so a keystroke re-renders the field and not the sheet —
 * which, on a route that keeps four picker modals mounted, is the difference
 * between typing a title and rebuilding a calendar grid per character.
 */
export function TaskSheetTextField({
  value,
  placeholder,
  accessibilityLabel,
  style,
  onCommit,
  required = false,
}: TaskSheetTextFieldProps) {
  const colors = useColors();
  const [draft, setDraft] = useState(value);

  // A save that fails alerts and leaves the stored value unchanged; without
  // this the field would go on showing text that never reached the database.
  useEffect(() => setDraft(value), [value]);

  return (
    <TextInput
      style={style}
      value={draft}
      onChangeText={setDraft}
      placeholder={placeholder}
      placeholderTextColor={colors.textLight}
      multiline
      onBlur={() => {
        const next = required ? draft.trim() : draft;
        if (required && !next) {
          setDraft(value);
          return;
        }
        if (next !== value) onCommit(next);
      }}
      accessibilityLabel={accessibilityLabel}
    />
  );
}
