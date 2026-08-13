-- ============================================================================
-- 04_support_broadcast.sql
-- Adds: Support ticket system + Broadcast notice system
-- Apply on self-host VPS:
--   docker compose -f /opt/supabase/docker/docker-compose.yml exec -T db \
--     psql -U postgres -d postgres < /opt/sleepox-app-new/migration/04_support_broadcast.sql
-- ============================================================================

-- ---------- 1. app_settings: support on/off toggle ----------
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS support_enabled boolean NOT NULL DEFAULT true;

-- ---------- 2. Support tickets ----------
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL,
  subject     text NOT NULL,
  message     text NOT NULL,
  status      text NOT NULL DEFAULT 'open',   -- open | replied | closed
  admin_reply text,
  replied_at  timestamptz,
  replied_by  uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT support_subject_len CHECK (char_length(subject) BETWEEN 1 AND 200),
  CONSTRAINT support_message_len CHECK (char_length(message) BETWEEN 1 AND 4000),
  CONSTRAINT support_status_chk  CHECK (status IN ('open','replied','closed'))
);

GRANT SELECT, INSERT, UPDATE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS st_own_s   ON public.support_tickets;
DROP POLICY IF EXISTS st_own_i   ON public.support_tickets;
DROP POLICY IF EXISTS st_adm_all ON public.support_tickets;

CREATE POLICY st_own_s ON public.support_tickets
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY st_own_i ON public.support_tickets
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY st_adm_all ON public.support_tickets
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_support_tickets_user
  ON public.support_tickets(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status
  ON public.support_tickets(status, created_at DESC);

DROP TRIGGER IF EXISTS trg_support_tickets_touch ON public.support_tickets;
CREATE TRIGGER trg_support_tickets_touch
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------- 3. Broadcasts ----------
CREATE TABLE IF NOT EXISTS public.broadcasts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  body        text NOT NULL,
  icon        text NOT NULL DEFAULT 'sparkles',
  tone        text NOT NULL DEFAULT 'premium',  -- info | success | warning | premium
  is_active   boolean NOT NULL DEFAULT true,
  created_by  uuid NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz,
  CONSTRAINT  broadcast_title_len CHECK (char_length(title) BETWEEN 1 AND 200),
  CONSTRAINT  broadcast_body_len  CHECK (char_length(body)  BETWEEN 1 AND 2000),
  CONSTRAINT  broadcast_tone_chk  CHECK (tone IN ('info','success','warning','premium'))
);

GRANT SELECT ON public.broadcasts TO authenticated;
GRANT ALL    ON public.broadcasts TO service_role;

ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS br_read_auth ON public.broadcasts;
DROP POLICY IF EXISTS br_adm_all   ON public.broadcasts;

-- Users see only active + non-expired
CREATE POLICY br_read_auth ON public.broadcasts
  FOR SELECT TO authenticated
  USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

-- Admin: full CRUD (including inactive/expired ones)
CREATE POLICY br_adm_all ON public.broadcasts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_broadcasts_active
  ON public.broadcasts(created_at DESC) WHERE is_active = true;

-- ---------- 4. Broadcast reads (per-user) ----------
CREATE TABLE IF NOT EXISTS public.broadcast_reads (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id uuid NOT NULL REFERENCES public.broadcasts(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL,
  read_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (broadcast_id, user_id)
);

GRANT SELECT, INSERT ON public.broadcast_reads TO authenticated;
GRANT ALL ON public.broadcast_reads TO service_role;

ALTER TABLE public.broadcast_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS brd_own_s ON public.broadcast_reads;
DROP POLICY IF EXISTS brd_own_i ON public.broadcast_reads;

CREATE POLICY brd_own_s ON public.broadcast_reads
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY brd_own_i ON public.broadcast_reads
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_broadcast_reads_user
  ON public.broadcast_reads(user_id, broadcast_id);
