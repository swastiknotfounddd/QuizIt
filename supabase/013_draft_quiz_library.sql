-- Allow educators to securely resume and update their own draft quizzes.
-- Run after supabase/012_quiz_deadlines.sql.

create or replace function public.get_draft_quiz_for_edit(target_quiz_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  draft jsonb;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles where id = auth.uid() and role = 'educator'
  ) then
    raise exception 'Only educators can resume a quiz draft';
  end if;

  select jsonb_build_object(
    'id', q.id,
    'slug', q.slug,
    'title', q.title,
    'category', q.category,
    'duration_seconds', q.duration_seconds,
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'position', question.position,
        'text', question.text,
        'answers', question.answers,
        'correct_answer', question.correct_answer
      ) order by question.position)
      from public.questions question
      where question.quiz_id = q.id
    ), '[]'::jsonb)
  ) into draft
  from public.quizzes q
  where q.id = target_quiz_id
    and q.created_by = auth.uid()
    and not q.is_published;

  if draft is null then
    raise exception 'Draft not found or it is no longer editable';
  end if;
  return draft;
end;
$$;
revoke all on function public.get_draft_quiz_for_edit(uuid) from public;
grant execute on function public.get_draft_quiz_for_edit(uuid) to authenticated;

create or replace function public.update_draft_quiz(
  input_quiz_id uuid,
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
  question jsonb;
  classroom_count integer;
  updated_quiz_id uuid;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles where id = auth.uid() and role = 'educator'
  ) then
    raise exception 'Only educators can update quizzes';
  end if;

  if not exists (
    select 1 from public.quizzes
    where id = input_quiz_id and created_by = auth.uid() and not is_published
  ) then
    raise exception 'Draft not found or it is no longer editable';
  end if;

  if nullif(trim(input_title), '') is null
     or nullif(trim(input_category), '') is null
     or nullif(trim(input_slug), '') is null
     or char_length(trim(input_title)) > 100
     or char_length(trim(input_category)) > 50 then
    raise exception 'Quiz title and category are required and must fit their limits';
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
    if input_deadline is null or input_deadline <= now() then
      raise exception 'Choose a future deadline before publishing';
    end if;
    if coalesce(cardinality(input_classroom_ids), 0) = 0 then
      raise exception 'Select at least one classroom before publishing';
    end if;
    select count(*) into classroom_count
    from public.classrooms
    where id = any(input_classroom_ids) and teacher_id = auth.uid();
    if classroom_count <> cardinality(input_classroom_ids) then
      raise exception 'One or more selected classrooms are unavailable';
    end if;
  end if;

  update public.quizzes
  set title = trim(input_title),
      slug = trim(input_slug),
      category = trim(input_category),
      duration_seconds = input_duration_seconds,
      is_published = input_is_published
  where id = input_quiz_id and created_by = auth.uid() and not is_published
  returning id into updated_quiz_id;
  if updated_quiz_id is null then
    raise exception 'Draft is no longer editable';
  end if;

  delete from public.questions where quiz_id = input_quiz_id;
  delete from public.quiz_classrooms where quiz_id = input_quiz_id;
  insert into public.questions (quiz_id, position, text, answers, correct_answer)
  select
    input_quiz_id,
    item.ordinality::smallint,
    trim(item.value->>'text'),
    item.value->'answers',
    (item.value->>'correct_answer')::smallint
  from jsonb_array_elements(input_questions) with ordinality as item(value, ordinality);

  if input_is_published then
    insert into public.quiz_classrooms (quiz_id, classroom_id, deadline)
    select input_quiz_id, selected.classroom_id, input_deadline
    from unnest(input_classroom_ids) as selected(classroom_id);
  end if;

  return input_quiz_id;
end;
$$;
revoke all on function public.update_draft_quiz(uuid, text, text, text, integer, boolean, jsonb, uuid[], timestamptz) from public;
grant execute on function public.update_draft_quiz(uuid, text, text, text, integer, boolean, jsonb, uuid[], timestamptz) to authenticated;

notify pgrst, 'reload schema';
