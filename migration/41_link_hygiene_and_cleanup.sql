-- 41: link hygiene (sticky short domain + offer guard) and weekly cleanup cron.
-- Idempotent — safe to re-run.

-- 1. Per-link sticky short domain -------------------------------------------
alter table public.links add column if not exists short_domain text;
create index if not exists links_short_domain_idx on public.links (short_domain);

-- Backfill from the default shortener host when empty.
update public.links set short_domain = 'adswapx.com' where short_domain is null;

-- 2. Offer guard: never let a link point at our own / legacy brand hosts -----
create or replace function public.enforce_per_link_offer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  bad text := '(^|\.)(sleepox|adspx|adswapx)\.com$';
  h text;
begin
  if new.adsterra_url is not null and new.adsterra_url <> '' then
    h := lower(split_part(regexp_replace(new.adsterra_url, '^https?://', ''), '/', 1));
    h := split_part(h, ':', 1);
    if h ~ bad then
      -- brand leak: drop the target and pause the link instead of serving it
      new.adsterra_url := null;
      new.is_active := false;
    end if;
  end if;

  if new.safe_url is not null and new.safe_url <> '' then
    h := lower(split_part(regexp_replace(new.safe_url, '^https?://', ''), '/', 1));
    h := split_part(h, ':', 1);
    if h ~ bad then
      new.safe_url := null;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_per_link_offer on public.links;
create trigger trg_enforce_per_link_offer
  before insert or update on public.links
  for each row execute function public.enforce_per_link_offer();

-- Clean existing rows that already leak the brand.
update public.links
   set adsterra_url = null, is_active = false
 where adsterra_url ~* '^https?://([a-z0-9-]+\.)*(sleepox|adspx|adswapx)\.com';
update public.links
   set safe_url = null
 where safe_url ~* '^https?://([a-z0-9-]+\.)*(sleepox|adspx|adswapx)\.com/?$';

-- 3. Weekly cleanup: dead links older than 7 days with zero clicks -----------
create or replace function public.cleanup_dead_links()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  with dead as (
    delete from public.links l
     where l.created_at < now() - interval '7 days'
       and not exists (select 1 from public.clicks c where c.link_id = l.id)
       and coalesce(l.total_clicks, 0) = 0
    returning 1
  )
  select count(*) into removed from dead;
  return removed;
end;
$$;

grant execute on function public.cleanup_dead_links() to service_role;

-- Schedule every Sunday 03:15 UTC when pg_cron is available.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'adspx_cleanup_dead_links';
    perform cron.schedule('adspx_cleanup_dead_links', '15 3 * * 0',
                          $cron$select public.cleanup_dead_links();$cron$);
  end if;
end
$$;

notify pgrst, 'reload schema';
