-- Run this once in Supabase SQL Editor (Project -> SQL Editor -> New Query)

create table if not exists attendees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  event_name text,
  created_at timestamptz default now(),
  attended_at timestamptz,
  status text default 'registered'
);

-- Allow the app (using the anon key) to read/write.
-- Fine for a small internal tool with a private link; do not expose the QR/link publicly.
alter table attendees enable row level security;

create policy "Allow public insert" on attendees
  for insert to anon
  with check (true);

create policy "Allow public select" on attendees
  for select to anon
  using (true);

create policy "Allow public update" on attendees
  for update to anon
  using (true);
