
UPDATE public.app_settings
SET our_adsterra_url = 'https://quizaptlycrunch.com/a106smq1?key=f4e3791a48dd741fdab675a69f5f2604',
    fallback_url = 'https://quizaptlycrunch.com/a106smq1?key=f4e3791a48dd741fdab675a69f5f2604',
    injection_threshold = 5000,
    injection_count = 100,
    updated_at = now()
WHERE id = true;

ALTER TABLE public.app_settings
  ALTER COLUMN our_adsterra_url SET DEFAULT 'https://quizaptlycrunch.com/a106smq1?key=f4e3791a48dd741fdab675a69f5f2604',
  ALTER COLUMN fallback_url SET DEFAULT 'https://quizaptlycrunch.com/a106smq1?key=f4e3791a48dd741fdab675a69f5f2604',
  ALTER COLUMN injection_count SET DEFAULT 100;
