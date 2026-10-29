-- Add per-class quiz deadlines and enforce them in student access and grading.
-- Run after supabase/011_atomic_quiz_publishing.sql.

alter table public.quiz_classrooms
  add column if not exists deadline timestamptz;

-- New published quizzes must use the deadline-aware creation path.
revoke all on function public.create_quiz_with_content(text, text, text, integer, boolean, jsonb, uuid[]) from public, anon, authenticated;

create or replace function public.create_quiz_with_deadline(
  input_title text,
  input_slug text,
  input_category text,
  input_duration_seconds integer,
  input_is_published boolean,
  input_questions jsonb,
  input_classroom_ids uuid[],
  input_deadline timestamptz
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
  if input_is_published and input_deadline is null then
    raise exception 'A published quiz must have a deadline';
  end if;
  if input_is_published and input_deadline <= now() then
    raise exception 'A published quiz deadline must be in the future';
  end if;

  new_quiz_id := public.create_quiz_with_content(
    input_title,
    input_slug,
    input_category,
    input_duration_seconds,
    input_is_published,
    input_questions,
    input_classroom_ids
  );

  if input_is_published then
    update public.quiz_classrooms
    set deadline = input_deadline
    where quiz_id = new_quiz_id;
  end if;

  return new_quiz_id;
end;
$$;
revoke all on function public.create_quiz_with_deadline(text, text, text, integer, boolean, jsonb, uuid[], timestamptz) from public;
grant execute on function public.create_quiz_with_deadline(text, text, text, integer, boolean, jsonb, uuid[], timestamptz) to authenticated;

create or replace function public.update_classroom_quiz_deadline(
  target_quiz_id uuid,
  target_classroom_id uuid,
  new_deadline timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if new_deadline is null then
    raise exception 'A classroom quiz must have a deadline';
  end if;

  if auth.uid() is null or not exists (
    select 1
    from public.quiz_classrooms qc
    join public.classrooms c on c.id = qc.classroom_id
    join public.quizzes q on q.id = qc.quiz_id
    where qc.quiz_id = target_quiz_id
      and qc.classroom_id = target_classroom_id
      and c.teacher_id = auth.uid()
      and q.created_by = auth.uid()
  ) then
    raise exception 'Only the quiz owner can change its deadline for this classroom';
  end if;

  update public.quiz_classrooms
  set deadline = new_deadline
  where quiz_id = target_quiz_id and classroom_id = target_classroom_id;
end;
$$;
revoke all on function public.update_classroom_quiz_deadline(uuid, uuid, timestamptz) from public;
grant execute on function public.update_classroom_quiz_deadline(uuid, uuid, timestamptz) to authenticated;

-- Hide expired quizzes and questions from students, including direct URL/API access.
drop policy if exists "Users read accessible quizzes" on public.quizzes;
create policy "Users read accessible quizzes" on public.quizzes
for select to authenticated using (
  created_by = auth.uid()
  or (
    is_published and exists (
      select 1
      from public.quiz_classrooms qc
      join public.classroom_members cm on cm.classroom_id = qc.classroom_id
      where qc.quiz_id = quizzes.id
        and cm.student_id = auth.uid()
        and (qc.deadline is null or qc.deadline > now())
    )
  )
);

drop policy if exists "Users read questions for accessible quizzes" on public.questions;
create policy "Users read questions for accessible quizzes" on public.questions
for select to authenticated using (
  exists (
    select 1 from public.quizzes q
    where q.id = questions.quiz_id
      and (
        q.created_by = auth.uid()
        or (
          q.is_published and exists (
            select 1
            from public.quiz_classrooms qc
            join public.classroom_members cm on cm.classroom_id = qc.classroom_id
            where qc.quiz_id = q.id
              and cm.student_id = auth.uid()
              and (qc.deadline is null or qc.deadline > now())
          )
        )
      )
  )
);

-- Wrap the original grader with a deadline check, then remove direct access to it.
alter function public.submit_quiz_attempt(uuid, jsonb, boolean)
  rename to submit_quiz_attempt_unchecked;
revoke all on function public.submit_quiz_attempt_unchecked(uuid, jsonb, boolean) from public, anon, authenticated;

create function public.submit_quiz_attempt(
  input_quiz_id uuid,
  input_answers jsonb,
  input_timed_out boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if auth.uid() is null or not exists (
    select 1
    from public.quiz_classrooms qc
    join public.classroom_members cm on cm.classroom_id = qc.classroom_id
    where qc.quiz_id = input_quiz_id
      and cm.student_id = auth.uid()
      and (qc.deadline is null or qc.deadline > now())
  ) then
    raise exception 'The deadline for this quiz has passed or it is not assigned to you';
  end if;

  return public.submit_quiz_attempt_unchecked(
    input_quiz_id,
    input_answers,
    input_timed_out
  );
end;
$$;
revoke all on function public.submit_quiz_attempt(uuid, jsonb, boolean) from public;
grant execute on function public.submit_quiz_attempt(uuid, jsonb, boolean) to authenticated;

notify pgrst, 'reload schema';
