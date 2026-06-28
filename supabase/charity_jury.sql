-- Charity action jury tables
-- Run this in Supabase SQL Editor before enabling cross-account charity confirmations.

create extension if not exists pgcrypto;

create table if not exists public.charity_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action_type text not null,
  description text not null,
  proof_text text,
  reward_coins integer not null default 0 check (reward_coins >= 0 and reward_coins <= 100),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'needs_revision')),
  approve_count integer not null default 0,
  reject_count integer not null default 0,
  revise_count integer not null default 0,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.charity_jury_votes (
  id uuid primary key default gen_random_uuid(),
  action_id uuid not null references public.charity_actions(id) on delete cascade,
  juror_id uuid not null references auth.users(id) on delete cascade,
  vote text not null check (vote in ('approve', 'reject', 'revise')),
  created_at timestamptz not null default now(),
  unique (action_id, juror_id)
);

create index if not exists charity_actions_status_created_idx on public.charity_actions(status, created_at);
create index if not exists charity_actions_user_created_idx on public.charity_actions(user_id, created_at desc);
create index if not exists charity_jury_votes_action_idx on public.charity_jury_votes(action_id);

alter table public.charity_actions enable row level security;
alter table public.charity_jury_votes enable row level security;

drop policy if exists "charity actions are readable" on public.charity_actions;
create policy "charity actions are readable"
  on public.charity_actions for select
  to authenticated
  using (status = 'pending' or user_id = auth.uid());

drop policy if exists "users create own charity actions" on public.charity_actions;
create policy "users create own charity actions"
  on public.charity_actions for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "jurors may update pending charity actions" on public.charity_actions;
create policy "jurors may update pending charity actions"
  on public.charity_actions for update
  to authenticated
  using (status = 'pending')
  with check (status in ('pending', 'approved', 'rejected', 'needs_revision'));

drop policy if exists "charity jury votes are readable" on public.charity_jury_votes;
create policy "charity jury votes are readable"
  on public.charity_jury_votes for select
  to authenticated
  using (true);

drop policy if exists "users create own charity jury votes" on public.charity_jury_votes;
create policy "users create own charity jury votes"
  on public.charity_jury_votes for insert
  to authenticated
  with check (juror_id = auth.uid());
