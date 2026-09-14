const title = document.getElementById('dashboard-title');
const intro = document.getElementById('dashboard-intro');
const roleLabel = document.getElementById('role-label');
const message = document.getElementById('dashboard-message');
const metrics = document.getElementById('metrics');
const activityTitle = document.getElementById('activity-title');
const activityDescription = document.getElementById('activity-description');
const activityList = document.getElementById('activity-list');
const dashboardAction = document.getElementById('dashboard-action');

function addMetric(label, value) {
  const card = document.createElement('article');
  const labelElement = document.createElement('span');
  const valueElement = document.createElement('strong');
  labelElement.textContent = label;
  valueElement.textContent = value;
  card.className = 'metric';
  card.append(labelElement, valueElement);
  metrics.appendChild(card);
}

function addRow(name, detail, score) {
  const row = document.createElement('article');
  const info = document.createElement('div');
  const heading = document.createElement('h3');
  const description = document.createElement('p');
  const scoreElement = document.createElement('span');
  row.className = 'activity-row';
  heading.textContent = name;
  description.textContent = detail;
  scoreElement.className = 'activity-score';
  scoreElement.textContent = score;
  info.append(heading, description);
  row.append(info, scoreElement);
  activityList.appendChild(row);
}

function showEmpty(text) {
  const empty = document.createElement('div');
  empty.className = 'empty-state';
  empty.textContent = text;
  activityList.appendChild(empty);
}

function percent(score, total) {
  return total ? Math.round((score / total) * 100) : 0;
}

async function loadStudentDashboard(user) {
  roleLabel.textContent = 'Student dashboard';
  title.textContent = 'Keep growing.';
  intro.textContent = 'Your completed quizzes and recent progress are all in one place.';
  const { data: attempts, error } = await window.quizitSupabase
    .from('attempts')
    .select('score, total_questions, timed_out, completed_at, quizzes(title, category)')
    .eq('user_id', user.id)
    .order('completed_at', { ascending: false });
  if (error) throw error;

  const rows = attempts || [];
  const average = rows.length ? Math.round(rows.reduce((sum, item) => sum + percent(item.score, item.total_questions), 0) / rows.length) : 0;
  addMetric('Quizzes completed', String(rows.length));
  addMetric('Average score', `${average}%`);
  addMetric('Best score', rows.length ? `${Math.max(...rows.map((item) => percent(item.score, item.total_questions)))}%` : '—');

  if (!rows.length) return showEmpty('No completed quizzes yet. Take the science quiz to start tracking your progress.');
  rows.slice(0, 8).forEach((attempt) => {
    const quiz = attempt.quizzes || {};
    const date = new Date(attempt.completed_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    addRow(quiz.title || 'Quiz', `${quiz.category || 'Quiz'} · ${date}${attempt.timed_out ? ' · Time expired' : ''}`, `${attempt.score}/${attempt.total_questions} · ${percent(attempt.score, attempt.total_questions)}%`);
  });
}

async function loadTeacherDashboard(user) {
  roleLabel.textContent = 'Educator dashboard';
  title.textContent = 'See learning take shape.';
  intro.textContent = 'Track the performance of quizzes you create and spot where learners need support.';
  activityTitle.textContent = 'Your quizzes';
  activityDescription.textContent = 'Quiz performance from learner attempts.';
  dashboardAction.textContent = 'Preview quiz';

  const { data: quizzes, error: quizError } = await window.quizitSupabase
    .from('quizzes')
    .select('id, title, category, is_published, created_at')
    .eq('created_by', user.id)
    .order('created_at', { ascending: false });
  if (quizError) throw quizError;

  const quizRows = quizzes || [];
  const ids = quizRows.map((quiz) => quiz.id);
  let attempts = [];
  if (ids.length) {
    const { data, error } = await window.quizitSupabase
      .from('attempts')
      .select('quiz_id, score, total_questions')
      .in('quiz_id', ids);
    if (error) throw error;
    attempts = data || [];
  }
  const average = attempts.length ? Math.round(attempts.reduce((sum, item) => sum + percent(item.score, item.total_questions), 0) / attempts.length) : 0;
  addMetric('Quizzes created', String(quizRows.length));
  addMetric('Learner attempts', String(attempts.length));
  addMetric('Average score', attempts.length ? `${average}%` : '—');

  if (!quizRows.length) return showEmpty('You have not created a quiz yet. Quiz creation tools can be added next; existing quizzes you create will appear here.');
  quizRows.forEach((quiz) => {
    const quizAttempts = attempts.filter((attempt) => attempt.quiz_id === quiz.id);
    const quizAverage = quizAttempts.length ? `${Math.round(quizAttempts.reduce((sum, item) => sum + percent(item.score, item.total_questions), 0) / quizAttempts.length)}% average` : 'No attempts yet';
    addRow(quiz.title, `${quiz.category} · ${quiz.is_published ? 'Published' : 'Draft'}`, `${quizAttempts.length} attempts · ${quizAverage}`);
  });
}

async function initDashboard() {
  if (!window.quizitSupabase) {
    message.textContent = 'Supabase is not configured yet. Add your Project URL and publishable key first.';
    intro.textContent = 'Your dashboard will appear here once Supabase is connected.';
    return;
  }
  const user = await window.getQuizitUser();
  if (!user) {
    window.location.replace('index.html');
    return;
  }
  document.getElementById('logout-button').addEventListener('click', async () => {
    await window.quizitSupabase.auth.signOut();
    window.location.replace('index.html');
  });
  const { data: profile, error } = await window.quizitSupabase.from('profiles').select('role').eq('id', user.id).single();
  if (error) throw error;
  if (profile.role === 'educator') await loadTeacherDashboard(user);
  else await loadStudentDashboard(user);
}

initDashboard().catch((error) => {
  message.textContent = `Dashboard could not load: ${error.message}`;
  intro.textContent = 'Please refresh the page after checking your Supabase setup.';
});
