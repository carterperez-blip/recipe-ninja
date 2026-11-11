-- Recipe Ninja database schema. Run once in the Supabase SQL editor.
-- Every row belongs to one user and is protected by row-level security,
-- so only the signed-in owner can read or change it.

create table if not exists public.recipes (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title         text not null,
  source_url    text,
  image_url     text,
  -- { name, url, source } when the picture came from Pexels or Unsplash
  image_credit  jsonb,
  base_servings numeric not null default 2 check (base_servings > 0),
  prep_minutes  integer check (prep_minutes >= 0),
  cook_minutes  integer check (cook_minutes >= 0),
  -- [{ quantity, quantityMax, unit, name, note, scalable }]
  ingredients   jsonb not null default '[]'::jsonb,
  -- [{ text }]
  steps         jsonb not null default '[]'::jsonb,
  tags          text[] not null default '{}',
  notes         text not null default '',
  rating        smallint check (rating between 1 and 5),
  favorite      boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- for projects created before picture credits existed
alter table public.recipes add column if not exists image_credit jsonb;

create index if not exists recipes_user_idx on public.recipes (user_id, created_at desc);
create index if not exists recipes_tags_idx on public.recipes using gin (tags);

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists recipes_touch on public.recipes;
create trigger recipes_touch before update on public.recipes
  for each row execute function public.touch_updated_at();

alter table public.recipes enable row level security;

drop policy if exists "recipes: owner full access" on public.recipes;
create policy "recipes: owner full access" on public.recipes
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Grocery list (one row per item, optionally linked to a recipe)
create table if not exists public.grocery_items (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  recipe_id  uuid references public.recipes (id) on delete set null,
  text       text not null,           -- plain-text version, for reading the table
  name       text,                    -- item name without amounts
  quantity   numeric,                 -- null when the item has no amount
  unit       text,                    -- canonical unit key, null for counted items
  recipes    text[] not null default '{}',  -- titles of the recipes it is for
  checked    boolean not null default false,
  created_at timestamptz not null default now()
);

-- for projects created before the grocery list was built
alter table public.grocery_items add column if not exists name text;
alter table public.grocery_items add column if not exists quantity numeric;
alter table public.grocery_items add column if not exists unit text;
alter table public.grocery_items add column if not exists recipes text[] not null default '{}';
alter table public.grocery_items enable row level security;
drop policy if exists "grocery: owner full access" on public.grocery_items;
create policy "grocery: owner full access" on public.grocery_items
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Meal plan
create table if not exists public.meal_plan (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  day       date not null,
  servings  numeric not null default 2 check (servings > 0)
);
alter table public.meal_plan enable row level security;
drop policy if exists "meal_plan: owner full access" on public.meal_plan;
create policy "meal_plan: owner full access" on public.meal_plan
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Monthly AI spend, for the $10 cap. Written only by the server (service role);
-- the owner may read it to show usage in the app.
create table if not exists public.ai_usage (
  user_id  uuid not null references auth.users (id) on delete cascade,
  month    text not null,                 -- e.g. '2026-11'
  cost_usd numeric not null default 0,
  primary key (user_id, month)
);
alter table public.ai_usage enable row level security;
drop policy if exists "ai_usage: owner read" on public.ai_usage;
create policy "ai_usage: owner read" on public.ai_usage
  for select to authenticated using (user_id = auth.uid());

-- Recipe pictures. Files live under <user id>/<file>.
insert into storage.buckets (id, name, public)
values ('recipe-images', 'recipe-images', true)
on conflict (id) do nothing;

drop policy if exists "recipe-images: owner write" on storage.objects;
create policy "recipe-images: owner write" on storage.objects
  for all to authenticated
  using (bucket_id = 'recipe-images' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'recipe-images' and (storage.foldername(name))[1] = auth.uid()::text);
