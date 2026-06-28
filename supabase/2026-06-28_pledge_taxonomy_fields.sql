-- Add persistent taxonomy fields for pledges.
-- Safe to run more than once.
alter table public.pledges
  add column if not exists category_key text,
  add column if not exists category text,
  add column if not exists category_tag text;

create index if not exists pledges_category_key_idx
  on public.pledges (category_key);

comment on column public.pledges.category_key is 'Unified pledge category key, e.g. health/study/habit/finance/creative/other.';
comment on column public.pledges.category is 'Unified pledge category label shown in the app.';
comment on column public.pledges.category_tag is 'Second-level pledge tag under the category.';
