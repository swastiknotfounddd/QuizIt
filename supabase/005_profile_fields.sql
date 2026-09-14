-- Run this in Supabase SQL Editor after schema.sql to collect profile details at signup.
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists age smallint check (age is null or age between 5 and 120);
alter table public.profiles add column if not exists school text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, role, full_name, age, school)
  values (
    new.id,
    new.email,
    case when new.raw_user_meta_data ->> 'role' = 'educator' then 'educator'::public.user_role else 'student'::public.user_role end,
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    case when new.raw_user_meta_data ->> 'age' ~ '^[0-9]+$' and (new.raw_user_meta_data ->> 'age')::integer between 5 and 120 then (new.raw_user_meta_data ->> 'age')::smallint else null end,
    nullif(trim(new.raw_user_meta_data ->> 'school'), '')
  );
  return new;
end;
$$;
