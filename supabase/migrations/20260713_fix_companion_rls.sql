-- 修复同行关系表的 RLS 无限递归
-- 原策略在 companion_team_members 的策略内再次读取同一张表，导致无限递归。

create or replace function public.is_companion_team_member(target_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.companion_team_members
    where team_id = target_team_id
      and user_id = auth.uid()
  );
$$;

revoke all on function public.is_companion_team_member(uuid) from public;
grant execute on function public.is_companion_team_member(uuid) to authenticated;

drop policy if exists "team members can read teams" on public.companion_teams;
drop policy if exists "members can read membership" on public.companion_team_members;
drop policy if exists "members can read notes" on public.companion_team_notes;
drop policy if exists "members can read repairs" on public.companion_repairs;
drop policy if exists "members can read help requests" on public.companion_help_requests;

create policy "team members can read teams"
on public.companion_teams
for select
using (
  owner_id = auth.uid()
  or public.is_companion_team_member(id)
);

create policy "members can read membership"
on public.companion_team_members
for select
using (
  user_id = auth.uid()
  or public.is_companion_team_member(team_id)
);

create policy "members can read notes"
on public.companion_team_notes
for select
using (
  public.is_companion_team_member(team_id)
);

create policy "members can read repairs"
on public.companion_repairs
for select
using (
  public.is_companion_team_member(team_id)
);

create policy "members can read help requests"
on public.companion_help_requests
for select
using (
  public.is_companion_team_member(team_id)
);
