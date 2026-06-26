-- Sessions
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  status text not null default 'processing' -- processing | ready | error
);

-- Raw Meta Ads rows (JSONB for flexibility across export versions)
create table if not exists meta_rows (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz default now()
);

-- Raw UTMify rows
create table if not exists utmify_rows (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz default now()
);

-- Calculated metrics snapshot
create table if not exists metrics_snapshots (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  calculated_at timestamptz default now(),
  payload jsonb not null
);

-- AI diagnosis results
create table if not exists diagnoses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  created_at timestamptz default now(),
  payload jsonb not null
);

-- Indexes
create index if not exists meta_rows_session_idx on meta_rows(session_id);
create index if not exists utmify_rows_session_idx on utmify_rows(session_id);
create index if not exists metrics_session_idx on metrics_snapshots(session_id);
create index if not exists diagnoses_session_idx on diagnoses(session_id);
