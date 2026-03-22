-- Web Push subscriptions (VAPID / browser push)
create table if not exists web_push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  endpoint    text not null,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz default now(),
  unique(user_id, endpoint)
);

alter table web_push_subscriptions enable row level security;

-- Users can manage their own subscriptions
create policy "users manage own web push subs"
  on web_push_subscriptions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Service role can read all (for sending)
create policy "service role reads all web push subs"
  on web_push_subscriptions
  for select
  using (auth.role() = 'service_role');
