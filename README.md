# QuizIt + Supabase

1. Create a Supabase project, then open its SQL Editor and run [`supabase/schema.sql`](supabase/schema.sql).
2. In Supabase Authentication settings, add your deployed site URL and the local URL you use for development to **Redirect URLs**. Email confirmation is supported; turn it off for a quicker local demo if desired.
3. Replace both placeholders in `supabase-config.js` with the Project URL and **publishable/anon** key from Supabase's Connect dialog. Never put a `service_role` key in this file.
4. Serve the folder through a local web server (rather than opening the files directly), for example: `python3 -m http.server 8000`.

The app now supports email/password signup and login, creates a profile with the chosen role, fetches the published `human-body` quiz from the database, and saves completed attempts for signed-in users. Row-level security limits profiles and attempts to their owner. Quiz content is publicly readable only when published.

## Dashboards

`dashboard.html` shows the dashboard appropriate to the profile role selected during signup. Students see their completed attempts and score summary; educators see quizzes they own and their learner attempt totals. If `schema.sql` was already run before this dashboard was added, also run `supabase/002_teacher_dashboard.sql` in the SQL Editor to allow educators to read attempts for their own quizzes.

## Teacher quiz builder

Educators can use **Create a quiz** on their dashboard to add a title, category, timer, and one or more four-option questions. Published quizzes can be opened from the educator dashboard and shared using their `quiz.html?quiz=...` URL. If the original schema is already installed, run `supabase/003_quiz_builder.sql` in the SQL Editor before using this feature; it grants educators access only to create and manage their own quizzes and questions.
