ALTER TABLE public.clicks
  ADD COLUMN IF NOT EXISTS bot_score integer,
  ADD COLUMN IF NOT EXISTS fingerprint_hash text,
  ADD COLUMN IF NOT EXISTS signals jsonb,
  ADD COLUMN IF NOT EXISTS challenge_passed boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS clicks_fp_hash_recent_idx
  ON public.clicks (fingerprint_hash, created_at DESC)
  WHERE fingerprint_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS clicks_bot_score_idx
  ON public.clicks (bot_score)
  WHERE bot_score IS NOT NULL;