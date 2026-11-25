-- Insta Auto — Supabase schema for job & reel tracking.
-- Run this in the Supabase SQL Editor (https://supabase.com/dashboard).

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

create index if not exists jobs_created_at_idx on public.jobs (created_at desc);
create index if not exists jobs_status_idx on public.jobs (status);
