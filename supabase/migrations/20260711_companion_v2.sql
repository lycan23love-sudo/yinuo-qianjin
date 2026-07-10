-- 同行 V2：用户小队、留笺、修诺与按需同行
-- 独立于具体誓言；小队只由用户组成，打卡数据只用于计算每日落印。

create table if not exists public.companion_teams (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null default '同行小队',
  invite_code text not null unique default upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8)),
  capacity integer not null default 5 check (capacity between 2 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.companion_team_members (
  team_id uuid not null references public.companion_teams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

create table if not exists public.companion_team_notes (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.companion_teams(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid references public.profiles(id) on delete set null,
  note_date date not null default current_date,
  kind text not null default 'note' check (kind in ('note', 'team_note', 'encourage')),
  body text not null check (char_length(body) between 1 and 50),
  created_at timestamptz not null default now()
);

create table if not exists public.companion_repairs (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.companion_teams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan text not null check (char_length(plan) between 1 and 80),
  repair_date date not null default current_date,
  status text not null default 'active' check (status in ('active', 'done', 'expired')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.companion_help_requests (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.companion_teams(id) on delete cascade,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  help_type text not null check (help_type in ('focus', 'stuck', 'repair', 'supervision')),
  status text not null default 'open' check (status in ('open', 'accepted', 'closed', 'expired')),
  responder_id uuid references public.profiles(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '2 hours'),
  created_at timestamptz not null default now()
);

create index if not exists companion_team_members_user_idx on public.companion_team_members(user_id);
create index if not exists companion_team_notes_team_date_idx on public.companion_team_notes(team_id, note_date desc);
create index if not exists companion_repairs_team_date_idx on public.companion_repairs(team_id, repair_date desc);
create index if not exists companion_help_requests_team_status_idx on public.companion_help_requests(team_id, status);

alter table public.companion_teams enable row level security;
alter table public.companion_team_members enable row level security;
alter table public.companion_team_notes enable row level security;
alter table public.companion_repairs enable row level security;
alter table public.companion_help_requests enable row level security;

create policy "team members can read teams" on public.companion_teams for select using (
  exists (select 1 from public.companion_team_members m where m.team_id = id and m.user_id = auth.uid())
);
create policy "users can create teams" on public.companion_teams for insert with check (owner_id = auth.uid());
create policy "owners can update teams" on public.companion_teams for update using (owner_id = auth.uid());

create policy "members can read membership" on public.companion_team_members for select using (
  exists (select 1 from public.companion_team_members mine where mine.team_id = team_id and mine.user_id = auth.uid())
);
create policy "users can join as themselves" on public.companion_team_members for insert with check (user_id = auth.uid());

create policy "members can read notes" on public.companion_team_notes for select using (
  exists (select 1 from public.companion_team_members m where m.team_id = team_id and m.user_id = auth.uid())
);
create policy "members can leave notes" on public.companion_team_notes for insert with check (
  author_id = auth.uid() and exists (select 1 from public.companion_team_members m where m.team_id = team_id and m.user_id = auth.uid())
);

create policy "members can read repairs" on public.companion_repairs for select using (
  exists (select 1 from public.companion_team_members m where m.team_id = team_id and m.user_id = auth.uid())
);
create policy "users can start repairs" on public.companion_repairs for insert with check (
  user_id = auth.uid() and exists (select 1 from public.companion_team_members m where m.team_id = team_id and m.user_id = auth.uid())
);
create policy "users can finish own repairs" on public.companion_repairs for update using (user_id = auth.uid());

create policy "members can read help requests" on public.companion_help_requests for select using (
  exists (select 1 from public.companion_team_members m where m.team_id = team_id and m.user_id = auth.uid())
);
create policy "users can ask for help" on public.companion_help_requests for insert with check (
  requester_id = auth.uid() and exists (select 1 from public.companion_team_members m where m.team_id = team_id and m.user_id = auth.uid())
);
create policy "members can respond to help" on public.companion_help_requests for update using (
  exists (select 1 from public.companion_team_members m where m.team_id = team_id and m.user_id = auth.uid())
);

-- 将已有的誓言同行关系迁移为独立用户小队。之后小队不会再依赖某条誓言。
insert into public.companion_teams (owner_id, name)
select distinct p.user_id, coalesce(pr.nickname, '行者') || '的小队'
from public.pledges p
join public.witnesses w on w.pledge_id = p.id and coalesce(w.status, 'active') = 'active'
left join public.profiles pr on pr.id = p.user_id
where not exists (select 1 from public.companion_teams t where t.owner_id = p.user_id);

insert into public.companion_team_members (team_id, user_id, role)
select t.id, t.owner_id, 'owner'
from public.companion_teams t
on conflict do nothing;

insert into public.companion_team_members (team_id, user_id, role)
select distinct t.id, w.user_id, 'member'
from public.companion_teams t
join public.pledges p on p.user_id = t.owner_id
join public.witnesses w on w.pledge_id = p.id and coalesce(w.status, 'active') = 'active'
where w.user_id <> t.owner_id
on conflict do nothing;
