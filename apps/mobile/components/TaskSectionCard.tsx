import { Ionicons } from '@expo/vector-icons';
import { type ReactNode, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Caption, Card, SectionLabel } from './ui';
import { SPACING, TOUCH_TARGET } from '../constants/theme';
import { useColors } from '../hooks/useColors';

interface TaskSectionCardProps {
  /** Omitted renders no header row at all — the Tasks tab's open list wants the card without a label. */
  title?: string;
  count?: number;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  /** Dims the body only. The header stays at full opacity so its label and count remain readable. */
  dimContent?: boolean;
  /**
   * A function when the body is expensive: the Tasks tab's Completed list is every
   * completed task ever, and it starts collapsed, so it must not be built to be thrown away.
   */
  children: ReactNode | (() => ReactNode);
}

export function TaskSectionCard({
  title,
  count,
  collapsible = false,
  defaultExpanded = true,
  dimContent = false,
  children,
}: TaskSectionCardProps) {
  const colors = useColors();
  // Deliberately local: the issue rules out persisting this across sessions.
  const [expanded, setExpanded] = useState(defaultExpanded);

  // The header is the only toggle, and it needs a title to render. Without one
  // there is nothing to tap, so the body must stay reachable rather than
  // stranding its children behind a chevron that was never drawn.
  const isCollapsible = collapsible && title !== undefined;
  const showBody = !isCollapsible || expanded;
  const HeaderContainer = isCollapsible ? Pressable : View;
  const headerProps = isCollapsible
    ? {
        onPress: () => setExpanded((current) => !current),
        accessibilityRole: 'button' as const,
        accessibilityState: { expanded },
        accessibilityLabel: `${expanded ? 'Collapse' : 'Expand'} ${title.toLowerCase()} tasks, ${count ?? 0} items`,
      }
    : {};

  return (
    <Card variant="outlined" noPadding noMargin style={styles.card}>
      {title ? (
        <HeaderContainer style={[styles.header, isCollapsible && styles.headerCollapsible]} {...headerProps}>
          <SectionLabel>{title}</SectionLabel>
          <View style={styles.headerRight}>
            {count !== undefined ? <Caption>{count}</Caption> : null}
            {isCollapsible ? (
              <Ionicons
                name={expanded ? 'chevron-down' : 'chevron-forward'}
                size={18}
                color={colors.textLight}
              />
            ) : null}
          </View>
        </HeaderContainer>
      ) : null}
      {showBody ? (
        <View
          style={[
            styles.body,
            !title && styles.bodyNoHeader,
            dimContent && styles.bodyDimmed,
          ]}
        >
          {typeof children === 'function' ? children() : children}
        </View>
      ) : null}
    </Card>
  );
}

// No style here depends on the palette — Card's `outlined` variant owns the
// background and border — so this does not need to be built per theme.
const styles = StyleSheet.create({
  card: {
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingTop: 12,
    paddingBottom: 6,
  },
  headerCollapsible: {
    minHeight: TOUCH_TARGET.min,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  body: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xs,
  },
  bodyDimmed: {
    opacity: 0.55,
  },
  bodyNoHeader: {
    paddingTop: SPACING.sm,
  },
});
