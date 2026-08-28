import { requireNativeModule } from 'expo-modules-core';
import type { HabitWeekday } from '@habits-coach/shared';

/** One routine start time. A routine with two times is two alarms. */
export interface RoutineAlarm {
  /** Stable per section + time, so re-planning re-schedules rather than duplicates. */
  id: string;
  sectionId: string;
  /** "Morning · Meditate first", or just the routine name when nothing is due. */
  title: string;
  hour: number;
  minute: number;
  weekdays: HabitWeekday[];
}

type RoutineAlarmAuthorization = 'authorized' | 'denied';

interface RoutineAlarmsNativeModule {
  /** False below iOS 26, where AlarmKit does not exist. */
  isAvailable: boolean;
  requestAuthorization(): Promise<RoutineAlarmAuthorization>;
  /** Makes the scheduled set match `alarms` exactly. */
  replaceAll(alarms: RoutineAlarm[]): Promise<void>;
}

export default requireNativeModule<RoutineAlarmsNativeModule>('RoutineAlarms');
