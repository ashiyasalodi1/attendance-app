-- Run this ONCE in Supabase SQL Editor before deploying Secure Attendance.
-- It only adds fields/tables; existing attendees and old check-in/out history remain safe.

create extension if not exists pgcrypto;

alter table events add column if not exists venue_latitude double precision;
alter table events add column if not exists venue_longitude double precision;
alter table events add column if not exists venue_radius_meters integer not null default 150;
alter table events add column if not exists check_in_start_time time;
alter table events add column if not exists check_in_end_time time;
alter table events add column if not exists check_out_start_time time;
alter table events add column if not exists check_out_end_time time;

create table if not exists attendee_passkeys (
  credential_id text primary key,
  attendee_id uuid not null references attendees(id) on delete cascade,
  public_key text not null,
  counter bigint not null default 0,
  transports text[],
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists attendee_passkeys_attendee_idx on attendee_passkeys(attendee_id);

create table if not exists webauthn_challenges (
  id uuid primary key default gen_random_uuid(),
  attendee_id uuid not null references attendees(id) on delete cascade,
  ceremony text not null check (ceremony in ('registration', 'authentication')),
  challenge text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (attendee_id, ceremony)
);

alter table attendee_passkeys enable row level security;
alter table webauthn_challenges enable row level security;
