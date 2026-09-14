-- Run this in Supabase SQL Editor after schema.sql when adding the quiz builder.
create policy "Educators can create quizzes" on public.quizzes for insert with check (
  auth.uid() = created_by and exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'educator')
);
create policy "Educators can update their quizzes" on public.quizzes for update using (
  auth.uid() = created_by and exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'educator')
);
create policy "Educators can delete their quizzes" on public.quizzes for delete using (
  auth.uid() = created_by and exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'educator')
);
create policy "Educators can create questions for their quizzes" on public.questions for insert with check (
  exists (select 1 from public.quizzes join public.profiles on profiles.id = quizzes.created_by where quizzes.id = questions.quiz_id and quizzes.created_by = auth.uid() and profiles.role = 'educator')
);
create policy "Educators can update questions for their quizzes" on public.questions for update using (
  exists (select 1 from public.quizzes join public.profiles on profiles.id = quizzes.created_by where quizzes.id = questions.quiz_id and quizzes.created_by = auth.uid() and profiles.role = 'educator')
);
create policy "Educators can delete questions for their quizzes" on public.questions for delete using (
  exists (select 1 from public.quizzes join public.profiles on profiles.id = quizzes.created_by where quizzes.id = questions.quiz_id and quizzes.created_by = auth.uid() and profiles.role = 'educator')
);
