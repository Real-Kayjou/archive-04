-- Archive 04: secure project storage
-- Run this in the Supabase SQL Editor, then add your Auth user ID to admin_users.

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.projects (
  id text not null,
  bucket text not null check (bucket in ('archive', 'dead')),
  title text not null,
  type text not null default 'PROJECT / NEW',
  note text not null default '',
  description text not null default '',
  tools jsonb not null default '[]'::jsonb,
  link text not null default '',
  image text not null default '',
  tone text not null default 'iris',
  status text not null default 'in-progress',
  media jsonb not null default '[]'::jsonb,
  logged text not null default '',
  files integer not null default 0,
  sig numeric not null default .5,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (bucket, id)
);

create table if not exists public.admin_action_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  action_name text not null,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;
alter table public.projects enable row level security;

grant usage on schema public to anon, authenticated;
grant select on public.admin_users to authenticated;
grant select on public.projects to anon, authenticated;
grant insert, update, delete on public.projects to authenticated;
revoke all on public.admin_action_log from anon, authenticated;

drop policy if exists "Users can read own admin status" on public.admin_users;
create policy "Users can read own admin status" on public.admin_users
  for select to authenticated using (user_id = auth.uid());

create or replace function public.is_archive_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;

grant execute on function public.is_archive_admin() to authenticated;

create or replace function public.check_admin_rate_limit(action_name text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_count integer;
begin
  if auth.uid() is null or not public.is_archive_admin() then
    return false;
  end if;
  select count(*) into recent_count
    from public.admin_action_log
   where user_id = auth.uid()
     and created_at > now() - interval '1 minute';
  if recent_count >= 30 then
    return false;
  end if;
  insert into public.admin_action_log (user_id, action_name)
  values (auth.uid(), left(coalesce(action_name, 'unknown'), 80));
  return true;
end;
$$;

grant execute on function public.check_admin_rate_limit(text) to authenticated;

create or replace function public.validate_project_input()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if length(trim(new.title)) < 1 or length(new.title) > 120 then
    raise exception 'Project title must be between 1 and 120 characters';
  end if;
  if length(new.note) > 240 or length(new.description) > 2000 or length(new.type) > 120 then
    raise exception 'Project text exceeds the allowed length';
  end if;
  if length(new.link) > 2048 or (new.link <> '' and new.link !~* '^https?://') then
    raise exception 'Project link must be an http or https URL';
  end if;
  if length(new.image) > 7000000 then
    raise exception 'Project image is too large';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_project_input on public.projects;
create trigger validate_project_input
before insert or update on public.projects
for each row execute function public.validate_project_input();

drop policy if exists "Public can read projects" on public.projects;
create policy "Public can read projects" on public.projects
  for select using (true);

drop policy if exists "Admins can insert projects" on public.projects;
create policy "Admins can insert projects" on public.projects
  for insert to authenticated
  with check (exists (select 1 from public.admin_users where user_id = auth.uid()));

drop policy if exists "Admins can update projects" on public.projects;
create policy "Admins can update projects" on public.projects
  for update to authenticated
  using (exists (select 1 from public.admin_users where user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users where user_id = auth.uid()));

drop policy if exists "Admins can delete projects" on public.projects;
create policy "Admins can delete projects" on public.projects
  for delete to authenticated
  using (exists (select 1 from public.admin_users where user_id = auth.uid()));

-- Do not expose admin_users publicly. Add your own user ID manually after signing in:
-- insert into public.admin_users (user_id) values ('YOUR-AUTH-USER-UUID');
