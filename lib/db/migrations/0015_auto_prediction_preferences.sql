CREATE TABLE public.auto_prediction_preferences (
  participant_id uuid PRIMARY KEY REFERENCES public.participants(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.auto_prediction_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.auto_prediction_preferences FROM anon, authenticated;
