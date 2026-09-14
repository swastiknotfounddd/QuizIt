window.quizitSupabase = null;

const supabaseUrl = window.QUIZIT_SUPABASE_URL;
const supabaseKey = window.QUIZIT_SUPABASE_ANON_KEY;

if (
  window.supabase &&
  supabaseUrl &&
  supabaseKey &&
  !supabaseUrl.includes('YOUR_') &&
  !supabaseKey.includes('YOUR_')
) {
  window.quizitSupabase = window.supabase.createClient(supabaseUrl, supabaseKey);
}

window.getQuizitUser = async () => {
  if (!window.quizitSupabase) return null;
  const { data, error } = await window.quizitSupabase.auth.getUser();
  return error ? null : data.user;
};
