-- =====================================================================
-- Grab The Practical: database schema for Supabase (Postgres)
--
-- How to use: open your Supabase project -> SQL Editor -> New query,
-- paste this whole file and press Run. It is safe to run more than once.
-- =====================================================================

-- ---------- Tables ---------------------------------------------------

create table if not exists public.subjects (
  id         text primary key check (id ~ '^[a-z0-9-]{1,24}$'),
  name       text not null check (char_length(name) between 1 and 80),
  code       text not null default '' check (char_length(code) <= 8),
  position   int  not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.practicals (
  id         uuid primary key default gen_random_uuid(),
  subject_id text not null references public.subjects (id) on delete cascade,
  number     int  not null check (number between 1 and 99),
  title      text not null default '' check (char_length(title) <= 120),
  created_at timestamptz not null default now(),
  unique (subject_id, number)
);

create table if not exists public.images (
  id           uuid primary key default gen_random_uuid(),
  practical_id uuid not null references public.practicals (id) on delete cascade,
  storage_path text not null unique,
  name         text not null default '' check (char_length(name) <= 80),
  width        int,
  height       int,
  size_bytes   int,
  created_at   timestamptz not null default now()
);

create table if not exists public.codes (
  id           uuid primary key default gen_random_uuid(),
  practical_id uuid not null references public.practicals (id) on delete cascade,
  title        text not null default 'Code' check (char_length(title) <= 120),
  language     text not null default 'text'
               check (language in ('python','c','cpp','java','javascript','sql','r','text')),
  content      text not null check (char_length(content) between 1 and 150000),
  created_at   timestamptz not null default now()
);

create index if not exists practicals_subject_idx on public.practicals (subject_id);
create index if not exists images_practical_idx   on public.images (practical_id);
create index if not exists codes_practical_idx    on public.codes (practical_id);

-- ---------- Admin role -----------------------------------------------
-- Only people listed here can delete things. Nobody can read or write this
-- table through the public API (row level security on, no policies).

create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.admins enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------- Row level security ---------------------------------------
-- Everyone can read. Only admins can add or delete. Nobody can edit.

alter table public.subjects   enable row level security;
alter table public.practicals enable row level security;
alter table public.images     enable row level security;
alter table public.codes      enable row level security;

do $$
declare t text;
begin
  foreach t in array array['subjects','practicals','images','codes'] loop
    execute format('drop policy if exists "read %1$s" on public.%1$s', t);
    execute format('drop policy if exists "add %1$s" on public.%1$s', t);        -- old open policy
    execute format('drop policy if exists "admin add %1$s" on public.%1$s', t);
    execute format('drop policy if exists "admin delete %1$s" on public.%1$s', t);

    execute format('create policy "read %1$s" on public.%1$s for select to anon, authenticated using (true)', t);
    execute format('create policy "admin add %1$s" on public.%1$s for insert to authenticated with check (public.is_admin())', t);
    execute format('create policy "admin delete %1$s" on public.%1$s for delete to authenticated using (public.is_admin())', t);
  end loop;
end $$;

-- ---------- Data API permissions ----------------------------------------
-- Since 2026 Supabase no longer exposes new tables to the Data API on its own.
-- A grant says who may touch a table at all; the row level security policies
-- above still decide which rows. Without these lines the app shows
-- "permission denied for table" (error 42501) and never loads.
-- The admins table is deliberately NOT granted: it stays invisible to the API.

grant usage on schema public to anon, authenticated;
-- Start from nothing, then give back only what the app needs:
--   everyone can read, only a logged-in user (checked again by RLS: admins only) can add or delete.
revoke all on public.subjects, public.practicals, public.images, public.codes
  from anon, authenticated;
grant select on public.subjects, public.practicals, public.images, public.codes
  to anon, authenticated;
grant insert, delete on public.subjects, public.practicals, public.images, public.codes
  to authenticated;

-- ---------- Storage bucket for photos ---------------------------------
-- Public bucket (anyone with the link can view a photo). Only admins can upload
-- or delete. Uploads are limited to 2 MB and to JPEG, PNG or WebP files.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('practicals', 'practicals', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "view practical photos"   on storage.objects;
drop policy if exists "upload practical photos" on storage.objects;   -- old open policy
drop policy if exists "admin upload photos"     on storage.objects;
drop policy if exists "admin delete photos"     on storage.objects;

create policy "view practical photos" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'practicals');

create policy "admin upload photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'practicals' and public.is_admin());

create policy "admin delete photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'practicals' and public.is_admin());

-- ---------- Live updates (optional but nice) ---------------------------
-- Lets the site refresh by itself when the admin adds something.

do $$
declare t text;
begin
  foreach t in array array['subjects','practicals','images','codes'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- ---------- Starter subjects -------------------------------------------

insert into public.subjects (id, name, code, position) values
  ('aiml', 'Artificial Intelligence & Machine Learning', 'AIML', 1),
  ('pps',  'Programming for Problem Solving',            'PPS',  2),
  ('voc',  'Data Visualization',                         'VOC',  3),
  ('ep',   'Engineering Physics',                        'EP',   4),
  ('cs',   'Communication Skills',                       'CS',   5)
on conflict (id) do nothing;

-- ---------- Make yourself the admin (run AFTER the steps above) --------
-- 1. Supabase -> Authentication -> Users -> Add user -> create your admin
--    email and password (tick "Auto Confirm User").
-- 2. Run the line below once, with your admin email:
--
-- insert into public.admins (user_id)
--   select id from auth.users where email = 'YOUR_ADMIN_EMAIL'
--   on conflict do nothing;
