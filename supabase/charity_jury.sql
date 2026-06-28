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

-- Atomic charity jury vote RPC. Run this after table creation.

create or replace function public.cast_charity_jury_vote(
  p_action_id uuid,
  p_vote text
) returns public.charity_actions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_juror uuid := auth.uid();
  v_action public.charity_actions%rowtype;
  v_approve integer := 0;
  v_reject integer := 0;
  v_revise integer := 0;
  v_next_status text := 'pending';
begin
  if v_juror is null then
    raise exception '请先登录';
  end if;

  if p_vote not in ('approve', 'reject', 'revise') then
    raise exception '确认选项无效';
  end if;

  select * into v_action
  from public.charity_actions
  where id = p_action_id
  for update;

  if not found then
    raise exception '善行案件不存在';
  end if;

  if v_action.user_id = v_juror then
    raise exception '不能确认自己的善行';
  end if;

  if v_action.status <> 'pending' then
    raise exception '这个案件已经形成结论';
  end if;

  insert into public.charity_jury_votes(action_id, juror_id, vote)
  values (p_action_id, v_juror, p_vote);

  select
    count(*) filter (where vote = 'approve'),
    count(*) filter (where vote = 'reject'),
    count(*) filter (where vote = 'revise')
  into v_approve, v_reject, v_revise
  from public.charity_jury_votes
  where action_id = p_action_id;

  if v_approve >= 2 then
    v_next_status := 'approved';
  elsif v_reject >= 2 then
    v_next_status := 'rejected';
  elsif v_revise >= 2 then
    v_next_status := 'needs_revision';
  end if;

  update public.charity_actions
  set approve_count = v_approve,
      reject_count = v_reject,
      revise_count = v_revise,
      status = v_next_status,
      decided_at = case when v_next_status = 'pending' then null else now() end
  where id = p_action_id
  returning * into v_action;

  if v_next_status = 'approved' and coalesce(v_action.reward_coins, 0) > 0 then
    perform public.add_coins(
      v_action.user_id,
      v_action.reward_coins,
      'reward_milestone',
      v_action.id,
      '善行通过陪审团确认'
    );
  end if;

  return v_action;
exception
  when unique_violation then
    raise exception '你已经确认过这个案件';
end;
$$;

grant execute on function public.cast_charity_jury_vote(uuid, text) to authenticated;

