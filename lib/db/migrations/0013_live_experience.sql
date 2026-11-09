ALTER TABLE public.matches ADD COLUMN live_details jsonb;
CREATE TABLE public.live_runtime (
 provider text PRIMARY KEY, access text NOT NULL DEFAULT 'delayed' CHECK(access IN ('delayed','scores','events')),
 enabled_at timestamptz NOT NULL DEFAULT now(), last_poll_at timestamptz, polling_until timestamptz, last_error text
);
INSERT INTO public.live_runtime(provider) VALUES ('football_data_org');
CREATE TABLE public.live_match_state (
 match_id uuid PRIMARY KEY REFERENCES public.matches(id) ON DELETE CASCADE,
 revision integer NOT NULL DEFAULT 0, observation jsonb NOT NULL
);
CREATE TABLE public.live_match_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
 match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE, event_key text NOT NULL,
 change jsonb NOT NULL, description text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX live_match_event_once ON public.live_match_events(match_id,event_key);
CREATE INDEX live_match_events_recent ON public.live_match_events(tournament_id,created_at DESC);
ALTER TABLE public.live_runtime ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_match_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_match_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.live_runtime,public.live_match_state,public.live_match_events FROM anon,authenticated;
GRANT SELECT ON public.live_match_events TO authenticated;
CREATE POLICY live_events_member_read ON public.live_match_events FOR SELECT TO authenticated
USING(public.is_tournament_member(auth.uid(),tournament_id));
-- Only aggregate already-awarded points. Predictions themselves remain under
-- the existing lock-aware RLS policy and are never exposed by this function.
CREATE FUNCTION public.live_score_totals(p_tournament_id uuid)
RETURNS TABLE(participant_id uuid,display_name text,match_points int,group_ranking_points int,bonus_points int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT p.id,p.display_name,
 coalesce((select sum(points_earned) from match_predictions where participant_id=p.id),0)::int,
 coalesce((select sum(points_earned) from group_predictions where participant_id=p.id),0)::int,
 coalesce((select sum(points_earned) from bonus_predictions where participant_id=p.id),0)::int
 FROM participants p WHERE p.tournament_id=p_tournament_id AND public.is_tournament_member(auth.uid(),p_tournament_id)
$$;
REVOKE ALL ON FUNCTION public.live_score_totals(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.live_score_totals(uuid) TO authenticated;
