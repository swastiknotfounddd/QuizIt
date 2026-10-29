-- Create the quiz, its questions, and classroom assignments as one transaction.
-- Run after supabase/010_remove_demo_quiz_access.sql.

drop function if exists public.create_quiz(text, text, text, integer, boolean);
drop policy if exists "Educators can create quizzes" on public.quizzes;
drop policy if exists "Educators can create questions for their quizzes" on public.questions;
revoke insert on public.quizzes from authenticated;
revoke insert on public.questions from authenticated;

-- New join codes use more random characters; existing shared codes keep working.
alter table public.classrooms
  alter column join_code set default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

-- Learners can fetch question content, but only the grading function can read answers.
revoke select on public.questions from public, anon, authenticated;
grant select (quiz_id, position, text, answers) on public.questions to authenticated;

-- Scores must be computed from stored answer keys, never trusted from the browser.
drop policy if exists "Users can save their attempts" on public.attempts;
revoke insert on public.attempts from public, anon, authenticated;
create or replace function public.submit_quiz_attempt(
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
declare
  answer_key record;
  selected_answer jsonb;
  total integer;
  earned integer := 0;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'student'
  ) then
    raise exception 'Only students can submit quiz attempts';
  end if;

  if not exists (
    select 1
    from public.quizzes q
    join public.quiz_classrooms qc on qc.quiz_id = q.id
    join public.classroom_members cm on cm.classroom_id = qc.classroom_id
    where q.id = input_quiz_id
      and q.is_published
      and cm.student_id = auth.uid()
  ) then
    raise exception 'This quiz is not assigned to one of your classrooms';
  end if;

  if input_answers is null or jsonb_typeof(input_answers) is distinct from 'array' then
    raise exception 'Answers must be submitted as a list';
  end if;
  if input_timed_out is null then
    raise exception 'Quiz completion status is required';
  end if;

  select count(*) into total from public.questions where quiz_id = input_quiz_id;
  if total < 1 or jsonb_array_length(input_answers) <> total then
    raise exception 'The submitted answers do not match this quiz';
  end if;

  for answer_key in
    select q.correct_answer, row_number() over (order by q.position)::integer as answer_position
    from public.questions q
    where q.quiz_id = input_quiz_id
    order by q.position
  loop
    selected_answer := input_answers -> (answer_key.answer_position - 1);
    if jsonb_typeof(selected_answer) = 'null' and input_timed_out then
      continue;
    end if;
    if jsonb_typeof(selected_answer) is distinct from 'number'
       or (selected_answer #>> '{}') !~ '^[0-3]$' then
      raise exception 'Every answer must be a valid option';
    end if;
    if (selected_answer #>> '{}')::smallint = answer_key.correct_answer then
      earned := earned + 1;
    end if;
  end loop;

  insert into public.attempts (
    user_id, quiz_id, answers, score, total_questions, timed_out
  ) values (
    auth.uid(), input_quiz_id, input_answers, earned, total, input_timed_out
  );

  return jsonb_build_object('score', earned, 'total_questions', total);
end;
$$;
revoke all on function public.submit_quiz_attempt(uuid, jsonb, boolean) from public;
grant execute on function public.submit_quiz_attempt(uuid, jsonb, boolean) to authenticated;

-- Joining should report success without returning the classroom row or its join code.
drop function if exists public.join_classroom_by_code(text);
create function public.join_classroom_by_code(input_code text)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  target_classroom_id uuid;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'student'
  ) then
    raise exception 'Only student accounts can join a classroom';
  end if;

  select id into target_classroom_id
  from public.classrooms
  where join_code = upper(trim(input_code));

  if target_classroom_id is null then
    raise exception 'Invalid classroom code';
  end if;

  insert into public.classroom_members (classroom_id, student_id)
  values (target_classroom_id, auth.uid())
  on conflict (classroom_id, student_id) do nothing;
end;
$$;
revoke all on function public.join_classroom_by_code(text) from public;
grant execute on function public.join_classroom_by_code(text) to authenticated;

create or replace function public.create_quiz_with_content(
  input_title text,
  input_slug text,
  input_category text,
  input_duration_seconds integer,
  input_is_published boolean,
  input_questions jsonb,
  input_classroom_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  new_quiz_id uuid;
  question jsonb;
  classroom_count integer;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'educator'
  ) then
    raise exception 'Only educator accounts can create quizzes';
  end if;

  if nullif(trim(input_title), '') is null
     or nullif(trim(input_category), '') is null
     or nullif(trim(input_slug), '') is null then
    raise exception 'Quiz title, category, and slug are required';
  end if;
  if char_length(trim(input_title)) > 100 or char_length(trim(input_category)) > 50 then
    raise exception 'Quiz title or category is too long';
  end if;

  if input_duration_seconds is null or input_duration_seconds < 60 or input_duration_seconds > 10800 then
    raise exception 'Quiz duration must be between 1 and 180 minutes';
  end if;

  if input_questions is null or jsonb_typeof(input_questions) is distinct from 'array' then
    raise exception 'Questions must be provided as a list';
  end if;
  if jsonb_array_length(input_questions) < 1 or jsonb_array_length(input_questions) > 100 then
    raise exception 'A quiz must contain between 1 and 100 questions';
  end if;

  for question in select value from jsonb_array_elements(input_questions)
  loop
    if jsonb_typeof(question) is distinct from 'object'
       or jsonb_typeof(question->'text') is distinct from 'string'
       or nullif(trim(question->>'text'), '') is null
       or char_length(question->>'text') > 500 then
      raise exception 'Every question needs text';
    end if;

    if jsonb_typeof(question->'answers') is distinct from 'array' then
      raise exception 'Every question must have four answer options';
    end if;
    if jsonb_array_length(question->'answers') <> 4 then
      raise exception 'Every question must have four answer options';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(question->'answers') as answer(value)
      where jsonb_typeof(answer.value) is distinct from 'string'
         or nullif(trim(answer.value #>> '{}'), '') is null
         or char_length(answer.value #>> '{}') > 250
    ) then
      raise exception 'Answer options cannot be empty';
    end if;

    if coalesce(question->>'correct_answer', '') !~ '^[0-3]$' then
      raise exception 'Select a valid correct answer for every question';
    end if;
  end loop;

  if input_is_published then
    if coalesce(cardinality(input_classroom_ids), 0) = 0 then
      raise exception 'Select at least one classroom before publishing';
    end if;

    select count(*) into classroom_count
    from public.classrooms
    where id = any(input_classroom_ids)
      and teacher_id = auth.uid();

    if classroom_count <> cardinality(input_classroom_ids) then
      raise exception 'One or more selected classrooms are unavailable';
    end if;
  end if;

  insert into public.quizzes (
    title, slug, category, duration_seconds, is_published, created_by
  ) values (
    trim(input_title), trim(input_slug), trim(input_category),
    input_duration_seconds, input_is_published, auth.uid()
  ) returning id into new_quiz_id;

  insert into public.questions (quiz_id, position, text, answers, correct_answer)
  select
    new_quiz_id,
    item.ordinality::smallint,
    trim(item.value->>'text'),
    item.value->'answers',
    (item.value->>'correct_answer')::smallint
  from jsonb_array_elements(input_questions) with ordinality as item(value, ordinality);

  if input_is_published then
    insert into public.quiz_classrooms (quiz_id, classroom_id)
    select new_quiz_id, selected.classroom_id
    from unnest(input_classroom_ids) as selected(classroom_id);
  end if;

  return new_quiz_id;
end;
$$;

revoke all on function public.create_quiz_with_content(text, text, text, integer, boolean, jsonb, uuid[]) from public;
grant execute on function public.create_quiz_with_content(text, text, text, integer, boolean, jsonb, uuid[]) to authenticated;

notify pgrst, 'reload schema';
