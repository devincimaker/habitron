import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type HabitRow = {
  id: string;
  user_id: string;
  name: string;
  frequency: 'daily' | 'weekly';
  weekly_days: string[] | null;
  created_at: string;
};

/**
 * This Edge Function runs daily (e.g., at 11 PM UTC) to check for users
 * who have habits that are still "pending" at the end of the day.
 * If this is their first-ever skip, it schedules a notification for the next morning.
 */

serve(async (req: Request) => {
  try {
    // Verify this is a POST request
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];

    // Find all users who have habits but no completed/skipped log entry for today
    // This query finds habits without a log entry for today
    const { data: habitsWithoutLogs, error: habitsError } = await supabase
      .from('habits')
      .select(`
        id,
        user_id,
        name,
        frequency,
        weekly_days,
        created_at
      `)
      .eq('active', true);

    if (habitsError) {
      console.error('Error fetching habits:', habitsError);
      throw habitsError;
    }

    if (!habitsWithoutLogs || habitsWithoutLogs.length === 0) {
      return new Response(JSON.stringify({ processed: 0, message: 'No habits found' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get today's logs to filter out habits that already have entries
    const { data: todayLogs, error: logsError } = await supabase
      .from('habit_logs')
      .select('habit_id')
      .eq('date', today);

    if (logsError) {
      console.error('Error fetching today logs:', logsError);
      throw logsError;
    }

    const loggedHabitIds = new Set((todayLogs || []).map((l) => l.habit_id));

    // Filter to habits without logs (pending habits)
    const pendingHabits = (habitsWithoutLogs as HabitRow[]).filter(
      (habit) =>
        !loggedHabitIds.has(habit.id) && isHabitDueOnDate(habit, today)
    );

    if (pendingHabits.length === 0) {
      return new Response(JSON.stringify({ processed: 0, message: 'No pending habits' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Group by user
    const habitsByUser = new Map<string, typeof pendingHabits>();
    for (const habit of pendingHabits) {
      if (!habitsByUser.has(habit.user_id)) {
        habitsByUser.set(habit.user_id, []);
      }
      habitsByUser.get(habit.user_id)!.push(habit);
    }

    let processedCount = 0;
    let scheduledCount = 0;

    for (const [userId, userPendingHabits] of habitsByUser) {
      processedCount++;

      // Check if user already received first-skip notification
      const { data: flags } = await supabase
        .from('user_notification_flags')
        .select('has_received_first_skip_notification')
        .eq('user_id', userId)
        .single();

      if (flags?.has_received_first_skip_notification) {
        // Already received, skip this user
        continue;
      }

      // Check if user has any previous skips
      const { count: previousSkips } = await supabase
        .from('habit_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'skipped');

      if (previousSkips && previousSkips > 0) {
        // Not their first skip, skip this user
        continue;
      }

      // This is their first skip! Mark the first pending habit as skipped
      const firstPendingHabit = userPendingHabits[0];

      // Insert a skipped log entry
      await supabase.from('habit_logs').insert({
        habit_id: firstPendingHabit.id,
        user_id: userId,
        date: today,
        status: 'skipped',
      });

      // Get user's timezone
      const { data: tokenData } = await supabase
        .from('push_tokens')
        .select('timezone')
        .eq('user_id', userId)
        .limit(1)
        .single();

      const timezone = tokenData?.timezone || 'America/New_York';

      // Calculate next 9 AM
      const scheduledFor = getNext9AM(timezone);

      // Schedule notification
      await supabase.from('scheduled_notifications').insert({
        user_id: userId,
        notification_type: 'first_skip',
        scheduled_for: scheduledFor.toISOString(),
        payload: {
          habitId: firstPendingHabit.id,
          habitName: firstPendingHabit.name,
          title: "Let's talk about yesterday",
          body: `You skipped "${firstPendingHabit.name}" for the first time. Want to chat with Habitron about it?`,
          data: { action: 'start_coaching' },
        },
      });

      // Mark as received
      await supabase.from('user_notification_flags').upsert(
        {
          user_id: userId,
          has_received_first_skip_notification: true,
          first_skip_notification_sent_at: scheduledFor.toISOString(),
        },
        { onConflict: 'user_id' }
      );

      scheduledCount++;
    }

    return new Response(
      JSON.stringify({
        processed: processedCount,
        scheduled: scheduledCount,
        pendingHabitsFound: pendingHabits.length,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in check-pending-habits:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});

/**
 * Calculate the next 9 AM in the given timezone.
 */
function getNext9AM(timezone: string): Date {
  const now = new Date();

  // Get tomorrow's date
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Format as YYYY-MM-DD in the target timezone
  const dateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const tomorrowStr = dateFormatter.format(tomorrow);

  // Create target time string
  const targetStr = `${tomorrowStr}T09:00:00`;

  // Get the offset for the target timezone
  const offsetFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    timeZoneName: 'shortOffset',
  });

  const parts = offsetFormatter.formatToParts(new Date(targetStr));
  const offsetPart = parts.find((p) => p.type === 'timeZoneName');
  const offsetStr = offsetPart?.value || 'GMT';

  // Parse offset like "GMT-5" or "GMT+2"
  const offsetMatch = offsetStr.match(/GMT([+-]?)(\d+)?/);
  let offsetHours = 0;
  if (offsetMatch) {
    const sign = offsetMatch[1] === '-' ? -1 : 1;
    offsetHours = sign * (parseInt(offsetMatch[2] || '0', 10));
  }

  // Calculate UTC time
  const utcDate = new Date(targetStr);
  utcDate.setHours(utcDate.getHours() - offsetHours);

  return utcDate;
}

function isHabitDueOnDate(habit: HabitRow, date: string): boolean {
  const createdAtDate = new Date(habit.created_at);
  createdAtDate.setHours(0, 0, 0, 0);

  const targetDate = new Date(date + 'T00:00:00');
  targetDate.setHours(0, 0, 0, 0);

  if (createdAtDate > targetDate) {
    return false;
  }

  if (habit.frequency === 'daily') {
    if (!habit.weekly_days || habit.weekly_days.length === 0) {
      return true;
    }

    const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][
      targetDate.getDay()
    ];

    return habit.weekly_days.includes(weekday);
  }

  return true;
}
