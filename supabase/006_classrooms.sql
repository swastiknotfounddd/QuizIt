-- Classroom-scoped quiz delivery.
-- Run this after schema.sql and migrations 002–005.

create table public.classrooms (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 100),
  description text,
  join_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
  created_at timestamptz not null default now()
);

create table public.classroom_members (
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (classroom_id, student_id)
);

-- One quiz may be published to one or more classrooms.
create table public.quiz_classrooms (
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  published_at timestamptz not null default now(),
  primary key (quiz_id, classroom_id)
);

create index classrooms_teacher_id_idx on public.classrooms(teacher_id);
create index classroom_members_student_id_idx on public.classroom_members(student_id);
create index quiz_classrooms_classroom_id_idx on public.quiz_classrooms(classroom_id);

alter table public.classrooms enable row level security;
alter table public.classroom_members enable row level security;
alter table public.quiz_classrooms enable row level security;

create policy "Educators create classrooms" on public.classrooms
  for insert to authenticated
  with check (
    teacher_id = auth.uid()
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'educator')
  );

create policy "Educators manage their classrooms" on public.classrooms
  for all to authenticated
  using (teacher_id = auth.uid())
  with check (
    teacher_id = auth.uid()
    and exists (select 1 from public.profiles where id = auth.uid() and role = 'educator')
  );

create policy "Members view their classrooms" on public.classrooms
  for select to authenticated
  using (
    exists (
      select 1 from public.classroom_members cm
      where cm.classroom_id = classrooms.id and cm.student_id = auth.uid()
    )
  );

create policy "Students view their memberships" on public.classroom_members
  for select to authenticated using (student_id = auth.uid());

create policy "Educators view classroom members" on public.classroom_members
  for select to authenticated
  using (
    exists (
      select 1 from public.classrooms c
      where c.id = classroom_members.classroom_id and c.teacher_id = auth.uid()
    )
  );

create policy "Educators remove classroom members" on public.classroom_members
  for delete to authenticated
  using (
    exists (
      select 1 from public.classrooms c
      where c.id = classroom_members.classroom_id and c.teacher_id = auth.uid()
    )
  );

create policy "Educators manage their classroom quiz assignments" on public.quiz_classrooms
  for all to authenticated
  using (
    exists (
      select 1 from public.classrooms c
      join public.quizzes q on q.id = quiz_classrooms.quiz_id
      where c.id = quiz_classrooms.classroom_id
        and c.teacher_id = auth.uid()
        and q.created_by = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.classrooms c
      join public.quizzes q on q.id = quiz_classrooms.quiz_id
      where c.id = quiz_classrooms.classroom_id
        and c.teacher_id = auth.uid()
        and q.created_by = auth.uid()
    )
  );

create policy "Students view assigned classroom quizzes" on public.quiz_classrooms
  for select to authenticated
  using (
    exists (
      select 1 from public.classroom_members cm
      where cm.classroom_id = quiz_classrooms.classroom_id and cm.student_id = auth.uid()
    )
  );

-- Students join with a code, never by inserting an arbitrary membership row.
create or replace function public.join_classroom_by_code(input_code text)
returns public.classrooms
language plpgsql
security definer
set search_path = public
as $$
declare
  target_classroom public.classrooms;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'student') then
    raise exception 'Only student accounts can join a classroom';
  end if;

  select * into target_classroom
  from public.classrooms
  where join_code = upper(trim(input_code));

  if target_classroom.id is null then
    raise exception 'Invalid classroom code';
  end if;

  insert into public.classroom_members (classroom_id, student_id)
  values (target_classroom.id, auth.uid())
  on conflict (classroom_id, student_id) do nothing;

  return target_classroom;
end;
$$;

create or replace function public.leave_classroom(target_classroom_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.classroom_members
  where classroom_id = target_classroom_id and student_id = auth.uid();
$$;

revoke all on function public.join_classroom_by_code(text) from public;
revoke all on function public.leave_classroom(uuid) from public;
grant execute on function public.join_classroom_by_code(text) to authenticated;
grant execute on function public.leave_classroom(uuid) to authenticated;

-- A published quiz is now visible to its owner, the initial demo quiz, or
-- students enrolled in a classroom it is assigned to.
drop policy if exists "Anyone can read published quizzes" on public.quizzes;
create policy "Users read accessible quizzes" on public.quizzes for select to authenticated using (
  created_by = auth.uid()
  or slug = 'human-body'
  or (
    is_published and exists (
      select 1
      from public.quiz_classrooms qc
      join public.classroom_members cm on cm.classroom_id = qc.classroom_id
      where qc.quiz_id = quizzes.id and cm.student_id = auth.uid()
    )
  )
);

drop policy if exists "Anyone can read questions for published quizzes" on public.questions;
create policy "Users read questions for accessible quizzes" on public.questions for select to authenticated using (
  exists (
    select 1 from public.quizzes q
    where q.id = questions.quiz_id
      and (
        q.created_by = auth.uid()
        or q.slug = 'human-body'
        or (
          q.is_published and exists (
            select 1
            from public.quiz_classrooms qc
            join public.classroom_members cm on cm.classroom_id = qc.classroom_id
            where qc.quiz_id = q.id and cm.student_id = auth.uid()
          )
        )
      )
  )
);
