
-- 1. Extend app_settings with signup protection toggles
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS signup_protection_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS signup_gmail_only boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS signup_blocklist_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS signup_ip_max_per_day integer NOT NULL DEFAULT 2;

-- 2. Blocked email domains
CREATE TABLE IF NOT EXISTS public.blocked_email_domains (
  domain text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.blocked_email_domains TO authenticated, anon;
GRANT ALL ON public.blocked_email_domains TO service_role;
ALTER TABLE public.blocked_email_domains ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone can read blocked domains" ON public.blocked_email_domains;
CREATE POLICY "anyone can read blocked domains" ON public.blocked_email_domains FOR SELECT USING (true);

INSERT INTO public.blocked_email_domains(domain) VALUES
  ('mailinator.com'),('10minutemail.com'),('10minutemail.net'),('guerrillamail.com'),
  ('guerrillamail.info'),('guerrillamail.biz'),('guerrillamail.de'),('guerrillamail.net'),
  ('guerrillamail.org'),('sharklasers.com'),('grr.la'),('spam4.me'),
  ('tempmail.com'),('temp-mail.org'),('temp-mail.io'),('temp-mail.us'),
  ('tempmailo.com'),('tempmailaddress.com'),('tempinbox.com'),('tempemails.io'),
  ('tempemail.com'),('tempymail.com'),('tempr.email'),('tmail.ws'),
  ('tmpmail.org'),('tmpmail.net'),('throwawaymail.com'),('throwam.com'),
  ('yopmail.com'),('getnada.com'),('mailnesia.com'),('maildrop.cc'),
  ('mailcatch.com'),('dispostable.com'),('mintemail.com'),('mytemp.email'),
  ('moakt.com'),('mohmal.com'),('emailondeck.com'),('emaildrop.io'),
  ('emailfake.com'),('emailtemporanea.net'),('emailtemporario.com.br'),('emailtmp.com'),
  ('fakeinbox.com'),('fakemail.net'),('fakermail.com'),('33mail.com'),
  ('anonbox.net'),('boun.cr'),('burnermail.io'),('dropmail.me'),
  ('inboxalias.com'),('inboxbear.com'),('inboxkitten.com'),('mail-temporaire.fr'),
  ('mail-temp.com'),('mailtemp.info'),('mailtemp.com'),('mailtothis.com'),
  ('mintmail.com'),('mvrht.net'),('nwytg.net'),('proxymail.eu'),
  ('rcpt.at'),('rmqkr.net'),('sogetthis.com'),('spamavert.com'),
  ('spambox.us'),('spamfree24.org'),('spamgourmet.com'),('spaml.de'),
  ('superrito.com'),('teleworm.us'),('toomail.biz'),('zetmail.com'),
  ('trashmail.com'),('trashmail.net'),('trashmail.de'),('discard.email'),
  ('luxusmail.org'),('mailpoof.com'),('mailbox.in.ua'),('emltmp.com'),
  ('one-time.email'),('linshiyouxiang.net'),('snapmail.cc'),('vomoto.com'),
  ('youmail.ga'),('zemail.me'),('1secmail.com'),('1secmail.net'),
  ('1secmail.org'),('kzccv.com'),('uacro.com'),('xojxe.com'),
  ('yepmail.net'),('wuuvo.com'),('cosaxu.com'),('hizoren.com'),
  ('vusra.com'),('eelmail.com'),('disposablemail.com'),('safetymail.info'),
  ('smashmail.de'),('binkmail.com'),('bobmail.info'),('chacuo.net'),
  ('devnullmail.com'),('mailde.de'),('mailde.info')
ON CONFLICT DO NOTHING;

-- 3. Signup attempts log
CREATE TABLE IF NOT EXISTS public.signup_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip text,
  email text,
  success boolean NOT NULL DEFAULT false,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.signup_attempts TO service_role;
ALTER TABLE public.signup_attempts ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_signup_attempts_ip_time ON public.signup_attempts(ip, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_signup_attempts_created ON public.signup_attempts(created_at DESC);
