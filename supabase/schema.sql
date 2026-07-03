-- Pitbrain — Supabase schema
-- MVP has no end-user auth yet: RLS is enabled with no public policies,
-- so every table is only reachable via the server-side service_role client
-- (see lib/supabase.ts getSupabaseAdminClient). Safe to re-run (idempotent).

create extension if not exists pgcrypto;

-- ── pitbrain_imports ──────────────────────────────────────────────────────────
create table if not exists pitbrain_imports (
  id                          uuid primary key default gen_random_uuid(),
  name                        text not null,
  original_file_name          text,
  source                      text not null default 'utmify',
  source_type                 text not null,
  breakdown_level             text,
  dimension_field             text,
  dimension_label             text,
  product                     text,
  funnel_group                text,
  period_label                text,
  date_range                  jsonb,
  rows                        jsonb not null default '[]'::jsonb,
  footer_totals               jsonb not null default '[]'::jsonb,
  summary                     jsonb not null default '{}'::jsonb,
  row_count                   integer not null default 0,
  ignored_footer_rows_count   integer not null default 0,
  file_hash                   text,
  tags                        text[] default '{}',
  created_at                  timestamptz default now(),
  updated_at                  timestamptz default now()
);

create index if not exists idx_pitbrain_imports_source_type      on pitbrain_imports (source_type);
create index if not exists idx_pitbrain_imports_breakdown_level   on pitbrain_imports (breakdown_level);
create index if not exists idx_pitbrain_imports_funnel_group      on pitbrain_imports (funnel_group);
create index if not exists idx_pitbrain_imports_file_hash         on pitbrain_imports (file_hash);

alter table pitbrain_imports enable row level security;

-- ── pitbrain_settings ─────────────────────────────────────────────────────────
create table if not exists pitbrain_settings (
  id          text primary key,
  value       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz default now()
);

alter table pitbrain_settings enable row level security;

-- ── pitbrain_meta_syncs ───────────────────────────────────────────────────────
create table if not exists pitbrain_meta_syncs (
  id               uuid primary key default gen_random_uuid(),
  ad_account_id    text not null,
  ad_account_name  text,
  campaigns        jsonb default '[]'::jsonb,
  adsets           jsonb default '[]'::jsonb,
  ads              jsonb default '[]'::jsonb,
  creatives        jsonb default '[]'::jsonb,
  dark_posts       jsonb default '[]'::jsonb,
  counts           jsonb default '{}'::jsonb,
  status           text default 'completed',
  error            text,
  created_at       timestamptz default now()
);

alter table pitbrain_meta_syncs enable row level security;

-- ── pitbrain_winners ──────────────────────────────────────────────────────────
create table if not exists pitbrain_winners (
  id                     uuid primary key default gen_random_uuid(),
  product                text,
  funnel_group           text,
  ad_name                text not null,
  post_id                text,
  story_id               text,
  video_id               text,
  object_story_id        text,
  permalink              text,
  source_campaign_name   text,
  source_adset_name      text,
  metrics                jsonb default '{}'::jsonb,
  insights               jsonb default '[]'::jsonb,
  status                 text default 'winner',
  created_at             timestamptz default now(),
  updated_at             timestamptz default now()
);

create index if not exists idx_pitbrain_winners_funnel_group on pitbrain_winners (funnel_group);
create index if not exists idx_pitbrain_winners_post_id      on pitbrain_winners (post_id);

alter table pitbrain_winners enable row level security;

-- No policies are created on purpose: with RLS enabled and zero policies,
-- PostgREST (anon/authenticated roles) can't read or write these tables at all.
-- Only the service_role key (which bypasses RLS) can — i.e. only our
-- server-side API routes via getSupabaseAdminClient().
