-- Run this in the Supabase SQL editor before deploying the app.
-- It is safe for both a new project and the earlier single-event version.

create extension if not exists pgcrypto;

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists attendees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  employee_code text,
  whatsapp text,
  division text,
  photo_url text,
  event_id uuid references events(id) on delete cascade,
  status text not null default 'absent' check (status in ('absent', 'present')),
  created_at timestamptz not null default now(),
  attended_at timestamptz
);

-- Upgrade columns from the old schema if they already exist.
alter table attendees add column if not exists employee_code text;
alter table attendees add column if not exists whatsapp text;
alter table attendees add column if not exists division text;
alter table attendees add column if not exists photo_url text;
alter table attendees add column if not exists event_id uuid references events(id) on delete cascade;
alter table attendees add column if not exists attended_at timestamptz;
update attendees set status = 'absent' where status is null or status not in ('absent', 'present');
alter table attendees alter column status set default 'absent';

create index if not exists attendees_event_id_idx on attendees(event_id);
create index if not exists events_slug_idx on events(slug);

-- Every successful self check-in creates a time-stamped scan record.
-- The app allows one record per attendee every 30 minutes.
create table if not exists attendance_scans (
  id uuid primary key default gen_random_uuid(),
  attendee_id uuid not null references attendees(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  checked_at timestamptz not null default now()
);

create index if not exists attendance_scans_attendee_time_idx
  on attendance_scans(attendee_id, checked_at desc);
create index if not exists attendance_scans_event_time_idx
  on attendance_scans(event_id, checked_at desc);

-- Browser clients never query these tables directly. All database access goes
-- through server routes using SUPABASE_SERVICE_ROLE_KEY.
alter table events enable row level security;
alter table attendees enable row level security;
alter table attendance_scans enable row level security;

-- The photo bucket is intentionally public so dashboard/pass images can render.
insert into storage.buckets (id, name, public)
values ('attendee-photos', 'attendee-photos', true)
on conflict (id) do update set public = true;

drop policy if exists "Public can upload attendee photos" on storage.objects;
create policy "Public can upload attendee photos"
  on storage.objects for insert to anon
  with check (bucket_id = 'attendee-photos');
