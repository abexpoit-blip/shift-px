
CREATE TABLE IF NOT EXISTS public.wikipedia_safe_urls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  url TEXT NOT NULL,
  title TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wiki_safe_active ON public.wikipedia_safe_urls(category, language) WHERE is_active = true;
CREATE UNIQUE INDEX IF NOT EXISTS uq_wiki_safe_url ON public.wikipedia_safe_urls(url);

GRANT ALL ON public.wikipedia_safe_urls TO service_role;
GRANT SELECT ON public.wikipedia_safe_urls TO authenticated;

ALTER TABLE public.wikipedia_safe_urls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wiki_safe_urls_service_all"
  ON public.wikipedia_safe_urls FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "wiki_safe_urls_authenticated_read"
  ON public.wikipedia_safe_urls FOR SELECT
  TO authenticated USING (is_active = true);

INSERT INTO public.wikipedia_safe_urls (category, language, url, title) VALUES
-- health (en)
('health','en','https://en.wikipedia.org/wiki/Health','Health'),
('health','en','https://en.wikipedia.org/wiki/Nutrition','Nutrition'),
('health','en','https://en.wikipedia.org/wiki/Exercise','Exercise'),
('health','en','https://en.wikipedia.org/wiki/Mental_health','Mental health'),
('health','en','https://en.wikipedia.org/wiki/Immune_system','Immune system'),
('health','en','https://en.wikipedia.org/wiki/Vitamin','Vitamin'),
('health','en','https://en.wikipedia.org/wiki/Hydration','Hydration'),
('health','en','https://en.wikipedia.org/wiki/Yoga','Yoga'),
-- sleep (en)
('sleep','en','https://en.wikipedia.org/wiki/Sleep','Sleep'),
('sleep','en','https://en.wikipedia.org/wiki/Insomnia','Insomnia'),
('sleep','en','https://en.wikipedia.org/wiki/Sleep_hygiene','Sleep hygiene'),
('sleep','en','https://en.wikipedia.org/wiki/Rapid_eye_movement_sleep','REM sleep'),
('sleep','en','https://en.wikipedia.org/wiki/Melatonin','Melatonin'),
('sleep','en','https://en.wikipedia.org/wiki/Circadian_rhythm','Circadian rhythm'),
('sleep','en','https://en.wikipedia.org/wiki/Sleep_disorder','Sleep disorder'),
('sleep','en','https://en.wikipedia.org/wiki/Dream','Dream'),
-- technology
('technology','en','https://en.wikipedia.org/wiki/Computer','Computer'),
('technology','en','https://en.wikipedia.org/wiki/Internet','Internet'),
('technology','en','https://en.wikipedia.org/wiki/Smartphone','Smartphone'),
('technology','en','https://en.wikipedia.org/wiki/Artificial_intelligence','Artificial intelligence'),
('technology','en','https://en.wikipedia.org/wiki/Cloud_computing','Cloud computing'),
('technology','en','https://en.wikipedia.org/wiki/Cybersecurity','Cybersecurity'),
-- science
('science','en','https://en.wikipedia.org/wiki/Science','Science'),
('science','en','https://en.wikipedia.org/wiki/Physics','Physics'),
('science','en','https://en.wikipedia.org/wiki/Biology','Biology'),
('science','en','https://en.wikipedia.org/wiki/Chemistry','Chemistry'),
('science','en','https://en.wikipedia.org/wiki/Astronomy','Astronomy'),
('science','en','https://en.wikipedia.org/wiki/Genetics','Genetics'),
-- lifestyle
('lifestyle','en','https://en.wikipedia.org/wiki/Lifestyle_(sociology)','Lifestyle'),
('lifestyle','en','https://en.wikipedia.org/wiki/Meditation','Meditation'),
('lifestyle','en','https://en.wikipedia.org/wiki/Mindfulness','Mindfulness'),
('lifestyle','en','https://en.wikipedia.org/wiki/Hobby','Hobby'),
('lifestyle','en','https://en.wikipedia.org/wiki/Travel','Travel'),
('lifestyle','en','https://en.wikipedia.org/wiki/Personal_development','Personal development'),
-- finance
('finance','en','https://en.wikipedia.org/wiki/Finance','Finance'),
('finance','en','https://en.wikipedia.org/wiki/Investment','Investment'),
('finance','en','https://en.wikipedia.org/wiki/Personal_finance','Personal finance'),
('finance','en','https://en.wikipedia.org/wiki/Stock_market','Stock market'),
('finance','en','https://en.wikipedia.org/wiki/Cryptocurrency','Cryptocurrency'),
('finance','en','https://en.wikipedia.org/wiki/Bank','Bank'),
-- news/general
('news','en','https://en.wikipedia.org/wiki/News','News'),
('news','en','https://en.wikipedia.org/wiki/Journalism','Journalism'),
('news','en','https://en.wikipedia.org/wiki/Newspaper','Newspaper'),
-- food
('food','en','https://en.wikipedia.org/wiki/Food','Food'),
('food','en','https://en.wikipedia.org/wiki/Cooking','Cooking'),
('food','en','https://en.wikipedia.org/wiki/Coffee','Coffee'),
('food','en','https://en.wikipedia.org/wiki/Tea','Tea'),
('food','en','https://en.wikipedia.org/wiki/Fruit','Fruit'),
('food','en','https://en.wikipedia.org/wiki/Vegetable','Vegetable'),
-- Bangla (BD)
('health','bn','https://bn.wikipedia.org/wiki/%E0%A6%B8%E0%A7%8D%E0%A6%AC%E0%A6%BE%E0%A6%B8%E0%A7%8D%E0%A6%A5%E0%A7%8D%E0%A6%AF','স্বাস্থ্য'),
('sleep','bn','https://bn.wikipedia.org/wiki/%E0%A6%98%E0%A7%81%E0%A6%AE','ঘুম'),
('food','bn','https://bn.wikipedia.org/wiki/%E0%A6%96%E0%A6%BE%E0%A6%A6%E0%A7%8D%E0%A6%AF','খাদ্য'),
('technology','bn','https://bn.wikipedia.org/wiki/%E0%A6%AA%E0%A7%8D%E0%A6%B0%E0%A6%AF%E0%A7%81%E0%A6%95%E0%A7%8D%E0%A6%A4%E0%A6%BF','প্রযুক্তি'),
('science','bn','https://bn.wikipedia.org/wiki/%E0%A6%AC%E0%A6%BF%E0%A6%9C%E0%A7%8D%E0%A6%9E%E0%A6%BE%E0%A6%A8','বিজ্ঞান'),
-- Indonesian
('health','id','https://id.wikipedia.org/wiki/Kesehatan','Kesehatan'),
('sleep','id','https://id.wikipedia.org/wiki/Tidur','Tidur'),
('technology','id','https://id.wikipedia.org/wiki/Teknologi','Teknologi'),
('food','id','https://id.wikipedia.org/wiki/Makanan','Makanan'),
-- Hindi
('health','hi','https://hi.wikipedia.org/wiki/%E0%A4%B8%E0%A5%8D%E0%A4%B5%E0%A4%BE%E0%A4%B8%E0%A5%8D%E0%A4%A5%E0%A5%8D%E0%A4%AF','स्वास्थ्य'),
('sleep','hi','https://hi.wikipedia.org/wiki/%E0%A4%A8%E0%A4%BF%E0%A4%A6%E0%A5%8D%E0%A4%B0%E0%A4%BE','निद्रा'),
-- Arabic
('health','ar','https://ar.wikipedia.org/wiki/%D8%B5%D8%AD%D8%A9','صحة'),
('sleep','ar','https://ar.wikipedia.org/wiki/%D9%86%D9%88%D9%85','نوم'),
('food','ar','https://ar.wikipedia.org/wiki/%D8%B7%D8%B9%D8%A7%D9%85','طعام'),
-- Spanish
('health','es','https://es.wikipedia.org/wiki/Salud','Salud'),
('sleep','es','https://es.wikipedia.org/wiki/Sue%C3%B1o','Sueño'),
('food','es','https://es.wikipedia.org/wiki/Alimento','Alimento'),
('finance','es','https://es.wikipedia.org/wiki/Finanzas','Finanzas'),
-- Portuguese
('health','pt','https://pt.wikipedia.org/wiki/Sa%C3%BAde','Saúde'),
('sleep','pt','https://pt.wikipedia.org/wiki/Sono','Sono'),
('food','pt','https://pt.wikipedia.org/wiki/Alimento','Alimento')
ON CONFLICT (url) DO NOTHING;
