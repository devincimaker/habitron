import { View, Text, StyleSheet, Modal, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '../constants/theme';

type IoniconsName = keyof typeof Ionicons.glyphMap;

interface IconCategory {
  name: string;
  icons: IoniconsName[];
}

const ICON_CATEGORIES: IconCategory[] = [
  {
    name: 'Fitness',
    icons: ['barbell', 'bicycle', 'walk', 'body', 'fitness'],
  },
  {
    name: 'Health',
    icons: ['water', 'nutrition', 'bed', 'medical', 'heart'],
  },
  {
    name: 'Learning',
    icons: ['book', 'school', 'language', 'bulb', 'library'],
  },
  {
    name: 'Productivity',
    icons: ['briefcase', 'laptop', 'time', 'calendar', 'construct'],
  },
  {
    name: 'Self-care',
    icons: ['happy', 'leaf', 'sunny', 'moon', 'sparkles'],
  },
  {
    name: 'General',
    icons: ['star', 'flag', 'trophy', 'rocket', 'checkmark-circle'],
  },
];

interface IconPickerProps {
  visible: boolean;
  selectedIcon?: string;
  onSelectIcon: (icon: string) => void;
  onClose: () => void;
}

export function IconPicker({ visible, selectedIcon, onSelectIcon, onClose }: IconPickerProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Choose an Icon</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </Pressable>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {ICON_CATEGORIES.map((category) => (
              <View key={category.name} style={styles.category}>
                <Text style={styles.categoryName}>{category.name}</Text>
                <View style={styles.iconGrid}>
                  {category.icons.map((icon) => (
                    <Pressable
                      key={icon}
                      style={[
                        styles.iconButton,
                        selectedIcon === icon && styles.iconButtonSelected,
                      ]}
                      onPress={() => onSelectIcon(icon)}
                    >
                      <Ionicons
                        name={icon}
                        size={28}
                        color={selectedIcon === icon ? COLORS.white : COLORS.text}
                      />
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  container: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    maxHeight: '70%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: {
    ...TYPOGRAPHY.headingLarge,
    color: COLORS.text,
  },
  closeButton: {
    padding: SPACING.xs,
  },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  category: {
    marginTop: SPACING.lg,
  },
  categoryName: {
    ...TYPOGRAPHY.label,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  iconButton: {
    width: 52,
    height: 52,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconButtonSelected: {
    backgroundColor: COLORS.primary,
  },
});
