CREATE TABLE public.round_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  round_key text NOT NULL,
  label text NOT NULL,
  tracked_open boolean NOT NULL,
  observed_at timestamptz NOT NULL DEFAULT now(),
  captured_at timestamptz,
  standings jsonb,
  CONSTRAINT round_history_capture_pair CHECK ((captured_at IS NULL) = (standings IS NULL))
);
CREATE UNIQUE INDEX round_history_tournament_round ON public.round_history(tournament_id, round_key);
ALTER TABLE public.round_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.round_history FROM anon, authenticated;
GRANT SELECT ON public.round_history TO authenticated;
CREATE POLICY round_history_member_read ON public.round_history FOR SELECT TO authenticated
USING (public.is_tournament_member(auth.uid(), tournament_id));
