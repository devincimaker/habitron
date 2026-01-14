import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config.js';

// Default Supabase client - can be overridden for testing
let supabase: SupabaseClient = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey
);

/**
 * Set a custom Supabase client (for testing).
 */
export function setSupabaseClient(client: SupabaseClient): void {
  supabase = client;
}

/**
 * Get the current Supabase client.
 */
export function getSupabaseClient(): SupabaseClient {
  return supabase;
}

/**
 * Schedule a first-skip notification for a user.
 * This checks if the user has already received a first-skip notification,
 * and if not, schedules one for 9 AM the next morning in their timezone.
 */
export async function scheduleFirstSkipNotification(
  userId: string,
  habitId: string
): Promise<{ scheduled: boolean; reason?: string }> {
  // Check if user already received first-skip notification
  const { data: flags } = await supabase
    .from('user_notification_flags')
    .select('has_received_first_skip_notification')
    .eq('user_id', userId)
    .single();

  if (flags?.has_received_first_skip_notification) {
    return { scheduled: false, reason: 'already_received' };
  }

  // Check if this is truly the first skip ever for this user
  const { count, error: countError } = await supabase
    .from('habit_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'skipped');

  if (countError) {
    console.error('Error counting skipped habits:', countError);
    return { scheduled: false, reason: 'db_error' };
  }

  // If this is the first skip (count should be 1 since we just inserted)
  if (!count || count > 1) {
    return { scheduled: false, reason: 'not_first_skip' };
  }

  // Get user's timezone from push_tokens
  const { data: tokenData } = await supabase
    .from('push_tokens')
    .select('timezone')
    .eq('user_id', userId)
    .limit(1)
    .single();

  const timezone = tokenData?.timezone || 'America/New_York';

  // Calculate next 9 AM in user's timezone
  const scheduledFor = getNext9AM(timezone);

  // Get habit name for the notification
  const { data: habit } = await supabase
    .from('habits')
    .select('name')
    .eq('id', habitId)
    .single();

  const habitName = habit?.name || 'a habit';

  // Insert scheduled notification
  const { error: insertError } = await supabase
    .from('scheduled_notifications')
    .insert({
      user_id: userId,
      notification_type: 'first_skip',
      scheduled_for: scheduledFor.toISOString(),
      payload: {
        habitId,
        habitName,
        title: "Let's talk about yesterday",
        body: `You skipped "${habitName}" for the first time. Want to chat with Habitron about it?`,
        data: { action: 'start_coaching' },
      },
    });

  if (insertError) {
    console.error('Error inserting scheduled notification:', insertError);
    return { scheduled: false, reason: 'insert_error' };
  }

  // Mark user as having a pending first-skip notification
  const { error: upsertError } = await supabase
    .from('user_notification_flags')
    .upsert(
      {
        user_id: userId,
        has_received_first_skip_notification: true,
        first_skip_notification_sent_at: scheduledFor.toISOString(),
      },
      { onConflict: 'user_id' }
    );

  if (upsertError) {
    console.error('Error updating notification flags:', upsertError);
    // Don't fail - the notification is scheduled
  }

  return { scheduled: true };
}

/**
 * Calculate the next 9 AM in the given timezone.
 * Returns tomorrow at 9 AM in the user's timezone.
 * Exported for testing.
 */
export function getNext9AM(timezone: string): Date {
  const now = new Date();

  // Create a date formatter to get the current date in the user's timezone
  const dateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  // Get tomorrow's date in user's timezone
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const tomorrowStr = dateFormatter.format(tomorrow);

  // Create the target time: tomorrow at 9 AM in user's timezone
  const targetStr = `${tomorrowStr}T09:00:00`;

  // Get the offset for the target timezone at the target time
  const targetDate = new Date(targetStr);

  // Use Intl to get the proper offset
  const offsetFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    timeZoneName: 'shortOffset',
  });

  const parts = offsetFormatter.formatToParts(targetDate);
  const offsetPart = parts.find((p) => p.type === 'timeZoneName');
  const offsetStr = offsetPart?.value || 'GMT';

  // Parse offset like "GMT-5" or "GMT+2"
  const offsetMatch = offsetStr.match(/GMT([+-]?)(\d+)?/);
  let offsetHours = 0;
  if (offsetMatch) {
    const sign = offsetMatch[1] === '-' ? -1 : 1;
    offsetHours = sign * (parseInt(offsetMatch[2] || '0', 10));
  }

  // Calculate UTC time for 9 AM in user's timezone
  const utcDate = new Date(targetStr);
  utcDate.setHours(utcDate.getHours() - offsetHours);

  return utcDate;
}
