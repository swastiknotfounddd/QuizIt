-- Run this file in Supabase Dashboard → SQL Editor.
create extension if not exists "pgcrypto";

create type public.user_role as enum ('student', 'educator');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role public.user_role not null default 'student',
  created_at timestamptz not null default now()
);

create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  category text not null,
  duration_seconds integer not null default 300 check (duration_seconds > 0),
  is_published boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  position smallint not null check (position > 0),
  text text not null,
  answers jsonb not null check (jsonb_typeof(answers) = 'array' and jsonb_array_length(answers) >= 2),
  correct_answer smallint not null check (correct_answer >= 0 and correct_answer < jsonb_array_length(answers)),
  unique (quiz_id, position)
);

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  answers jsonb not null default '[]'::jsonb,
  score smallint not null check (score >= 0),
  total_questions smallint not null check (total_questions > 0),
  timed_out boolean not null default false,
  completed_at timestamptz not null default now()
);

create index attempts_user_completed_at_idx on public.attempts (user_id, completed_at desc);

alter table public.profiles enable row level security;
alter table public.quizzes enable row level security;
alter table public.questions enable row level security;
alter table public.attempts enable row level security;

create policy "Users can read their own profile" on public.profiles for select using (auth.uid() = id);
create policy "Anyone can read published quizzes" on public.quizzes for select using (is_published or auth.uid() = created_by);
create policy "Educators can create quizzes" on public.quizzes for insert with check (
  auth.uid() = created_by and exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'educator')
);
create policy "Educators can update their quizzes" on public.quizzes for update using (
  auth.uid() = created_by and exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'educator')
);
create policy "Educators can delete their quizzes" on public.quizzes for delete using (
  auth.uid() = created_by and exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'educator')
);
create policy "Anyone can read questions for published quizzes" on public.questions for select using (
  exists (select 1 from public.quizzes where quizzes.id = questions.quiz_id and (quizzes.is_published or quizzes.created_by = auth.uid()))
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
create policy "Users can read their attempts" on public.attempts for select using (auth.uid() = user_id);
create policy "Users can save their attempts" on public.attempts for insert with check (auth.uid() = user_id);
create policy "Educators can view attempts for their quizzes" on public.attempts for select using (
  exists (
    select 1 from public.quizzes
    join public.profiles on profiles.id = quizzes.created_by
    where quizzes.id = attempts.quiz_id
      and quizzes.created_by = auth.uid()
      and profiles.role = 'educator'
  )
);

create function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'student'));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users for each row execute procedure public.handle_new_user();

-- Initial public quiz used by quiz.html.
insert into public.quizzes (slug, title, category, is_published)
values ('human-body', 'The human body', 'Science', true)
on conflict (slug) do nothing;

insert into public.questions (quiz_id, position, text, answers, correct_answer)
select q.id, v.position, v.text, v.answers::jsonb, v.correct_answer
from public.quizzes q
cross join (values
  (1, 'Which organ pumps blood around the body?', '["The lungs", "The heart", "The brain", "The stomach"]', 1),
  (2, 'What is the largest organ in the human body?', '["The skin", "The liver", "The lungs", "The heart"]', 0),
  (3, 'How many bones does a typical adult human have?', '["106", "206", "306", "406"]', 1),
  (4, 'Which body system carries oxygen and nutrients around the body?', '["Digestive system", "Nervous system", "Circulatory system", "Skeletal system"]', 2),
  (5, 'Which part of the body is responsible for thinking and memory?', '["The brain", "The kidneys", "The muscles", "The pancreas"]', 0)
) as v(position, text, answers, correct_answer)
where q.slug = 'human-body'
  and not exists (select 1 from public.questions existing where existing.quiz_id = q.id);
