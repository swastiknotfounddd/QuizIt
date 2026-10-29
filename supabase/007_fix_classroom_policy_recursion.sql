-- Break recursive Row Level Security checks across the classroom and quiz tables.
-- Run this after supabase/006_classrooms.sql.

create or replace function public.is_current_user_classroom_member(target_classroom_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.classroom_members cm
    where cm.classroom_id = target_classroom_id
      and cm.student_id = auth.uid()
  );
$$;

create or replace function public.is_current_user_classroom_teacher(target_classroom_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.classrooms c
    where c.id = target_classroom_id
      and c.teacher_id = auth.uid()
  );
$$;

create or replace function public.is_current_user_quiz_owner(target_quiz_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.quizzes q
    where q.id = target_quiz_id
      and q.created_by = auth.uid()
  );
$$;

revoke all on function public.is_current_user_classroom_member(uuid) from public;
revoke all on function public.is_current_user_classroom_teacher(uuid) from public;
revoke all on function public.is_current_user_quiz_owner(uuid) from public;
grant execute on function public.is_current_user_classroom_member(uuid) to authenticated;
grant execute on function public.is_current_user_classroom_teacher(uuid) to authenticated;
grant execute on function public.is_current_user_quiz_owner(uuid) to authenticated;

drop policy if exists "Members view their classrooms" on public.classrooms;
create policy "Members view their classrooms" on public.classrooms
  for select to authenticated
  using (public.is_current_user_classroom_member(id));

drop policy if exists "Educators view classroom members" on public.classroom_members;
create policy "Educators view classroom members" on public.classroom_members
  for select to authenticated
  using (public.is_current_user_classroom_teacher(classroom_id));

drop policy if exists "Educators remove classroom members" on public.classroom_members;
create policy "Educators remove classroom members" on public.classroom_members
  for delete to authenticated
  using (public.is_current_user_classroom_teacher(classroom_id));

drop policy if exists "Educators manage their classroom quiz assignments" on public.quiz_classrooms;
create policy "Educators manage their classroom quiz assignments" on public.quiz_classrooms
  for all to authenticated
  using (
    public.is_current_user_classroom_teacher(classroom_id)
    and public.is_current_user_quiz_owner(quiz_id)
  )
  with check (
    public.is_current_user_classroom_teacher(classroom_id)
    and public.is_current_user_quiz_owner(quiz_id)
  );
