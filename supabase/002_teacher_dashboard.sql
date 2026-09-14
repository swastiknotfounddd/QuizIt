-- Run this only if you already ran schema.sql before adding the dashboard.
create policy "Educators can view attempts for their quizzes" on public.attempts for select using (
  exists (
    select 1 from public.quizzes
    join public.profiles on profiles.id = quizzes.created_by
    where quizzes.id = attempts.quiz_id
      and quizzes.created_by = auth.uid()
      and profiles.role = 'educator'
  )
);
