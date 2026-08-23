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

export interface WheelOption<T extends string | number> {
  label: string;
  value: T;
}

interface WheelPickerProps<T extends string | number> {
  options: Array<WheelOption<T>>;
  value: T;
  onChange: (value: T) => void;
  visibleRows?: number;
  minWidth?: number;
}

const ITEM_HEIGHT = 40;

export function WheelPicker<T extends string | number>({
  options,
  value,
  onChange,
  visibleRows = 5,
  minWidth = 56,
}: WheelPickerProps<T>) {
  const [styles] = useThemedStyles(createStyles);
  const scrollViewRef = useRef<ScrollView>(null);
  const maskHeight = ITEM_HEIGHT * visibleRows;
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value)
  );

  useEffect(() => {
    scrollViewRef.current?.scrollTo({ y: selectedIndex * ITEM_HEIGHT, animated: false });
  }, [selectedIndex]);

  const handleMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const index = Math.round(offsetY / ITEM_HEIGHT);
    const selected = options[Math.max(0, Math.min(options.length - 1, index))];
    if (selected && selected.value !== value) {
      onChange(selected.value);
    }
  };

  const rows = useMemo(
    () =>
      options.map((option, index) => {
        const distance = Math.abs(index - selectedIndex);
        return (
          <View key={String(option.value)} style={styles.optionRow}>
            <Text
              style={[
                styles.optionText,
                distance === 0 && styles.optionTextActive,
                distance === 1 && styles.optionTextNear,
                distance > 1 && styles.optionTextFar,
              ]}
            >
              {option.label}
            </Text>
          </View>
        );
      }),
    [options, selectedIndex, styles]
  );

  return (
    <View style={[styles.mask, { height: maskHeight, minWidth }]}>
      <View
        pointerEvents="none"
        style={[styles.highlight, { top: maskHeight / 2 - ITEM_HEIGHT / 2 }]}
      />
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
        onScrollEndDrag={handleMomentumEnd}
      >
        {rows}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    mask: {
      overflow: 'hidden',
      alignSelf: 'center',
    },
    highlight: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: ITEM_HEIGHT,
      borderRadius: 10,
      backgroundColor: colors.surface,
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
      color: colors.text,
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
