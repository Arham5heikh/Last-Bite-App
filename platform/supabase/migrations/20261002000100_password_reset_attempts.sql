-- Wrong password-reset codes, to rate-limit guessing of the 6-digit code per email address
-- (Supabase Auth only limits code checks per IP address). Only the server, with the secret key,
-- reads or writes this table; rows older than a day are deleted when new ones are recorded.
create table public.reset_code_failures (
  id bigint generated always as identity primary key,
  email text not null,
  at timestamptz not null default now()
);
create index reset_code_failures_idx on public.reset_code_failures (email, at);

alter table public.reset_code_failures enable row level security;
-- No policies: browsers (anon and signed-in users) can't see or change it.
