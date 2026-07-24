-- Run this ONCE in Supabase SQL Editor before deploying the Daily Attendance update.
-- It adds new tables only; it does not delete registrations or old attendance data.

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

alter table attendance_sessions enable row level security;
alter table attendance_records enable row level security;
