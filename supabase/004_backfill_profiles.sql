-- Run once in Supabase SQL Editor to create profiles for accounts made before
-- the handle_new_user trigger was installed.
insert into public.profiles (id, email, role)
select
  id,
  email,
  case
    when raw_user_meta_data ->> 'role' = 'educator' then 'educator'::public.user_role
    else 'student'::public.user_role
  end
from auth.users
where email is not null
on conflict (id) do nothing;
