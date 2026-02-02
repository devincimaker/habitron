import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * This Edge Function runs daily (e.g., at 6 PM UTC) to schedule
 * daily reminder notifications for users who have the feature enabled
 * and haven't had a coaching session today.
 */

interface UserWithTimezone {
  user_id: string;
  timezone: string;
}

serve(async (req: Request) => {
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Get today's date boundaries for each timezone check
    const now = new Date();

    // Get all users with daily_reminder_enabled = true
    const { data: profiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('user_id')
      .eq('daily_reminder_enabled', true);

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      throw profilesError;
    }

    if (!profiles || profiles.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, scheduled: 0, message: 'No users with reminders enabled' }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    const userIds = profiles.map((p) => p.user_id);

    // Get timezones for these users from push_tokens
    const { data: tokens, error: tokensError } = await supabase
      .from('push_tokens')
      .select('user_id, timezone')
      .in('user_id', userIds);

    if (tokensError) {
      console.error('Error fetching tokens:', tokensError);
      throw tokensError;
    }

    // Create a map of user_id -> timezone (use first token's timezone if multiple)
    const userTimezones = new Map<string, string>();
    for (const token of tokens || []) {
      if (!userTimezones.has(token.user_id)) {
        userTimezones.set(token.user_id, token.timezone || 'America/New_York');
      }
    }

    // Filter to only users who have push tokens
    const usersWithTokens: UserWithTimezone[] = [];
    for (const userId of userIds) {
      const timezone = userTimezones.get(userId);
      if (timezone) {
        usersWithTokens.push({ user_id: userId, timezone });
      }
    }

    if (usersWithTokens.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, scheduled: 0, message: 'No users with push tokens' }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get today's coaching sessions for these users
    // We need to check per-user based on their timezone what "today" means
    const { data: todaySessions, error: sessionsError } = await supabase
      .from('coaching_sessions')
      .select('user_id, started_at')
      .in('user_id', usersWithTokens.map((u) => u.user_id))
      .gte('started_at', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString());

    if (sessionsError) {
      console.error('Error fetching sessions:', sessionsError);
      throw sessionsError;
    }

    // Build a set of users who had a session today (in their timezone)
    const usersWithSessionToday = new Set<string>();
    for (const session of todaySessions || []) {
      const userTz = userTimezones.get(session.user_id) || 'America/New_York';
      const sessionDate = getDateInTimezone(new Date(session.started_at), userTz);
      const todayDate = getDateInTimezone(now, userTz);

      if (sessionDate === todayDate) {
        usersWithSessionToday.add(session.user_id);
      }
    }

    // Check for existing pending daily_reminder notifications for today to avoid duplicates
    const { data: existingNotifications, error: existingError } = await supabase
      .from('scheduled_notifications')
      .select('user_id')
      .eq('notification_type', 'daily_reminder')
      .eq('status', 'pending')
      .in('user_id', usersWithTokens.map((u) => u.user_id));

    if (existingError) {
      console.error('Error checking existing notifications:', existingError);
      throw existingError;
    }

    const usersWithPendingReminder = new Set(
      (existingNotifications || []).map((n) => n.user_id)
    );

    let scheduledCount = 0;
    const notificationsToInsert: Array<{
      user_id: string;
      notification_type: string;
      scheduled_for: string;
      payload: object;
    }> = [];

    for (const user of usersWithTokens) {
      // Skip if user already had a session today
      if (usersWithSessionToday.has(user.user_id)) {
        continue;
      }

      // Skip if user already has a pending reminder
      if (usersWithPendingReminder.has(user.user_id)) {
        continue;
      }

      // Calculate 8 PM in user's timezone for today
      const scheduledFor = get8PMToday(user.timezone, now);

      // Only schedule if 8 PM hasn't passed yet
      if (scheduledFor > now) {
        notificationsToInsert.push({
          user_id: user.user_id,
          notification_type: 'daily_reminder',
          scheduled_for: scheduledFor.toISOString(),
          payload: {
            title: 'Time for reflection',
            body: "How did today go? Let's chat about it.",
            data: { action: 'start_coaching' },
          },
        });
        scheduledCount++;
      }
    }

    // Batch insert notifications
    if (notificationsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('scheduled_notifications')
        .insert(notificationsToInsert);

      if (insertError) {
        console.error('Error inserting notifications:', insertError);
        throw insertError;
      }
    }

    return new Response(
      JSON.stringify({
        processed: usersWithTokens.length,
        scheduled: scheduledCount,
        skippedWithSession: usersWithSessionToday.size,
        skippedWithPending: usersWithPendingReminder.size,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in schedule-daily-reminders:', error);
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
 * Get the date string (YYYY-MM-DD) for a given timestamp in a timezone.
 */
function getDateInTimezone(date: Date, timezone: string): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

/**
 * Calculate 8 PM today in the given timezone.
 */
function get8PMToday(timezone: string, now: Date): Date {
  // Get today's date in the target timezone
  const todayStr = getDateInTimezone(now, timezone);

  // Create target time string: today at 8 PM
  const targetStr = `${todayStr}T20:00:00`;

  // Get the UTC offset for the target timezone at this time
  const offsetFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    timeZoneName: 'shortOffset',
  });

  const tempDate = new Date(targetStr);
  const parts = offsetFormatter.formatToParts(tempDate);
  const offsetPart = parts.find((p) => p.type === 'timeZoneName');
  const offsetStr = offsetPart?.value || 'GMT';

  // Parse offset like "GMT-5" or "GMT+2" or "GMT+5:30"
  const offsetMatch = offsetStr.match(/GMT([+-]?)(\d+)?(?::(\d+))?/);
  let offsetMinutes = 0;
  if (offsetMatch) {
    const sign = offsetMatch[1] === '-' ? -1 : 1;
    const hours = parseInt(offsetMatch[2] || '0', 10);
    const minutes = parseInt(offsetMatch[3] || '0', 10);
    offsetMinutes = sign * (hours * 60 + minutes);
  }

  // Calculate UTC time: local time - offset = UTC
  const utcDate = new Date(targetStr);
  utcDate.setMinutes(utcDate.getMinutes() - offsetMinutes);

  return utcDate;
}
