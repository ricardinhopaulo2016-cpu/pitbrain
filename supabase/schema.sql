-- Pitbrain — Supabase schema (workspaces + auth)
-- Run this whole file once in the Supabase SQL Editor (Project > SQL Editor > New query > Run).
-- Safe to re-run: every statement is idempotent (if not exists / or replace / drop-if-exists-then-create).

create extension if not exists pgcrypto;

-- ── updated_at trigger helper ─────────────────────────────────────────────────
create or replace function pitbrain_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── pitbrain_workspaces ───────────────────────────────────────────────────────
create table if not exists pitbrain_workspaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text unique,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

drop trigger if exists set_updated_at on pitbrain_workspaces;
create trigger set_updated_at before update on pitbrain_workspaces
  for each row execute function pitbrain_set_updated_at();

alter table pitbrain_workspaces enable row level security;

-- ── pitbrain_profiles ─────────────────────────────────────────────────────────
create table if not exists pitbrain_profiles (
  id                    uuid primary key references auth.users(id) on delete cascade,
  email                 text,
  full_name             text,
  avatar_url            text,
  default_workspace_id  uuid references pitbrain_workspaces(id),
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

drop trigger if exists set_updated_at on pitbrain_profiles;
create trigger set_updated_at before update on pitbrain_profiles
  for each row execute function pitbrain_set_updated_at();

alter table pitbrain_profiles enable row level security;

-- ── pitbrain_workspace_members ────────────────────────────────────────────────
create table if not exists pitbrain_workspace_members (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references pitbrain_workspaces(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  role          text not null default 'member' check (role in ('owner', 'admin', 'member', 'viewer')),
  created_at    timestamptz default now(),
  unique (workspace_id, user_id)
);

create index if not exists idx_pitbrain_workspace_members_workspace on pitbrain_workspace_members (workspace_id);
create index if not exists idx_pitbrain_workspace_members_user      on pitbrain_workspace_members (user_id);

alter table pitbrain_workspace_members enable row level security;

-- ── pitbrain_imports ──────────────────────────────────────────────────────────
create table if not exists pitbrain_imports (
  id                          uuid primary key default gen_random_uuid(),
  workspace_id                uuid references pitbrain_workspaces(id) on delete cascade,
  created_by                  uuid references auth.users(id),
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

-- Retrofit for pre-workspace installs of this table (CREATE TABLE IF NOT EXISTS
-- above is a no-op if the table already existed without these columns).
alter table pitbrain_imports add column if not exists workspace_id uuid references pitbrain_workspaces(id) on delete cascade;
alter table pitbrain_imports add column if not exists created_by   uuid references auth.users(id);

create index if not exists idx_pitbrain_imports_workspace       on pitbrain_imports (workspace_id);
create index if not exists idx_pitbrain_imports_source_type      on pitbrain_imports (source_type);
create index if not exists idx_pitbrain_imports_breakdown_level   on pitbrain_imports (breakdown_level);
create index if not exists idx_pitbrain_imports_funnel_group      on pitbrain_imports (funnel_group);
create index if not exists idx_pitbrain_imports_file_hash         on pitbrain_imports (file_hash);

drop trigger if exists set_updated_at on pitbrain_imports;
create trigger set_updated_at before update on pitbrain_imports
  for each row execute function pitbrain_set_updated_at();

alter table pitbrain_imports enable row level security;

-- ── pitbrain_settings ─────────────────────────────────────────────────────────
-- The pre-workspace version of this table used `id text primary key` as the
-- setting key itself. The structure below is incompatible (uuid id + separate
-- key column), so drop and recreate — safe pre-launch, no real data exists yet.
drop table if exists pitbrain_settings cascade;
create table if not exists pitbrain_settings (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid references pitbrain_workspaces(id) on delete cascade,
  key           text not null,
  value         jsonb not null default '{}'::jsonb,
  updated_at    timestamptz default now(),
  unique (workspace_id, key)
);

create index if not exists idx_pitbrain_settings_workspace_key on pitbrain_settings (workspace_id, key);

alter table pitbrain_settings enable row level security;

-- ── pitbrain_meta_syncs ───────────────────────────────────────────────────────
create table if not exists pitbrain_meta_syncs (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid references pitbrain_workspaces(id) on delete cascade,
  created_by       uuid references auth.users(id),
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

alter table pitbrain_meta_syncs add column if not exists workspace_id uuid references pitbrain_workspaces(id) on delete cascade;
alter table pitbrain_meta_syncs add column if not exists created_by   uuid references auth.users(id);

create index if not exists idx_pitbrain_meta_syncs_workspace on pitbrain_meta_syncs (workspace_id);

alter table pitbrain_meta_syncs enable row level security;

-- ── pitbrain_winners ──────────────────────────────────────────────────────────
create table if not exists pitbrain_winners (
  id                     uuid primary key default gen_random_uuid(),
  workspace_id           uuid references pitbrain_workspaces(id) on delete cascade,
  created_by             uuid references auth.users(id),
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

alter table pitbrain_winners add column if not exists workspace_id uuid references pitbrain_workspaces(id) on delete cascade;
alter table pitbrain_winners add column if not exists created_by   uuid references auth.users(id);

create index if not exists idx_pitbrain_winners_workspace     on pitbrain_winners (workspace_id);
create index if not exists idx_pitbrain_winners_funnel_group  on pitbrain_winners (funnel_group);
create index if not exists idx_pitbrain_winners_post_id       on pitbrain_winners (post_id);

drop trigger if exists set_updated_at on pitbrain_winners;
create trigger set_updated_at before update on pitbrain_winners
  for each row execute function pitbrain_set_updated_at();

alter table pitbrain_winners enable row level security;

-- ── RLS policies ──────────────────────────────────────────────────────────────
-- The app's server-side API routes use the service_role key (bypasses RLS) via
-- getSupabaseAdminClient(), so these policies are defense-in-depth for any
-- future direct client (anon/authenticated) access: a user can only see/write
-- rows in workspaces they belong to.

create or replace function pitbrain_is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from pitbrain_workspace_members
    where workspace_id = target_workspace_id and user_id = auth.uid()
  );
$$;

-- pitbrain_workspaces: a member can read their own workspace
drop policy if exists "members can read their workspace" on pitbrain_workspaces;
create policy "members can read their workspace" on pitbrain_workspaces
  for select using (pitbrain_is_workspace_member(id));

-- pitbrain_profiles: a user can read/update only their own profile
drop policy if exists "user reads own profile" on pitbrain_profiles;
create policy "user reads own profile" on pitbrain_profiles
  for select using (id = auth.uid());
drop policy if exists "user updates own profile" on pitbrain_profiles;
create policy "user updates own profile" on pitbrain_profiles
  for update using (id = auth.uid());

-- pitbrain_workspace_members: a member can read the membership list of their workspace
drop policy if exists "members can read workspace roster" on pitbrain_workspace_members;
create policy "members can read workspace roster" on pitbrain_workspace_members
  for select using (pitbrain_is_workspace_member(workspace_id));

-- Data tables: full CRUD scoped to workspace membership
drop policy if exists "members can select imports" on pitbrain_imports;
create policy "members can select imports" on pitbrain_imports
  for select using (pitbrain_is_workspace_member(workspace_id));
drop policy if exists "members can insert imports" on pitbrain_imports;
create policy "members can insert imports" on pitbrain_imports
  for insert with check (pitbrain_is_workspace_member(workspace_id));
drop policy if exists "members can update imports" on pitbrain_imports;
create policy "members can update imports" on pitbrain_imports
  for update using (pitbrain_is_workspace_member(workspace_id));
drop policy if exists "members can delete imports" on pitbrain_imports;
create policy "members can delete imports" on pitbrain_imports
  for delete using (pitbrain_is_workspace_member(workspace_id));

drop policy if exists "members can select settings" on pitbrain_settings;
create policy "members can select settings" on pitbrain_settings
  for select using (pitbrain_is_workspace_member(workspace_id));
drop policy if exists "members can insert settings" on pitbrain_settings;
create policy "members can insert settings" on pitbrain_settings
  for insert with check (pitbrain_is_workspace_member(workspace_id));
drop policy if exists "members can update settings" on pitbrain_settings;
create policy "members can update settings" on pitbrain_settings
  for update using (pitbrain_is_workspace_member(workspace_id));
drop policy if exists "members can delete settings" on pitbrain_settings;
create policy "members can delete settings" on pitbrain_settings
  for delete using (pitbrain_is_workspace_member(workspace_id));

drop policy if exists "members can select meta syncs" on pitbrain_meta_syncs;
create policy "members can select meta syncs" on pitbrain_meta_syncs
  for select using (pitbrain_is_workspace_member(workspace_id));
drop policy if exists "members can insert meta syncs" on pitbrain_meta_syncs;
create policy "members can insert meta syncs" on pitbrain_meta_syncs
  for insert with check (pitbrain_is_workspace_member(workspace_id));
drop policy if exists "members can update meta syncs" on pitbrain_meta_syncs;
create policy "members can update meta syncs" on pitbrain_meta_syncs
  for update using (pitbrain_is_workspace_member(workspace_id));
drop policy if exists "members can delete meta syncs" on pitbrain_meta_syncs;
create policy "members can delete meta syncs" on pitbrain_meta_syncs
  for delete using (pitbrain_is_workspace_member(workspace_id));

drop policy if exists "members can select winners" on pitbrain_winners;
create policy "members can select winners" on pitbrain_winners
  for select using (pitbrain_is_workspace_member(workspace_id));
drop policy if exists "members can insert winners" on pitbrain_winners;
create policy "members can insert winners" on pitbrain_winners
  for insert with check (pitbrain_is_workspace_member(workspace_id));
drop policy if exists "members can update winners" on pitbrain_winners;
create policy "members can update winners" on pitbrain_winners
  for update using (pitbrain_is_workspace_member(workspace_id));
drop policy if exists "members can delete winners" on pitbrain_winners;
create policy "members can delete winners" on pitbrain_winners
  for delete using (pitbrain_is_workspace_member(workspace_id));

-- No public/anon policies anywhere on purpose. With RLS enabled and only
-- "authenticated"-implicit policies (auth.uid()-based), anonymous requests
-- see nothing. Only service_role (bypasses RLS) or a logged-in member sees rows.

-- ── new-user onboarding: profile + default workspace + owner membership ──────
create or replace function pitbrain_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_workspace_id uuid;
  workspace_name   text;
begin
  workspace_name := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)) || '''s workspace';

  insert into pitbrain_workspaces (name) values (workspace_name)
  returning id into new_workspace_id;

  insert into pitbrain_workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, new.id, 'owner');

  insert into pitbrain_profiles (id, email, full_name, default_workspace_id)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new_workspace_id)
  on conflict (id) do update set
    email = excluded.email,
    default_workspace_id = coalesce(pitbrain_profiles.default_workspace_id, excluded.default_workspace_id);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function pitbrain_handle_new_user();
