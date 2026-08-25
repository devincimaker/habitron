/* eslint-disable max-lines -- HAB-89: split pending */
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Button, BodyMedium, Caption, DisplayMedium } from '../../components/ui';
import {
  BORDER_RADIUS,
  SHADOWS,
  SPACING,
  type Colors,
} from '../../constants/theme';
import { useThemedStyles } from '../../hooks/useColors';

type SlideId = 'tasks' | 'calendar' | 'habits' | 'journal' | 'coach';
type PreviewComponent = (props: { colors: Colors }) => ReactNode;

interface TourSlide {
  id: SlideId;
  title: string;
  description: string;
  halo: [string, string];
  Preview: PreviewComponent;
}

const TOUR_SLIDES: TourSlide[] = [
  {
    id: 'tasks',
    title: 'Tasks',
    description: 'Capture what matters.',
    halo: ['#FCE7BF', '#FFF8EC'],
    Preview: TasksPreview,
  },
  {
    id: 'calendar',
    title: 'Calendar',
    description: 'See your week and place things where they fit.',
    halo: ['#DDF1FF', '#F5FBFF'],
    Preview: CalendarPreview,
  },
  {
    id: 'habits',
    title: 'Habits',
    description: 'Build momentum with small routines.',
    halo: ['#DDF4E8', '#F5FCF8'],
    Preview: HabitsPreview,
  },
  {
    id: 'journal',
    title: 'Journal',
    description: 'Notice patterns by writing a little.',
    halo: ['#F7E4EA', '#FFF8FA'],
    Preview: JournalPreview,
  },
  {
    id: 'coach',
    title: 'Thrive Coach',
    description: 'Thrive Coach ties it together and helps you move forward.',
    halo: ['#FBE2D2', '#FFF7F1'],
    Preview: CoachPreview,
  },
];

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const TOTAL_SLIDES = TOUR_SLIDES.length;

export default function TourOnboardingScreen() {
  const [styles, colors] = useThemedStyles(createStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<TourSlide>>(null);
  const { width, height } = useWindowDimensions();
  const [currentIndex, setCurrentIndex] = useState(0);

  const slideWidth = width;
  const phoneWidth = useMemo(() => {
    const widthBound = width * 0.61;
    const reservedVerticalSpace = insets.top + insets.bottom + 292;
    const previewHeightBudget = height - reservedVerticalSpace;
    const heightBound = (previewHeightBudget - 32) / 1.92;

    return Math.round(Math.max(216, Math.min(236, widthBound, heightBound)));
  }, [height, insets.bottom, insets.top, width]);
  const phoneHeight = Math.round(phoneWidth * 1.92);
  const isLastSlide = currentIndex === TOTAL_SLIDES - 1;

  const finishTour = useCallback(() => {
    router.replace('/(onboarding)/name');
  }, [router]);

  const goToSlide = useCallback((index: number) => {
    listRef.current?.scrollToIndex({ index, animated: true });
    setCurrentIndex(index);
  }, []);

  const handleNext = useCallback(() => {
    if (isLastSlide) {
      finishTour();
      return;
    }

    goToSlide(currentIndex + 1);
  }, [currentIndex, finishTour, goToSlide, isLastSlide]);

  const handleMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const nextIndex = Math.round(event.nativeEvent.contentOffset.x / slideWidth);
      const boundedIndex = Math.max(0, Math.min(TOTAL_SLIDES - 1, nextIndex));
      if (boundedIndex !== currentIndex) {
        setCurrentIndex(boundedIndex);
      }
    },
    [currentIndex, slideWidth]
  );

  const renderItem = useCallback(
    ({ item }: { item: TourSlide }) => (
      <View style={[styles.slide, { width: slideWidth }]}>
        <View style={styles.slideHeader}>
          <DisplayMedium style={styles.slideTitle}>{item.title}</DisplayMedium>
          <BodyMedium style={styles.slideDescription}>{item.description}</BodyMedium>
        </View>

        <PhonePreview
          colors={colors}
          slide={item}
          width={phoneWidth}
          height={phoneHeight}
        />
      </View>
    ),
    [colors, phoneHeight, phoneWidth, slideWidth, styles]
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#FFFDF9', colors.background]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top + SPACING.sm,
            paddingBottom: insets.bottom + SPACING.md,
          },
        ]}
      >
        <View style={styles.topRow}>
          <Caption style={styles.counter}>
            {currentIndex + 1} of {TOTAL_SLIDES}
          </Caption>

          <Pressable
            hitSlop={12}
            onPress={finishTour}
            accessibilityRole="button"
            accessibilityLabel="Skip onboarding tour"
          >
            <BodyMedium style={styles.skipLabel}>Skip</BodyMedium>
          </Pressable>
        </View>

        <FlatList
          ref={listRef}
          data={TOUR_SLIDES}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          horizontal
          pagingEnabled
          bounces={false}
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleMomentumEnd}
          getItemLayout={(_data, index) => ({
            length: slideWidth,
            offset: slideWidth * index,
            index,
          })}
          onScrollToIndexFailed={(info) => {
            listRef.current?.scrollToOffset({
              offset: info.index * slideWidth,
              animated: true,
            });
          }}
          style={styles.carousel}
        />

        <View style={styles.footer}>
          <View style={styles.pagination}>
            {TOUR_SLIDES.map((slide, index) => (
              <View
                key={slide.id}
                style={[
                  styles.dot,
                  index === currentIndex ? styles.dotActive : null,
                ]}
              />
            ))}
          </View>

          <Button
            title={isLastSlide ? 'Continue' : 'Next'}
            onPress={handleNext}
            size="lg"
            fullWidth
          />
        </View>
      </View>
    </View>
  );
}

function PhonePreview({
  colors,
  slide,
  width,
  height,
}: {
  colors: Colors;
  slide: TourSlide;
  width: number;
  height: number;
}) {
  const Preview = slide.Preview;

  return (
    <View style={stylesStatic.previewFrame}>
      <LinearGradient
        colors={slide.halo}
        style={[
          stylesStatic.halo,
          {
            width: width + 32,
            height: height + 32,
            borderRadius: 38,
          },
        ]}
      >
        <View
          style={[
            stylesStatic.deviceFrame,
            {
              width,
              height,
            },
          ]}
        >
          <View style={stylesStatic.notch} />
          <View style={[stylesStatic.deviceScreen, { backgroundColor: colors.white }]}>
            <Preview colors={colors} />
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

function PreviewHeader({
  colors,
  label,
  trailing,
}: {
  colors: Colors;
  label: string;
  trailing: ReactNode;
}) {
  return (
    <View style={stylesStatic.previewTopRow}>
      <Text style={[stylesStatic.previewMeta, { color: colors.textLight }]}>{label}</Text>
      {trailing}
    </View>
  );
}

function TasksPreview({ colors }: { colors: Colors }) {
  return (
    <View style={stylesStatic.screenContent}>
      <PreviewHeader
        colors={colors}
        label="Today"
        trailing={(
          <View style={[stylesStatic.liveBadge, { backgroundColor: '#FFF1DA' }]}>
            <Text style={[stylesStatic.liveBadgeText, { color: colors.primaryDark }]}>Live</Text>
          </View>
        )}
      />

      <View style={[stylesStatic.searchBar, { backgroundColor: '#F4F4F6' }]}>
        <Ionicons name="search" size={15} color={colors.textLight} />
        <Text style={[stylesStatic.searchText, { color: colors.textLight }]}>
          Catch anything you need to do
        </Text>
      </View>

      <PreviewInfoCard
        colors={colors}
        icon={<Text style={[stylesStatic.taskPrompt, { color: colors.primaryDark }]}>?</Text>}
        title="Plan launch checklist"
        subtitle="Today"
        titleLines={2}
      />
      <PreviewInfoCard
        colors={colors}
        icon={<Ionicons name="ellipse-outline" size={18} color={colors.primaryDark} />}
        title="Book dentist appointment"
        subtitle="Tomorrow"
        titleLines={2}
      />
      <PreviewInfoCard
        colors={colors}
        icon={<Ionicons name="checkmark-circle" size={18} color={colors.primaryDark} />}
        title="Call Sofia about trip"
        subtitle="This week"
        titleLines={2}
      />
    </View>
  );
}

function CalendarPreview({ colors }: { colors: Colors }) {
  return (
    <View style={stylesStatic.screenContent}>
      <PreviewHeader
        colors={colors}
        label="This week"
        trailing={<Ionicons name="calendar-outline" size={16} color={colors.primaryDark} />}
      />

      <View style={stylesStatic.weekdayRow}>
        {WEEKDAY_LABELS.map((label, index) => {
          const isSelected = index === 2;
          return (
            <View
              key={`${label}-${index}`}
              style={[
                stylesStatic.dayChip,
                {
                  backgroundColor: isSelected ? colors.primary : '#F4F4F6',
                },
              ]}
            >
              <Text
                style={[
                  stylesStatic.dayChipLabel,
                  { color: isSelected ? colors.white : colors.textSecondary },
                ]}
              >
                {label}
              </Text>
              <Text
                style={[
                  stylesStatic.dayChipValue,
                  { color: isSelected ? colors.white : colors.text },
                ]}
              >
                {index + 8}
              </Text>
            </View>
          );
        })}
      </View>

      <ScheduleBlock
        colors={colors}
        time="9:00"
        title="Deep work block"
        accent="#FFE3B0"
      />
      <ScheduleBlock
        colors={colors}
        time="12:30"
        title="Lunch with Ana"
        accent="#DDF1FF"
      />
      <ScheduleBlock
        colors={colors}
        time="18:00"
        title="Review goals"
        accent="#F7E4EA"
      />
    </View>
  );
}

function HabitsPreview({ colors }: { colors: Colors }) {
  return (
    <View style={stylesStatic.screenContent}>
      <PreviewHeader
        colors={colors}
        label="Today"
        trailing={(
          <View style={[stylesStatic.streakPill, { backgroundColor: '#FFF1DA' }]}>
            <Ionicons name="flame" size={12} color={colors.primaryDark} />
            <Text style={[stylesStatic.streakPillText, { color: colors.primaryDark }]}>4 day streak</Text>
          </View>
        )}
      />

      <View style={[stylesStatic.summaryCard, { backgroundColor: '#FFF8EC', borderColor: '#F8D9A6' }]}>
        <Text style={[stylesStatic.summaryLabel, { color: colors.textSecondary }]}>Today's focus</Text>
        <Text style={[stylesStatic.summaryValue, { color: colors.text }]}>Move your body</Text>
      </View>

      <PreviewInfoCard
        colors={colors}
        icon={<Ionicons name="checkmark-circle" size={18} color={colors.primaryDark} />}
        title="Morning walk"
        subtitle="10 minutes"
      />
      <PreviewInfoCard
        colors={colors}
        icon={<Ionicons name="ellipse-outline" size={18} color={colors.primaryDark} />}
        title="Read before bed"
        subtitle="1 chapter"
      />
      <PreviewInfoCard
        colors={colors}
        icon={<Ionicons name="ellipse-outline" size={18} color={colors.primaryDark} />}
        title="Stretch after work"
        subtitle="5 minutes"
      />
    </View>
  );
}

function JournalPreview({ colors }: { colors: Colors }) {
  return (
    <View style={stylesStatic.screenContent}>
      <PreviewHeader
        colors={colors}
        label="Reflect"
        trailing={<Ionicons name="book-outline" size={16} color={colors.primaryDark} />}
      />

      <View style={stylesStatic.moodRow}>
        {['🙂', '😌', '😮‍💨'].map((mood, index) => (
          <View
            key={`${mood}-${index}`}
            style={[
              stylesStatic.moodChip,
              {
                backgroundColor: index === 1 ? '#FFF1DA' : '#F6F6F8',
                borderColor: index === 1 ? '#F5C66A' : '#ECECEE',
              },
            ]}
          >
            <Text style={stylesStatic.moodEmoji}>{mood}</Text>
          </View>
        ))}
      </View>

      <JournalCard
        colors={colors}
        title="A small win"
        lines={['I stayed calmer in the meeting.', 'That felt new and good.']}
      />
      <JournalCard
        colors={colors}
        title="What I want next"
        lines={['More structure in the morning.', 'Less friction starting work.']}
      />
    </View>
  );
}

function CoachPreview({ colors }: { colors: Colors }) {
  return (
    <View style={stylesStatic.screenContent}>
      <PreviewHeader
        colors={colors}
        label="Coach"
        trailing={<Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.primaryDark} />}
      />

      <View style={[stylesStatic.chatBubble, stylesStatic.chatBubbleCoach, { backgroundColor: '#FFF4E2' }]}>
        <Text style={[stylesStatic.chatText, { color: colors.text }]}>
          Tell me more about where you are and where you want to go.
        </Text>
      </View>

      <View style={[stylesStatic.chatBubble, stylesStatic.chatBubbleUser, { backgroundColor: '#F6F6F8' }]}>
        <Text style={[stylesStatic.chatText, { color: colors.textSecondary }]}>
          I want calmer mornings and more consistency.
        </Text>
      </View>

      <View style={[stylesStatic.coachCard, { backgroundColor: '#FFF8EC', borderColor: '#F5C66A' }]}>
        <Text style={[stylesStatic.summaryLabel, { color: colors.textSecondary }]}>Coach suggestion</Text>
        <Text style={[stylesStatic.coachCardTitle, { color: colors.text }]}>
          Start with one simple morning habit
        </Text>
        <View style={stylesStatic.coachMetaRow}>
          <View style={[stylesStatic.coachMetaPill, { backgroundColor: colors.white }]}>
            <Text style={[stylesStatic.coachMetaText, { color: colors.primaryDark }]}>Habit</Text>
          </View>
          <View style={[stylesStatic.coachMetaPill, { backgroundColor: colors.white }]}>
            <Text style={[stylesStatic.coachMetaText, { color: colors.primaryDark }]}>Low effort</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function PreviewInfoCard({
  colors,
  icon,
  title,
  subtitle,
  titleLines = 1,
}: {
  colors: Colors;
  icon: ReactNode;
  title: string;
  subtitle: string;
  titleLines?: number;
}) {
  return (
    <View style={[stylesStatic.itemCard, { borderColor: '#E6E6E8' }]}>
      <View style={stylesStatic.itemIcon}>{icon}</View>
      <View style={stylesStatic.itemCopy}>
        <Text style={[stylesStatic.itemTitle, { color: colors.text }]} numberOfLines={titleLines}>
          {title}
        </Text>
        <Text style={[stylesStatic.itemSubtitle, { color: colors.textLight }]}>{subtitle}</Text>
      </View>
    </View>
  );
}

function ScheduleBlock({
  colors,
  time,
  title,
  accent,
}: {
  colors: Colors;
  time: string;
  title: string;
  accent: string;
}) {
  return (
    <View style={[stylesStatic.scheduleBlock, { borderColor: '#E8E8EA' }]}>
      <Text style={[stylesStatic.scheduleTime, { color: colors.textLight }]}>{time}</Text>
      <View style={[stylesStatic.scheduleAccent, { backgroundColor: accent }]} />
      <Text style={[stylesStatic.scheduleTitle, { color: colors.text }]} numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}

function JournalCard({
  colors,
  title,
  lines,
}: {
  colors: Colors;
  title: string;
  lines: string[];
}) {
  return (
    <View style={[stylesStatic.journalCard, { borderColor: '#ECECEE', backgroundColor: '#FBFBFC' }]}>
      <Text style={[stylesStatic.journalTitle, { color: colors.text }]}>{title}</Text>
      {lines.map((line, index) => (
        <Text
          key={`${title}-${index}`}
          style={[stylesStatic.journalLine, { color: colors.textSecondary }]}
          numberOfLines={1}
        >
          {line}
        </Text>
      ))}
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      flex: 1,
    },
    topRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: SPACING.xl,
      marginBottom: SPACING.md,
    },
    counter: {
      color: colors.textLight,
      fontSize: 14,
    },
    skipLabel: {
      color: colors.textSecondary,
      fontWeight: '600',
    },
    carousel: {
      flex: 1,
    },
    slide: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'flex-start',
      paddingHorizontal: SPACING.xl,
      paddingTop: SPACING.sm,
      paddingBottom: SPACING.lg,
    },
    slideHeader: {
      width: '100%',
      maxWidth: 320,
      alignItems: 'center',
      marginBottom: SPACING.lg,
    },
    slideTitle: {
      textAlign: 'center',
      marginBottom: SPACING.xs,
    },
    slideDescription: {
      textAlign: 'center',
      color: colors.textSecondary,
      fontSize: 15,
      lineHeight: 22,
    },
    footer: {
      paddingHorizontal: SPACING.xl,
      paddingTop: SPACING.sm,
    },
    pagination: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginBottom: SPACING.md,
    },
    dot: {
      width: 10,
      height: 10,
      borderRadius: BORDER_RADIUS.full,
      backgroundColor: '#DADADF',
      marginHorizontal: 4,
    },
    dotActive: {
      width: 32,
      backgroundColor: colors.primary,
    },
  });

const stylesStatic = StyleSheet.create({
  previewFrame: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  halo: {
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.medium,
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 8,
  },
  deviceFrame: {
    backgroundColor: '#141414',
    borderRadius: 34,
    paddingHorizontal: 10,
    paddingTop: 12,
    paddingBottom: 10,
  },
  notch: {
    position: 'absolute',
    top: 8,
    alignSelf: 'center',
    width: 118,
    height: 24,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    backgroundColor: '#141414',
    zIndex: 2,
  },
  deviceScreen: {
    flex: 1,
    borderRadius: 24,
    overflow: 'hidden',
  },
  screenContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 28,
    paddingBottom: 16,
  },
  previewTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  previewMeta: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  liveBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  liveBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  searchText: {
    fontSize: 12,
    marginLeft: 8,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10,
    backgroundColor: '#FFFFFF',
  },
  itemIcon: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  itemCopy: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '600',
  },
  itemSubtitle: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  taskPrompt: {
    fontSize: 18,
    lineHeight: 18,
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  dayChip: {
    width: 34,
    borderRadius: 16,
    paddingVertical: 7,
    alignItems: 'center',
  },
  dayChipLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 3,
  },
  dayChipValue: {
    fontSize: 12,
    fontWeight: '700',
  },
  scheduleBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10,
    backgroundColor: '#FFFFFF',
  },
  scheduleTime: {
    width: 40,
    fontSize: 11,
    fontWeight: '600',
  },
  scheduleAccent: {
    width: 7,
    height: 34,
    borderRadius: 999,
    marginRight: 10,
  },
  scheduleTitle: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '600',
  },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  streakPillText: {
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 4,
  },
  summaryCard: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  summaryValue: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  moodRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  moodChip: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  moodEmoji: {
    fontSize: 17,
  },
  journalCard: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  journalTitle: {
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  journalLine: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  chatBubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    maxWidth: '92%',
  },
  chatBubbleCoach: {
    alignSelf: 'flex-start',
    borderTopLeftRadius: 8,
  },
  chatBubbleUser: {
    alignSelf: 'flex-end',
    borderTopRightRadius: 8,
  },
  chatText: {
    fontSize: 12,
    lineHeight: 17,
  },
  coachCard: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginTop: 2,
  },
  coachCardTitle: {
    fontSize: 13.5,
    lineHeight: 18,
    fontWeight: '700',
    marginBottom: 10,
  },
  coachMetaRow: {
    flexDirection: 'row',
  },
  coachMetaPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
  },
  coachMetaText: {
    fontSize: 10,
    fontWeight: '700',
  },
});
