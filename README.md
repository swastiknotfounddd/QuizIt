# QuizIt + Supabase

1. Create a Supabase project, then open its SQL Editor and run [`supabase/schema.sql`](supabase/schema.sql).
2. In Supabase Authentication settings, add your deployed site URL and the local URL you use for development to **Redirect URLs**. Email confirmation is supported; turn it off for a quicker local demo if desired.
3. Replace both placeholders in `supabase-config.js` with the Project URL and **publishable/anon** key from Supabase's Connect dialog. Never put a `service_role` key in this file.
4. Start the local server from inside the `Project QuizIt` folder so it serves the app rather than its parent directory. From the workspace folder, run `cd "Project QuizIt"` and then `python3 -m http.server 8000`. Open `http://localhost:8000/` in your browser. If you are already inside `Project QuizIt`, just run `python3 -m http.server 8000`.

The app supports email/password signup and login, creates a profile with the chosen role, fetches quizzes and questions from the database, and saves completed attempts for signed-in users. Row-level security limits access to data according to the signed-in user's role and relationships. Published classroom quizzes are visible only to enrolled students.

## Dashboards

`dashboard.html` shows the dashboard appropriate to the profile role selected during signup. Students see summary numbers and assigned quizzes, and can open a classroom to see its active quizzes and attempt them. Educators see a classroom list, a quiz library, and a dashboard quiz builder for publishing one quiz to several classrooms. Opening a classroom shows its roster, quiz creation for that class, deadlines, scores, and attempt history. If `schema.sql` was already run before this dashboard was added, also run `supabase/002_teacher_dashboard.sql` in the SQL Editor to allow educators to read attempts for their own quizzes.

## Teacher quiz builder

Educators can use **Create quiz for multiple classes** on their dashboard to build one quiz and publish it to selected classrooms. Inside a classroom, **Create quiz for this class** targets only that class. New published quizzes require a deadline; it can later be changed from the classroom page. Student roster, attempt status, latest scores, and attempt history are shown inside each classroom. The quiz library lets educators preview or delete quizzes and resume drafts. Follow the classroom migration sequence below for quiz creation, deadlines, and draft editing.

## Existing accounts

If an account was created before the database trigger in `schema.sql` was installed, run `supabase/004_backfill_profiles.sql` once in Supabase SQL Editor. It creates the missing profile rows and keeps any existing profile unchanged.

## Signup profile fields

New accounts collect a name, age, and optional school/organization. If the database schema was already installed, run `supabase/005_profile_fields.sql` in the SQL Editor before testing a new signup.

## Classrooms and private quiz publishing

Run `supabase/006_classrooms.sql` after migrations `002`–`005`, then run `supabase/007_fix_classroom_policy_recursion.sql`, `supabase/008_classroom_student_reports.sql`, `supabase/009_create_quiz_rpc.sql`, `supabase/010_remove_demo_quiz_access.sql`, `supabase/011_atomic_quiz_publishing.sql`, `supabase/012_quiz_deadlines.sql`, and `supabase/013_draft_quiz_library.sql` in order. Migration `010` removes the old `human-body` demo quiz and its questions. Migration `011` makes quiz publishing atomic, hides answer keys from learners, grades attempts in the database, keeps the join-code RPC from returning classroom details, and gives newly created classrooms longer join codes while preserving existing codes. Migration `012` requires a deadline for newly published quizzes, allows teachers to change the deadline per classroom, and blocks expired quizzes from student access and submissions. Migration `013` lets educators fetch and update their own draft quizzes without exposing correct answers to students. Educators create a class, share its join code, open it to see enrolled students and quiz progress, and create/publish quizzes to that class. A teacher can also create one quiz from the dashboard and publish it to several classrooms. Students join with their teacher's code, open quizzes assigned to their classes, and review their own latest score and attempt history. Only enrolled students can see or open classroom quizzes.

When Supabase Email Confirmations are disabled, an existing email is shown as “An account with this email already exists” during signup. With confirmations enabled, Supabase intentionally obscures this response to prevent outsiders from checking which emails are registered; the app instead shows the usual confirmation message.
