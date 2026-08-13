-- ============================================================================
-- Wikipedia Safe URL Pool — for FB ad-review safe redirect
-- Real wikipedia.org URLs have highest trust score, FB approval rate ~95%
-- ============================================================================

-- 1. Add safe_url_category column to links table (optional, nullable)
ALTER TABLE public.links
  ADD COLUMN IF NOT EXISTS safe_url_category TEXT;

-- 2. Create wikipedia_safe_urls table
CREATE TABLE IF NOT EXISTS public.wikipedia_safe_urls (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category    TEXT NOT NULL,
  language    TEXT NOT NULL DEFAULT 'en',
  url         TEXT NOT NULL UNIQUE,
  title       TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  click_count BIGINT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wikiurls_category_lang_active
  ON public.wikipedia_safe_urls (category, language, is_active);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wikipedia_safe_urls TO authenticated;
GRANT SELECT ON public.wikipedia_safe_urls TO anon;
GRANT ALL ON public.wikipedia_safe_urls TO service_role;

ALTER TABLE public.wikipedia_safe_urls ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Anyone can read active wiki urls"
  ON public.wikipedia_safe_urls FOR SELECT
  USING (is_active = true);

CREATE POLICY IF NOT EXISTS "Service role manages wiki urls"
  ON public.wikipedia_safe_urls FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 3. Seed data — 60+ real Wikipedia URLs across categories & languages
INSERT INTO public.wikipedia_safe_urls (category, language, url, title) VALUES
-- HEALTH (English)
('health', 'en', 'https://en.wikipedia.org/wiki/Health', 'Health'),
('health', 'en', 'https://en.wikipedia.org/wiki/Nutrition', 'Nutrition'),
('health', 'en', 'https://en.wikipedia.org/wiki/Physical_fitness', 'Physical fitness'),
('health', 'en', 'https://en.wikipedia.org/wiki/Mental_health', 'Mental health'),
('health', 'en', 'https://en.wikipedia.org/wiki/Sleep', 'Sleep'),
('health', 'en', 'https://en.wikipedia.org/wiki/Vitamin', 'Vitamin'),
('health', 'en', 'https://en.wikipedia.org/wiki/Yoga', 'Yoga'),
('health', 'en', 'https://en.wikipedia.org/wiki/Meditation', 'Meditation'),
-- TECHNOLOGY
('technology', 'en', 'https://en.wikipedia.org/wiki/Artificial_intelligence', 'Artificial intelligence'),
('technology', 'en', 'https://en.wikipedia.org/wiki/Smartphone', 'Smartphone'),
('technology', 'en', 'https://en.wikipedia.org/wiki/Internet', 'Internet'),
('technology', 'en', 'https://en.wikipedia.org/wiki/Computer', 'Computer'),
('technology', 'en', 'https://en.wikipedia.org/wiki/Software', 'Software'),
('technology', 'en', 'https://en.wikipedia.org/wiki/5G', '5G'),
('technology', 'en', 'https://en.wikipedia.org/wiki/Cloud_computing', 'Cloud computing'),
('technology', 'en', 'https://en.wikipedia.org/wiki/Blockchain', 'Blockchain'),
-- FINANCE
('finance', 'en', 'https://en.wikipedia.org/wiki/Finance', 'Finance'),
('finance', 'en', 'https://en.wikipedia.org/wiki/Investment', 'Investment'),
('finance', 'en', 'https://en.wikipedia.org/wiki/Stock_market', 'Stock market'),
('finance', 'en', 'https://en.wikipedia.org/wiki/Cryptocurrency', 'Cryptocurrency'),
('finance', 'en', 'https://en.wikipedia.org/wiki/Personal_finance', 'Personal finance'),
('finance', 'en', 'https://en.wikipedia.org/wiki/Bank', 'Bank'),
('finance', 'en', 'https://en.wikipedia.org/wiki/Insurance', 'Insurance'),
-- NEWS / CURRENT EVENTS
('news', 'en', 'https://en.wikipedia.org/wiki/News', 'News'),
('news', 'en', 'https://en.wikipedia.org/wiki/Journalism', 'Journalism'),
('news', 'en', 'https://en.wikipedia.org/wiki/Mass_media', 'Mass media'),
('news', 'en', 'https://en.wikipedia.org/wiki/Newspaper', 'Newspaper'),
-- CELEBRITY / ENTERTAINMENT
('celebrity', 'en', 'https://en.wikipedia.org/wiki/Cristiano_Ronaldo', 'Cristiano Ronaldo'),
('celebrity', 'en', 'https://en.wikipedia.org/wiki/Lionel_Messi', 'Lionel Messi'),
('celebrity', 'en', 'https://en.wikipedia.org/wiki/Taylor_Swift', 'Taylor Swift'),
('celebrity', 'en', 'https://en.wikipedia.org/wiki/Elon_Musk', 'Elon Musk'),
('celebrity', 'en', 'https://en.wikipedia.org/wiki/Beyoncé', 'Beyoncé'),
('celebrity', 'en', 'https://en.wikipedia.org/wiki/Dwayne_Johnson', 'Dwayne Johnson'),
-- LIFESTYLE
('lifestyle', 'en', 'https://en.wikipedia.org/wiki/Travel', 'Travel'),
('lifestyle', 'en', 'https://en.wikipedia.org/wiki/Tourism', 'Tourism'),
('lifestyle', 'en', 'https://en.wikipedia.org/wiki/Fashion', 'Fashion'),
('lifestyle', 'en', 'https://en.wikipedia.org/wiki/Cooking', 'Cooking'),
('lifestyle', 'en', 'https://en.wikipedia.org/wiki/Photography', 'Photography'),
-- BUSINESS
('business', 'en', 'https://en.wikipedia.org/wiki/Business', 'Business'),
('business', 'en', 'https://en.wikipedia.org/wiki/Entrepreneurship', 'Entrepreneurship'),
('business', 'en', 'https://en.wikipedia.org/wiki/Marketing', 'Marketing'),
('business', 'en', 'https://en.wikipedia.org/wiki/E-commerce', 'E-commerce'),
-- INDONESIAN
('health', 'id', 'https://id.wikipedia.org/wiki/Kesehatan', 'Kesehatan'),
('health', 'id', 'https://id.wikipedia.org/wiki/Gizi', 'Gizi'),
('technology', 'id', 'https://id.wikipedia.org/wiki/Teknologi', 'Teknologi'),
('finance', 'id', 'https://id.wikipedia.org/wiki/Keuangan', 'Keuangan'),
('news', 'id', 'https://id.wikipedia.org/wiki/Berita', 'Berita'),
-- THAI
('health', 'th', 'https://th.wikipedia.org/wiki/สุขภาพ', 'สุขภาพ'),
('technology', 'th', 'https://th.wikipedia.org/wiki/เทคโนโลยี', 'เทคโนโลยี'),
('finance', 'th', 'https://th.wikipedia.org/wiki/การเงิน', 'การเงิน'),
-- FILIPINO (Tagalog)
('health', 'tl', 'https://tl.wikipedia.org/wiki/Kalusugan', 'Kalusugan'),
('technology', 'tl', 'https://tl.wikipedia.org/wiki/Teknolohiya', 'Teknolohiya'),
-- BENGALI
('health', 'bn', 'https://bn.wikipedia.org/wiki/স্বাস্থ্য', 'স্বাস্থ্য'),
('technology', 'bn', 'https://bn.wikipedia.org/wiki/প্রযুক্তি', 'প্রযুক্তি'),
-- VIETNAMESE
('health', 'vi', 'https://vi.wikipedia.org/wiki/Sức_khỏe', 'Sức khỏe'),
('technology', 'vi', 'https://vi.wikipedia.org/wiki/Công_nghệ', 'Công nghệ'),
-- PORTUGUESE (Brazil/PT)
('health', 'pt', 'https://pt.wikipedia.org/wiki/Saúde', 'Saúde'),
('technology', 'pt', 'https://pt.wikipedia.org/wiki/Tecnologia', 'Tecnologia'),
-- SPANISH
('health', 'es', 'https://es.wikipedia.org/wiki/Salud', 'Salud'),
('technology', 'es', 'https://es.wikipedia.org/wiki/Tecnología', 'Tecnología'),
-- ARABIC (for MA / MENA)
('health', 'ar', 'https://ar.wikipedia.org/wiki/صحة', 'صحة'),
('technology', 'ar', 'https://ar.wikipedia.org/wiki/تكنولوجيا', 'تكنولوجيا')
ON CONFLICT (url) DO NOTHING;
