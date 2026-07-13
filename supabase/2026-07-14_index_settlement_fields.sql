-- 自律指数结算字段兜底。
-- 如果 index_bets 已经包含这些字段，重复执行不会改变现有数据。

alter table public.index_bets
  add column if not exists status text not null default 'active',
  add column if not exists payout integer not null default 0,
  add column if not exists settled_at timestamptz,
  add column if not exists bet_date date not null default current_date;

create index if not exists index_bets_active_created_idx
  on public.index_bets(index_code, status, created_at);

