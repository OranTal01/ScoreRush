CREATE TABLE IF NOT EXISTS public.push_subscriptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
 endpoint text NOT NULL UNIQUE, p256dh text NOT NULL, auth text NOT NULL, preferences jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS push_user_endpoint ON public.push_subscriptions(user_id,endpoint);
CREATE TABLE IF NOT EXISTS public.tournament_digests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
 day text NOT NULL, baseline jsonb, standings jsonb, body text, ready_at timestamptz, published_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS digest_tournament_day ON public.tournament_digests(tournament_id,day);
CREATE TABLE IF NOT EXISTS public.push_deliveries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), subscription_id uuid NOT NULL REFERENCES public.push_subscriptions(id) ON DELETE CASCADE,
 event_key text NOT NULL, status text NOT NULL DEFAULT 'sending', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS push_delivery_once ON public.push_deliveries(subscription_id,event_key);
CREATE TABLE IF NOT EXISTS public.notification_runtime (
 id text PRIMARY KEY, enabled boolean NOT NULL DEFAULT false, enabled_at timestamptz NOT NULL DEFAULT now(), last_run_at timestamptz
);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_digests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_runtime ENABLE ROW LEVEL SECURITY;
-- Access is through authenticated server routes with explicit ownership/membership
-- checks; endpoints and encryption keys are never exposed through the public API.
REVOKE ALL ON public.push_subscriptions, public.tournament_digests, public.push_deliveries, public.notification_runtime FROM anon, authenticated;
INSERT INTO public.notification_runtime(id) VALUES ('push') ON CONFLICT DO NOTHING;
