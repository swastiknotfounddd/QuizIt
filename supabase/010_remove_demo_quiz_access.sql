-- Remove the special-case access granted to the original human-body demo quiz.
-- Students can read published quizzes and questions only when assigned through
-- a classroom they have joined.
drop policy if exists "Users read accessible quizzes" on public.quizzes;
create policy "Users read accessible quizzes" on public.quizzes
for select to authenticated using (
  created_by = auth.uid()
  or (
    is_published and exists (
      select 1
      from public.quiz_classrooms qc
      join public.classroom_members cm on cm.classroom_id = qc.classroom_id
      where qc.quiz_id = quizzes.id and cm.student_id = auth.uid()
    )
  )
);

drop policy if exists "Users read questions for accessible quizzes" on public.questions;
create policy "Users read questions for accessible quizzes" on public.questions
for select to authenticated using (
  exists (
    select 1
    from public.quizzes q
    where q.id = questions.quiz_id
      and (
        q.created_by = auth.uid()
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

-- Remove the demo content already created by earlier schema versions.
delete from public.questions
where quiz_id in (select id from public.quizzes where slug = 'human-body');

delete from public.quizzes where slug = 'human-body';
