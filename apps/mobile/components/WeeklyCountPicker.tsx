import { useEffect, useMemo, useRef } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SPACING, TYPOGRAPHY, type Colors } from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';

interface WeeklyCountPickerProps {
  value: number;
  onChange: (value: number) => void;
}

const ITEM_HEIGHT = 40;
const VISIBLE_ROWS = 3;
const OPTIONS = [1, 2, 3, 4, 5, 6, 7];

export function WeeklyCountPicker({
  value,
  onChange,
}: WeeklyCountPickerProps) {
  const [styles] = useThemedStyles(createStyles);
  const scrollViewRef = useRef<ScrollView>(null);
  const maskHeight = ITEM_HEIGHT * VISIBLE_ROWS;

  useEffect(() => {
    scrollViewRef.current?.scrollTo({
      y: (Math.max(1, Math.min(7, value)) - 1) * ITEM_HEIGHT,
      animated: false,
    });
  }, [value]);

  const handleMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const index = Math.round(offsetY / ITEM_HEIGHT);
    const selected = OPTIONS[Math.max(0, Math.min(OPTIONS.length - 1, index))];
    if (selected !== value) {
      onChange(selected);
    }
  };

  const numbers = useMemo(
    () =>
      OPTIONS.map((count) => {
        const distance = Math.abs(count - value);
        return (
          <View key={count} style={styles.optionRow}>
            <Text
              style={[
                styles.optionText,
                distance === 0 && styles.optionTextActive,
                distance === 1 && styles.optionTextNear,
                distance > 1 && styles.optionTextFar,
              ]}
            >
              {count}
            </Text>
          </View>
        );
      }),
    [styles, value]
  );

  return (
    <View style={[styles.mask, { height: maskHeight }]}>
      <ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        bounces={false}
        contentContainerStyle={{
          paddingVertical: maskHeight / 2 - ITEM_HEIGHT / 2,
        }}
        onMomentumScrollEnd={handleMomentumEnd}
      >
        {numbers}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    mask: {
      overflow: 'hidden',
      alignSelf: 'center',
      minWidth: 48,
    },
    optionRow: {
      height: ITEM_HEIGHT,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: SPACING.sm,
    },
    optionText: {
      ...TYPOGRAPHY.headingMedium,
      color: colors.textLight,
    },
    optionTextActive: {
      ...TYPOGRAPHY.displayMedium,
      color: colors.primary,
      fontWeight: '700',
    },
    optionTextNear: {
      color: colors.textSecondary,
      opacity: 0.7,
    },
    optionTextFar: {
      opacity: 0.35,
    },
  });
