import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput } from 'react-native';
import { BORDER_RADIUS, TYPOGRAPHY, type Colors } from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';

/** The last row of the tag picker: a pill that becomes a field when tapped. */
export function TaskNewTagRow({ onCreate }: { onCreate: (tagName: string) => void }) {
  const [styles, colors] = useThemedStyles(createStyles);
  const [isTyping, setIsTyping] = useState(false);
  const [name, setName] = useState('');
  const committed = useRef(false);

  if (!isTyping) {
    return (
      <Pressable
        style={styles.newTag}
        onPress={() => {
          committed.current = false;
          setIsTyping(true);
        }}
        accessibilityRole="button"
        accessibilityLabel="New category"
      >
        <Text style={styles.newTagLabel}>New category…</Text>
      </Pressable>
    );
  }

  // Submitting also blurs, so the ref keeps one name from creating two tags.
  const commit = () => {
    const next = name.trim();
    setIsTyping(false);
    setName('');
    if (next && !committed.current) {
      committed.current = true;
      onCreate(next);
    }
  };

  return (
    <TextInput
      style={[styles.newTag, styles.newTagInput]}
      value={name}
      onChangeText={setName}
      placeholder="Category name"
      placeholderTextColor={colors.textLight}
      autoFocus
      returnKeyType="done"
      onSubmitEditing={commit}
      onBlur={commit}
      accessibilityLabel="New category name"
    />
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    newTag: {
      borderRadius: BORDER_RADIUS.full,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.border,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    newTagLabel: {
      ...TYPOGRAPHY.caption,
      color: colors.textSecondary,
    },
    newTagInput: {
      ...TYPOGRAPHY.caption,
      minWidth: 120,
      color: colors.text,
    },
  });
