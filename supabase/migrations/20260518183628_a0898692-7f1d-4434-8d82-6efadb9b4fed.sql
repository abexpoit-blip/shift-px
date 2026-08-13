-- Pre-lander variant content (editable by admins)
CREATE TABLE public.prelander_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  category text NOT NULL,
  title text NOT NULL,
  subtitle text NOT NULL DEFAULT '',
  intro text NOT NULL DEFAULT '',
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  outro text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.prelander_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active variants"
  ON public.prelander_variants FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins view all variants"
  ON public.prelander_variants FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins insert variants"
  ON public.prelander_variants FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update variants"
  ON public.prelander_variants FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete variants"
  ON public.prelander_variants FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER prelander_variants_updated_at
  BEFORE UPDATE ON public.prelander_variants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Per-link forced winner (admin override)
CREATE TABLE public.link_variant_overrides (
  link_id uuid PRIMARY KEY,
  variant_slug text NOT NULL,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.link_variant_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view all overrides"
  ON public.link_variant_overrides FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners view own overrides"
  ON public.link_variant_overrides FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.links
    WHERE links.id = link_variant_overrides.link_id
      AND links.user_id = auth.uid()
  ));

CREATE POLICY "Admins insert overrides"
  ON public.link_variant_overrides FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update overrides"
  ON public.link_variant_overrides FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete overrides"
  ON public.link_variant_overrides FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER link_variant_overrides_updated_at
  BEFORE UPDATE ON public.link_variant_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX idx_link_variant_overrides_slug ON public.link_variant_overrides(variant_slug);

-- Seed the three existing variants
INSERT INTO public.prelander_variants (slug, category, title, subtitle, intro, sections, outro, sort_order) VALUES
('wellness',
 'Health & Wellness',
 '5 Simple Habits That Can Transform Your Daily Routine',
 'Published today · 4 min read',
 'Building a healthier, more productive routine doesn''t require a complete life overhaul. Small, consistent habits — practiced daily — create the biggest long-term changes. Here are five evidence-backed habits anyone can start this week.',
 '[
   {"heading":"1. Start your morning with water","body":"After 7-8 hours of sleep your body is mildly dehydrated. A glass of water before coffee kickstarts your metabolism and improves morning focus."},
   {"heading":"2. Move for 10 minutes","body":"You don''t need a gym. A brisk 10-minute walk or short stretching session boosts circulation and mood."},
   {"heading":"3. Plan three priorities","body":"Pick the three most important tasks for the day. This reduces decision fatigue and helps you finish what truly matters."},
   {"heading":"4. Take screen-free breaks","body":"Every 60-90 minutes, step away from screens for a few minutes. Your eyes, posture and concentration all benefit."},
   {"heading":"5. Wind down with a routine","body":"A consistent evening routine signals your body it''s time to rest. Dim lights, avoid heavy meals, and read instead of scrolling."}
 ]'::jsonb,
 'Try one habit this week. Once it sticks, add the next. Small steps compound into big results.',
 10),
('productivity',
 'Work & Productivity',
 'How High Performers Stay Focused All Day Without Burnout',
 'Published today · 5 min read',
 'Productivity isn''t about doing more — it''s about doing the right things, consistently. Top performers across industries share a small set of focus habits that anyone can copy. Here''s a practical breakdown.',
 '[
   {"heading":"1. Protect the first 90 minutes","body":"Your willpower is highest right after waking. Spend the first 90 minutes on deep work — no meetings, no email, no social media."},
   {"heading":"2. Use the two-minute rule","body":"If a task takes less than two minutes, do it immediately. Anything longer goes on the priority list."},
   {"heading":"3. Batch shallow work","body":"Group emails, messages and admin into 1-2 windows per day instead of reacting to them all day long."},
   {"heading":"4. Single-task with a timer","body":"A 25-minute focused block with no notifications beats 60 minutes of fragmented attention."},
   {"heading":"5. End the day with a shutdown ritual","body":"Write tomorrow''s top three tasks before you stop. Your brain stops looping at night and you start sharper the next morning."}
 ]'::jsonb,
 'Pick one technique this week and stack the rest as it becomes automatic.',
 20),
('finance',
 'Personal Finance',
 '7 Money Habits That Quietly Build Long-Term Wealth',
 'Published today · 5 min read',
 'You don''t need a six-figure salary to build wealth — you need a few simple habits, repeated for years. These are the basics financial planners recommend, in plain language.',
 '[
   {"heading":"1. Pay yourself first","body":"Move a fixed amount to savings the day your salary lands — before any spending decisions."},
   {"heading":"2. Track where your money actually goes","body":"Most people overestimate income and underestimate spending. Two weeks of honest tracking changes habits faster than any budget app."},
   {"heading":"3. Keep a 1-month emergency buffer","body":"Even a small buffer prevents one bad month from turning into months of debt."},
   {"heading":"4. Avoid lifestyle inflation","body":"Every raise should partly go to savings before being absorbed into bigger expenses."},
   {"heading":"5. Automate the boring stuff","body":"Set up automatic transfers for savings, bills, and investments. Decisions you don''t have to make get made consistently."}
 ]'::jsonb,
 'Pick one habit and start this month. Wealth is built by what you do repeatedly, not what you do occasionally.',
 30);