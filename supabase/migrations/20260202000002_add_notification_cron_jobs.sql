-- Enable required extensions
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Store the edge function base URL and service role key in vault
-- Note: You must manually insert the service role key after running this migration:
-- SELECT vault.create_secret('your-service-role-key', 'supabase_service_role_key');

-- Create a helper function to call edge functions
create or replace function public.invoke_edge_function(function_name text)
returns void
language plpgsql
security definer
as $$
declare
  service_key text;
  base_url text := 'https://wxszqhuhkeuspizwaarc.supabase.co/functions/v1/';
begin
  -- Get the service role key from vault
  select decrypted_secret into service_key
  from vault.decrypted_secrets
  where name = 'supabase_service_role_key'
  limit 1;

  if service_key is null then
    raise warning 'Service role key not found in vault. Please run: SELECT vault.create_secret(''your-key'', ''supabase_service_role_key'');';
    return;
  end if;

  -- Make the HTTP POST request to the edge function
  perform net.http_post(
    url := base_url || function_name,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := '{}'::jsonb
  );
end;
$$;

-- Schedule: Run every 5 minutes to send pending notifications
select cron.schedule(
  'send-scheduled-notifications',
  '*/5 * * * *',
  $$select public.invoke_edge_function('send-scheduled-notifications')$$
);

-- Schedule: Run daily at 6 AM UTC to schedule daily reminders
-- This gives time to schedule 8 PM reminders for all timezones
select cron.schedule(
  'schedule-daily-reminders',
  '0 6 * * *',
  $$select public.invoke_edge_function('schedule-daily-reminders')$$
);

-- Schedule: Run daily at 11 PM UTC to check for pending/skipped habits
-- This catches end-of-day for US timezones
select cron.schedule(
  'check-pending-habits',
  '0 23 * * *',
  $$select public.invoke_edge_function('check-pending-habits')$$
);

-- Grant execute permission on the helper function
grant execute on function public.invoke_edge_function(text) to service_role;

-- Add a comment explaining the setup
comment on function public.invoke_edge_function(text) is
'Helper function to invoke Supabase Edge Functions via pg_net.
Requires service role key stored in vault with name "supabase_service_role_key".
Run: SELECT vault.create_secret(''your-service-role-key'', ''supabase_service_role_key'');';
