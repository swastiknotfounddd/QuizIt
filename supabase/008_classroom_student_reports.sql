-- Let classroom educators see student names for their own classroom reports.
-- Run this after supabase/007_fix_classroom_policy_recursion.sql.

create or replace function public.get_classroom_student_roster(target_classroom_id uuid)
returns table (
  student_id uuid,
  student_name text,
  joined_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
begin
  if auth.uid() is null or not exists (
    select 1
    from public.classrooms c
    where c.id = target_classroom_id
      and c.teacher_id = auth.uid()
  ) then
    raise exception 'Only the classroom educator can view its student report';
  end if;

  return query
    select
      cm.student_id,
      coalesce(nullif(trim(p.full_name), ''), 'Student'),
      cm.joined_at
    from public.classroom_members cm
    join public.profiles p on p.id = cm.student_id
    where cm.classroom_id = target_classroom_id
    order by p.full_name nulls last, cm.joined_at;
end;
$$;

revoke all on function public.get_classroom_student_roster(uuid) from public;
grant execute on function public.get_classroom_student_roster(uuid) to authenticated;
