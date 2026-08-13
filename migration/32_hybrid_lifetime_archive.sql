-- ============================================================
-- 32 — Hybrid data retention (no data loss)
--   * Raw per-click rows are still purged weekly (keeps the VPS fast)
--   * BUT lifetime totals are archived FIRST and kept forever
--   * Nothing belonging to a user is ever deleted automatically
--   * Admin-only: dormant users (no login for N days, default 15)
-- ============================================================

-- ---------- 1. Lifetime archives -----------------------------

create table if not exists public.link_lifetime_stats (
  link_id        uuid primary key references public.links(id) on delete cascade,
  user_id        uuid not null,
  short_code     text,
  total_clicks   bigint not null default 0,
  human_clicks   bigint not null default 0,
  bot_clicks     bigint not null default 0,
  first_click_at timestamptz,
  last_click_at  timestamptz,
  updated_at     timestamptz not null default now()
);

create index if not exists link_lifetime_stats_user_idx on public.link_lifetime_stats(user_id);

create table if not exists public.user_lifetime_stats (
  user_id       uuid primary key,
  total_clicks  bigint not null default 0,
  human_clicks  bigint not null default 0,
  bot_clicks    bigint not null default 0,
  links_created bigint not null default 0,
  updated_at    timestamptz not null default now()
);

grant select on public.link_lifetime_stats to authenticated;
grant select on public.user_lifetime_stats to authenticated;
grant all on public.link_lifetime_stats to service_role;
grant all on public.user_lifetime_stats to service_role;

alter table public.link_lifetime_stats enable row level security;
alter table public.user_lifetime_stats enable row level security;

drop policy if exists "own link lifetime stats" on public.link_lifetime_stats;
create policy "own link lifetime stats" on public.link_lifetime_stats
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "own user lifetime stats" on public.user_lifetime_stats;
create policy "own user lifetime stats" on public.user_lifetime_stats
  for select to authenticated using (user_id = auth.uid());

-- ---------- 2. Archive routine (monotonic — totals never shrink) ----

create or replace function public.archive_lifetime_stats()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.link_lifetime_stats as t
    (link_id, user_id, short_code, total_clicks, human_clicks, bot_clicks, first_click_at, last_click_at, updated_at)
  select
    l.id,
    l.user_id,
    l.short_code,
    coalesce(l.clicks_count, 0) + coalesce(l.bot_clicks_count, 0),
    coalesce(l.clicks_count, 0),
    coalesce(l.bot_clicks_count, 0),
    c.first_at,
    c.last_at,
    now()
  from public.links l
  left join lateral (
    select min(created_at) as first_at, max(created_at) as last_at
    from public.clicks where link_id = l.id
  ) c on true
  on conflict (link_id) do update set
    short_code     = excluded.short_code,
    total_clicks   = greatest(t.total_clicks, excluded.total_clicks),
    human_clicks   = greatest(t.human_clicks, excluded.human_clicks),
    bot_clicks     = greatest(t.bot_clicks,   excluded.bot_clicks),
    first_click_at = least(coalesce(t.first_click_at, excluded.first_click_at), coalesce(excluded.first_click_at, t.first_click_at)),
    last_click_at  = greatest(coalesce(t.last_click_at, excluded.last_click_at), coalesce(excluded.last_click_at, t.last_click_at)),
    updated_at     = now();

  insert into public.user_lifetime_stats as u
    (user_id, total_clicks, human_clicks, bot_clicks, links_created, updated_at)
  select
    s.user_id,
    sum(s.total_clicks),
    sum(s.human_clicks),
    sum(s.bot_clicks),
    count(*),
    now()
  from public.link_lifetime_stats s
  group by s.user_id
  on conflict (user_id) do update set
    total_clicks  = greatest(u.total_clicks,  excluded.total_clicks),
    human_clicks  = greatest(u.human_clicks,  excluded.human_clicks),
    bot_clicks    = greatest(u.bot_clicks,    excluded.bot_clicks),
    links_created = greatest(u.links_created, excluded.links_created),
    updated_at    = now();
end;
$$;

grant execute on function public.archive_lifetime_stats() to service_role;

-- ---------- 3. Weekly purge = archive first, then drop raw rows ----

create or replace function public.maintenance_purge_old_clicks()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  -- Step 1: never lose totals.
  perform public.archive_lifetime_stats();

  -- Step 2: batched delete of raw click rows older than 7 days.
  loop
    delete from public.clicks
    where ctid in (
      select ctid from public.clicks
      where created_at < now() - interval '7 days'
      limit 5000
    );
    get diagnostics removed = row_count;
    exit when removed = 0;
  end loop;

  -- Step 3: resolved / stale error logs older than 30 days.
  delete from public.error_logs where created_at < now() - interval '30 days';

  -- NOTE: links, profiles, daily_stats, earnings and withdrawals are NEVER touched.
end;
$$;

grant execute on function public.maintenance_purge_old_clicks() to service_role;

-- ---------- 4. Dormant users (admin filter, default 15 days) -------

create or replace function public.admin_get_dormant_users(_days integer default 15)
returns table (
  id uuid,
  email text,
  created_at timestamptz,
  last_login_at timestamptz,
  days_inactive integer,
  links_count bigint,
  total_clicks bigint
)
language sql
security definer
set search_path = public, auth
as $$
  select
    u.id,
    u.email::text,
    u.created_at,
    u.last_sign_in_at as last_login_at,
    extract(day from now() - coalesce(u.last_sign_in_at, u.created_at))::int as days_inactive,
    coalesce((select count(*) from public.links l where l.user_id = u.id), 0) as links_count,
    coalesce((select s.total_clicks from public.user_lifetime_stats s where s.user_id = u.id), 0) as total_clicks
  from auth.users u
  where coalesce(u.last_sign_in_at, u.created_at) < now() - make_interval(days => greatest(_days, 1))
  order by coalesce(u.last_sign_in_at, u.created_at) asc
  limit 500;
$$;

revoke all on function public.admin_get_dormant_users(integer) from public, anon, authenticated;
grant execute on function public.admin_get_dormant_users(integer) to service_role;

-- ---------- 5. Indexes for a 12-core / 48GB box --------------------

create index if not exists clicks_created_at_idx on public.clicks (created_at);
create index if not exists clicks_link_created_idx on public.clicks (link_id, created_at desc);
