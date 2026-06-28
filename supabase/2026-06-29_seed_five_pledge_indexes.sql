-- Seed the five tradable indexes that match the pledge taxonomy.
-- Safe to run more than once.

insert into public.index_funds
  (code, name, emoji, live_ratio, prev_ratio, total_bull_pool, total_bear_pool, bull_odds, bear_odds, total_pledges, updated_at)
values
  ('HEALTH',   '健康运动指数', '🏃', 0.72, 0.70, 0, 0, 1.8, 1.8, 0, now()),
  ('STUDY',    '学习成长指数', '📚', 0.68, 0.66, 0, 0, 1.8, 1.8, 0, now()),
  ('HABIT',    '生活习惯指数', '🌅', 0.61, 0.60, 0, 0, 1.8, 1.8, 0, now()),
  ('FINANCE',  '财务目标指数', '💰', 0.58, 0.57, 0, 0, 1.8, 1.8, 0, now()),
  ('CREATIVE', '创作输出指数', '✍️', 0.64, 0.63, 0, 0, 1.8, 1.8, 0, now())
on conflict (code) do update set
  name = excluded.name,
  emoji = excluded.emoji,
  live_ratio = coalesce(public.index_funds.live_ratio, excluded.live_ratio),
  prev_ratio = coalesce(public.index_funds.prev_ratio, excluded.prev_ratio),
  total_bull_pool = coalesce(public.index_funds.total_bull_pool, 0),
  total_bear_pool = coalesce(public.index_funds.total_bear_pool, 0),
  bull_odds = coalesce(public.index_funds.bull_odds, excluded.bull_odds),
  bear_odds = coalesce(public.index_funds.bear_odds, excluded.bear_odds),
  total_pledges = coalesce(public.index_funds.total_pledges, 0),
  updated_at = now();
