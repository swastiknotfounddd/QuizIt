const title = document.getElementById('dashboard-title');
const intro = document.getElementById('dashboard-intro');
const roleLabel = document.getElementById('role-label');
const message = document.getElementById('dashboard-message');
const metrics = document.getElementById('metrics');
const activityTitle = document.getElementById('activity-title');
const activityDescription = document.getElementById('activity-description');
const activityList = document.getElementById('activity-list');
const dashboardAction = document.getElementById('dashboard-action');
const builder = document.getElementById('quiz-builder');
const builderQuestions = document.getElementById('builder-questions');
const quizForm = document.getElementById('quiz-form');
const builderMessage = document.getElementById('builder-message');

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

function addRow(name, detail, score, href = null) {
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
  if (href) {
    const actions = document.createElement('div');
    const link = document.createElement('a');
    actions.className = 'activity-actions';
    link.className = 'activity-link';
    link.href = href;
    link.textContent = 'Open quiz →';
    actions.append(scoreElement, link);
    row.append(info, actions);
  } else {
    row.append(info, scoreElement);
  }
  activityList.appendChild(row);
}

function showEmpty(text) {
  const empty = document.createElement('div');
  empty.className = 'empty-state';
  empty.textContent = text;
  activityList.appendChild(empty);
}

function percent(score, total) { return total ? Math.round((score / total) * 100) : 0; }
function clearDashboard() { metrics.replaceChildren(); activityList.replaceChildren(); }

async function loadStudentDashboard(user) {
  clearDashboard();
  roleLabel.textContent = 'Student dashboard';
  title.textContent = 'Keep growing.';
  intro.textContent = 'Your completed quizzes and recent progress are all in one place.';
  activityTitle.textContent = 'Recent activity';
  activityDescription.textContent = 'Your latest completed quizzes.';
  dashboardAction.textContent = 'Take a quiz';
  dashboardAction.onclick = () => { window.location.assign('quiz.html'); };
  const { data: attempts, error } = await window.quizitSupabase.from('attempts').select('score, total_questions, timed_out, completed_at, quizzes(title, category)').eq('user_id', user.id).order('completed_at', { ascending: false });
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

function addQuestion() {
  const index = builderQuestions.children.length + 1;
  const card = document.createElement('fieldset');
  card.className = 'question-card';
  const header = document.createElement('div');
  header.className = 'question-card-header';
  const heading = document.createElement('h4');
  const remove = document.createElement('button');
  heading.textContent = `Question ${index}`;
  remove.type = 'button';
  remove.className = 'text-link remove-question';
  remove.textContent = 'Remove';
  remove.disabled = index === 1;
  remove.addEventListener('click', () => { card.remove(); renumberQuestions(); });
  header.append(heading, remove);
  const questionLabel = document.createElement('label');
  questionLabel.textContent = 'Question';
  const questionInput = document.createElement('input');
  questionInput.className = 'input question-text';
  questionInput.type = 'text';
  questionInput.maxLength = 500;
  questionInput.required = true;
  questionInput.placeholder = 'Write your question';
  questionLabel.appendChild(questionInput);
  const answers = document.createElement('div');
  answers.className = 'answer-fields';
  for (let answerIndex = 0; answerIndex < 4; answerIndex += 1) {
    const row = document.createElement('label');
    row.className = 'answer-field';
    const correct = document.createElement('input');
    correct.type = 'radio';
    correct.name = `correct-answer-${index}`;
    correct.value = String(answerIndex);
    correct.required = true;
    correct.checked = answerIndex === 0;
    correct.setAttribute('aria-label', `Correct answer for option ${answerIndex + 1}`);
    const answer = document.createElement('input');
    answer.className = 'input answer-text';
    answer.type = 'text';
    answer.maxLength = 250;
    answer.required = true;
    answer.placeholder = `Answer ${answerIndex + 1}`;
    row.append(correct, answer);
    answers.appendChild(row);
  }
  const help = document.createElement('p');
  help.className = 'answer-help';
  help.textContent = 'Select the circle next to the correct answer.';
  card.append(header, questionLabel, answers, help);
  builderQuestions.appendChild(card);
}

function renumberQuestions() {
  [...builderQuestions.children].forEach((card, index) => {
    card.querySelector('h4').textContent = `Question ${index + 1}`;
    card.querySelectorAll('input[type="radio"]').forEach((radio) => { radio.name = `correct-answer-${index + 1}`; });
    card.querySelector('.remove-question').disabled = index === 0;
  });
}

function makeSlug(value) {
  const base = value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'quiz';
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

function readQuestions() {
  return [...builderQuestions.children].map((card, index) => {
    const answers = [...card.querySelectorAll('.answer-text')].map((input) => input.value.trim());
    const correct = card.querySelector('input[type="radio"]:checked');
    return { position: index + 1, text: card.querySelector('.question-text').value.trim(), answers, correct_answer: Number(correct.value) };
  });
}

async function saveQuiz(user) {
  if (!quizForm.reportValidity()) return;
  const saveButton = document.getElementById('save-quiz');
  saveButton.disabled = true;
  builderMessage.textContent = 'Saving your quiz…';
  const quizTitle = document.getElementById('new-quiz-title').value.trim();
  const { data: quiz, error: quizError } = await window.quizitSupabase.from('quizzes').insert({
    title: quizTitle,
    slug: makeSlug(quizTitle),
    category: document.getElementById('new-quiz-category').value.trim(),
    duration_seconds: Number(document.getElementById('new-quiz-duration').value) * 60,
    is_published: document.getElementById('new-quiz-published').checked,
    created_by: user.id,
  }).select('id').single();
  if (quizError) {
    saveButton.disabled = false;
    builderMessage.textContent = quizError.message;
    return;
  }
  const { error: questionsError } = await window.quizitSupabase.from('questions').insert(readQuestions().map((question) => ({ ...question, quiz_id: quiz.id })));
  saveButton.disabled = false;
  if (questionsError) {
    builderMessage.textContent = `Quiz created, but questions could not be saved: ${questionsError.message}`;
    return;
  }
  quizForm.reset();
  builderQuestions.replaceChildren();
  addQuestion();
  builder.hidden = true;
  await loadTeacherDashboard(user);
}

async function loadTeacherDashboard(user) {
  clearDashboard();
  roleLabel.textContent = 'Educator dashboard';
  title.textContent = 'See learning take shape.';
  intro.textContent = 'Create quizzes, then track learner progress and spot where they need support.';
  activityTitle.textContent = 'Your quizzes';
  activityDescription.textContent = 'Quiz performance from learner attempts.';
  dashboardAction.textContent = 'Create a quiz';
  dashboardAction.onclick = () => { builder.hidden = false; builder.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const { data: quizzes, error: quizError } = await window.quizitSupabase.from('quizzes').select('id, slug, title, category, is_published, created_at').eq('created_by', user.id).order('created_at', { ascending: false });
  if (quizError) throw quizError;
  const quizRows = quizzes || [];
  const ids = quizRows.map((quiz) => quiz.id);
  let attempts = [];
  if (ids.length) {
    const { data, error } = await window.quizitSupabase.from('attempts').select('quiz_id, score, total_questions').in('quiz_id', ids);
    if (error) throw error;
    attempts = data || [];
  }
  const average = attempts.length ? Math.round(attempts.reduce((sum, item) => sum + percent(item.score, item.total_questions), 0) / attempts.length) : 0;
  addMetric('Quizzes created', String(quizRows.length));
  addMetric('Learner attempts', String(attempts.length));
  addMetric('Average score', attempts.length ? `${average}%` : '—');
  if (!quizRows.length) return showEmpty('Create your first quiz to share it with learners and see its performance here.');
  quizRows.forEach((quiz) => {
    const quizAttempts = attempts.filter((attempt) => attempt.quiz_id === quiz.id);
    const quizAverage = quizAttempts.length ? `${Math.round(quizAttempts.reduce((sum, item) => sum + percent(item.score, item.total_questions), 0) / quizAttempts.length)}% average` : 'No attempts yet';
    addRow(quiz.title, `${quiz.category} · ${quiz.is_published ? 'Published' : 'Draft'}`, `${quizAttempts.length} attempts · ${quizAverage}`, `quiz.html?quiz=${encodeURIComponent(quiz.slug)}`);
  });
}

async function initDashboard() {
  if (!window.quizitSupabase) { message.textContent = 'Supabase is not configured yet. Add your Project URL and publishable key first.'; intro.textContent = 'Your dashboard will appear here once Supabase is connected.'; return; }
  const user = await window.getQuizitUser();
  if (!user) { window.location.replace('index.html'); return; }
  document.getElementById('logout-button').addEventListener('click', async () => { await window.quizitSupabase.auth.signOut(); window.location.replace('index.html'); });
  document.getElementById('add-question').addEventListener('click', addQuestion);
  document.getElementById('close-builder').addEventListener('click', () => { builder.hidden = true; });
  const { data: profile, error } = await window.quizitSupabase.from('profiles').select('role').eq('id', user.id).single();
  if (error) throw error;
  if (profile.role === 'educator') {
    addQuestion();
    quizForm.addEventListener('submit', (event) => { event.preventDefault(); saveQuiz(user); });
    await loadTeacherDashboard(user);
  } else {
    await loadStudentDashboard(user);
  }
}

initDashboard().catch((error) => { message.textContent = `Dashboard could not load: ${error.message}`; intro.textContent = 'Please refresh the page after checking your Supabase setup.'; });
