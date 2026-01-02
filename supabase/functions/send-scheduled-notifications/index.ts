import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

interface ScheduledNotification {
  id: string;
  user_id: string;
  payload: NotificationPayload;
}

interface PushToken {
  token: string;
}

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

    // Get pending notifications that are due
    const now = new Date().toISOString();
    const { data: notifications, error: fetchError } = await supabase
      .from('scheduled_notifications')
      .select('id, user_id, payload')
      .eq('status', 'pending')
      .lte('scheduled_for', now)
      .limit(100);

    if (fetchError) {
      console.error('Error fetching notifications:', fetchError);
      throw fetchError;
    }

    if (!notifications || notifications.length === 0) {
      return new Response(JSON.stringify({ processed: 0, message: 'No pending notifications' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const results: { id: string; success: boolean; error?: string }[] = [];

    for (const notification of notifications as ScheduledNotification[]) {
      // Get push tokens for this user
      const { data: tokens, error: tokensError } = await supabase
        .from('push_tokens')
        .select('token')
        .eq('user_id', notification.user_id);

      if (tokensError || !tokens || tokens.length === 0) {
        // No tokens found, mark as failed
        await supabase
          .from('scheduled_notifications')
          .update({
            status: 'failed',
            sent_at: new Date().toISOString(),
          })
          .eq('id', notification.id);

        results.push({
          id: notification.id,
          success: false,
          error: 'No push tokens found',
        });
        continue;
      }

      // Prepare Expo push messages
      const messages = (tokens as PushToken[]).map((t) => ({
        to: t.token,
        title: notification.payload.title,
        body: notification.payload.body,
        data: notification.payload.data,
        sound: 'default' as const,
      }));

      // Send to Expo Push API
      const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (expoAccessToken) {
        headers['Authorization'] = `Bearer ${expoAccessToken}`;
      }

      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(messages),
      });

      const result = await response.json();
      const success = response.ok;

      // Update notification status
      await supabase
        .from('scheduled_notifications')
        .update({
          status: success ? 'sent' : 'failed',
          sent_at: new Date().toISOString(),
        })
        .eq('id', notification.id);

      results.push({
        id: notification.id,
        success,
        error: success ? undefined : JSON.stringify(result),
      });
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    return new Response(
      JSON.stringify({
        processed: results.length,
        success: successCount,
        failed: failCount,
        results,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in send-scheduled-notifications:', error);
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
