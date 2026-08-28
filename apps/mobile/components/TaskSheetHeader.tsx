import { forwardRef } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Priority } from '@habits-coach/shared';
import { HeaderIconButton } from './HeaderIconButton';
import { getTodoPriorityOption } from '../utils/todoPriority';
import { HEADER, TOUCH_TARGET, type Colors } from '../constants/theme';
import { useThemedStyles } from '../hooks/useColors';

interface TaskSheetHeaderProps {
  priority?: Priority;
  onPressPriority: () => void;
  onPressDelete: () => void;
}

/** The sheet's only two controls, kept to the top-right so the body reads first. */
export const TaskSheetHeader = forwardRef<View, TaskSheetHeaderProps>(function TaskSheetHeader(
  { priority, onPressPriority, onPressDelete },
  flagRef
) {
  const [styles] = useThemedStyles(createStyles);
  const priorityOption = getTodoPriorityOption(priority);

  return (
    <View style={styles.row}>
      <HeaderIconButton
        ref={flagRef}
        name={priorityOption ? 'flag' : 'flag-outline'}
        color={priorityOption?.color}
        accessibilityLabel={priorityOption ? `Priority: ${priorityOption.label}` : 'Set a priority'}
        onPress={onPressPriority}
      />

      <HeaderIconButton
        name="trash-outline"
        accessibilityLabel="Delete task"
        onPress={onPressDelete}
      />
    </View>
  );
});

const createStyles = (_colors: Colors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: HEADER.controlGap,
      height: TOUCH_TARGET.min,
    },
  });
