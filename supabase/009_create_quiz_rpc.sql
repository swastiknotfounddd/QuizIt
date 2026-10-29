-- Create quizzes through an authenticated function that sets the owner server-side.
-- Run this after supabase/008_classroom_student_reports.sql.

create or replace function public.create_quiz(
  input_title text,
  input_slug text,
  input_category text,
  input_duration_seconds integer,
  input_is_published boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  new_quiz_id uuid;
begin
  if auth.uid() is null or not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'educator'
  ) then
    raise exception 'Only educator accounts can create quizzes';
  end if;

  insert into public.quizzes (
    title,
    slug,
    category,
    duration_seconds,
    is_published,
    created_by
  )
  values (
    trim(input_title),
    input_slug,
    trim(input_category),
    input_duration_seconds,
    input_is_published,
    auth.uid()
  )
  returning id into new_quiz_id;

  return new_quiz_id;
end;
$$;

revoke all on function public.create_quiz(text, text, text, integer, boolean) from public;
grant execute on function public.create_quiz(text, text, text, integer, boolean) to authenticated;
