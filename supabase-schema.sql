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
create unique index if not exists attendees_event_employee_code_unique_idx
  on attendees(event_id, employee_code)
  where employee_code is not null;
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

-- Check-in/check-out records used to calculate actual meeting time.
create table if not exists attendance_actions (
  id uuid primary key default gen_random_uuid(),
  attendee_id uuid not null references attendees(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  action text not null check (action in ('check_in', 'check_out')),
  source text not null check (source in ('event_qr', 'owner_qr', 'manual')),
  note text,
  recorded_at timestamptz not null default now()
);

create index if not exists attendance_actions_attendee_time_idx
  on attendance_actions(attendee_id, recorded_at asc);
create index if not exists attendance_actions_event_time_idx
  on attendance_actions(event_id, recorded_at asc);

-- One session is created for each event and Indian calendar date. The owner
-- opens/closes this session from the dashboard; the printed event QR stays
-- permanent and never needs to change.
create table if not exists attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  attendance_date date not null,
  is_open boolean not null default false,
  opened_at timestamptz,
  closes_at timestamptz,
  daily_pin text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, attendance_date)
);

-- This is the permanent daily history. The unique constraint is the final
-- protection: one registered attendee can have only one record per event/day.
create table if not exists attendance_records (
  id uuid primary key default gen_random_uuid(),
  attendee_id uuid not null references attendees(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  session_id uuid references attendance_sessions(id) on delete set null,
  attendance_date date not null,
  checked_in_at timestamptz not null default now(),
  source text not null check (source in ('event_qr', 'owner_qr', 'manual')),
  note text,
  created_at timestamptz not null default now(),
  unique (attendee_id, event_id, attendance_date)
);

create index if not exists attendance_sessions_event_date_idx
  on attendance_sessions(event_id, attendance_date desc);
create index if not exists attendance_records_event_date_idx
  on attendance_records(event_id, attendance_date desc);
create index if not exists attendance_records_attendee_date_idx
  on attendance_records(attendee_id, attendance_date desc);


-- Browser clients never query these tables directly. All database access goes
-- through server routes using SUPABASE_SERVICE_ROLE_KEY.
alter table events enable row level security;
alter table attendees enable row level security;
alter table attendance_scans enable row level security;
alter table attendance_actions enable row level security;
alter table attendance_sessions enable row level security;
alter table attendance_records enable row level security;

-- The photo bucket is intentionally public so dashboard/pass images can render.
insert into storage.buckets (id, name, public)
values ('attendee-photos', 'attendee-photos', true)
on conflict (id) do update set public = true;

drop policy if exists "Public can upload attendee photos" on storage.objects;
create policy "Public can upload attendee photos"
  on storage.objects for insert to anon
  with check (bucket_id = 'attendee-photos');
