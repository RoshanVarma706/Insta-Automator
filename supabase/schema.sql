-- Insta Auto — Supabase schema for sources, clips, and job tracking.
-- Run this in the Supabase SQL Editor (https://supabase.com/dashboard).

create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  source_url text unique not null,
  public_id text not null,
  original_url text not null,
  analysis_url text,
  title text,
  duration integer default 0,
  bytes bigint default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.clips (
  id text primary key,
  source_url text not null,
  public_id text not null,
  title text not null,
  clip_url text not null,
  start_seconds integer not null,
  end_seconds integer not null,
  duration_seconds integer not null,
  aspect_mode text not null default '9:16-16:9',
  caption_style text not null default 'viral',
  caption text,
  hashtags text[],
  format text,
  created_at timestamptz not null default now()
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  source text not null default 'generic',
  status text not null default 'pending',
  caption text,
  hashtags text[],
  cloudinary_public_id text,
  cloudinary_url text,
  ig_container_id text,
  ig_media_id text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sources_url_idx on public.sources (source_url);
create index if not exists clips_created_at_idx on public.clips (created_at desc);
create index if not exists jobs_created_at_idx on public.jobs (created_at desc);
create index if not exists jobs_status_idx on public.jobs (status);
