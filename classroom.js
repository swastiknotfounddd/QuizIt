const classroomTitle = document.getElementById('classroom-title');
const classroomDescription = document.getElementById('classroom-description');
const classroomJoinCode = document.getElementById('classroom-join-code');
const classroomMessage = document.getElementById('classroom-message');
const classroomMetrics = document.getElementById('classroom-metrics');
const classroomRoster = document.getElementById('classroom-roster');
const classroomQuizzes = document.getElementById('classroom-quizzes');
const quizBuilder = document.getElementById('classroom-quiz-builder');
const quizForm = document.getElementById('classroom-quiz-form');
const builderQuestions = document.getElementById('class-builder-questions');
const builderMessage = document.getElementById('class-builder-message');
const saveQuizButton = document.getElementById('save-class-quiz');
const classId = new URLSearchParams(window.location.search).get('id');
let currentUser = null;
let classroom = null;

function percent(score, total) {
  return total ? Math.round((score / total) * 100) : 0;
}

function addMetric(label, value) {
  const card = document.createElement('article');
  const name = document.createElement('span');
  const number = document.createElement('strong');
  card.className = 'metric';
  name.textContent = label;
  number.textContent = String(value);
  card.append(name, number);
  classroomMetrics.appendChild(card);
}

function addQuestion() {
  const index = builderQuestions.children.length + 1;
  const card = document.createElement('fieldset');
  const header = document.createElement('div');
  const heading = document.createElement('h4');
  const remove = document.createElement('button');
  card.className = 'question-card';
  header.className = 'question-card-header';
  heading.textContent = `Question ${index}`;
  remove.type = 'button';
  remove.className = 'text-link remove-question';
  remove.textContent = 'Remove';
  remove.disabled = index === 1;
  remove.addEventListener('click', () => {
    card.remove();
    renumberQuestions();
  });
  header.append(heading, remove);

  const questionLabel = document.createElement('label');
  const questionInput = document.createElement('input');
  questionLabel.textContent = 'Question';
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
    const correct = document.createElement('input');
    const answer = document.createElement('input');
    row.className = 'answer-field';
    correct.type = 'radio';
    correct.name = `class-correct-${index}`;
    correct.value = String(answerIndex);
    correct.required = true;
    correct.checked = answerIndex === 0;
    correct.setAttribute('aria-label', `Correct answer for option ${answerIndex + 1}`);
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
  help.textContent = 'Select the circle beside the correct answer.';
  card.append(header, questionLabel, answers, help);
  builderQuestions.appendChild(card);
}

function renumberQuestions() {
  [...builderQuestions.children].forEach((card, index) => {
    card.querySelector('h4').textContent = `Question ${index + 1}`;
    card.querySelectorAll('input[type="radio"]').forEach((radio) => {
      radio.name = `class-correct-${index + 1}`;
    });
    card.querySelector('.remove-question').disabled = index === 0;
  });
}

function readQuestions() {
  return [...builderQuestions.children].map((card, index) => ({
    position: index + 1,
    text: card.querySelector('.question-text').value.trim(),
    answers: [...card.querySelectorAll('.answer-text')].map((answer) => answer.value.trim()),
    correct_answer: Number(card.querySelector('input[type="radio"]:checked').value),
  }));
}

function makeSlug(value) {
  const base = value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'quiz';
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

function localDateTime(value) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function renderRoster(students) {
  classroomRoster.replaceChildren();
  if (!students.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No students have joined this classroom yet.';
    classroomRoster.appendChild(empty);
    return;
  }
  students.forEach((student) => {
    const row = document.createElement('article');
    const name = document.createElement('h3');
    const joined = document.createElement('p');
    row.className = 'classroom-row roster-row';
    name.textContent = student.student_name;
    joined.textContent = `Joined ${new Date(student.joined_at).toLocaleDateString()}`;
    row.append(name, joined);
    classroomRoster.appendChild(row);
  });
}

function renderStudentActiveQuizzes(assignments) {
  const activeQuizzes = (assignments || [])
    .filter((assignment) => assignment.quizzes?.is_published)
    .filter((assignment) => !assignment.deadline || new Date(assignment.deadline).getTime() > Date.now());
  const activeList = document.getElementById('student-active-quizzes');
  activeList.replaceChildren();
  classroomMetrics.replaceChildren();
  addMetric('Active quizzes', activeQuizzes.length);

  if (!activeQuizzes.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'There are no active quizzes in this classroom right now.';
    activeList.appendChild(empty);
    return;
  }

  activeQuizzes.forEach((assignment) => {
    const quiz = assignment.quizzes;
    const card = document.createElement('article');
    const info = document.createElement('div');
    const heading = document.createElement('h3');
    const detail = document.createElement('p');
    const action = document.createElement('a');
    card.className = 'classroom-quiz-report student-active-quiz';
    heading.textContent = quiz.title;
    detail.textContent = `${quiz.category} · Deadline: ${assignment.deadline ? new Date(assignment.deadline).toLocaleString() : 'No deadline'}`;
    action.className = 'primary';
    action.href = `quiz.html?quiz=${encodeURIComponent(quiz.slug)}`;
    action.textContent = 'Attempt quiz →';
    info.append(heading, detail);
    card.append(info, action);
    activeList.appendChild(card);
  });
}

async function loadStudentClassroom() {
  const { data: classData, error: classError } = await window.quizitSupabase
    .from('classrooms')
    .select('id, name, description')
    .eq('id', classroom.id)
    .single();
  if (classError) throw new Error('This classroom is not available to your account.');
  classroom = classData;
  classroomTitle.textContent = classroom.name;
  classroomDescription.textContent = classroom.description || 'Active quizzes published to this classroom.';
  document.getElementById('classroom-dashboard-link').textContent = 'Student dashboard';
  document.querySelector('.back-link').textContent = '← My classrooms';

  const { data: assignments, error: assignmentsError } = await window.quizitSupabase
    .from('quiz_classrooms')
    .select('deadline, quizzes(id, slug, title, category, is_published)')
    .eq('classroom_id', classroom.id)
    .order('published_at', { ascending: false });
  if (assignmentsError) throw assignmentsError;
  renderStudentActiveQuizzes(assignments || []);
  classroomMessage.textContent = '';
}

function renderQuizReports(students, quizzes, attempts) {
  classroomQuizzes.replaceChildren();
  if (!quizzes.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No quizzes have been published to this classroom yet.';
    classroomQuizzes.appendChild(empty);
    return;
  }

  quizzes.forEach((quiz) => {
    const report = document.createElement('section');
    const heading = document.createElement('h3');
    const deadlineText = document.createElement('p');
    const deadlineForm = document.createElement('form');
    const deadlineLabel = document.createElement('label');
    const deadlineInput = document.createElement('input');
    const deadlineButton = document.createElement('button');
    const deadlineMessage = document.createElement('p');
    const learnerList = document.createElement('ul');
    report.className = 'classroom-quiz-report';
    heading.textContent = `${quiz.title} · ${quiz.category}`;
    deadlineText.className = 'quiz-deadline-text';
    deadlineText.textContent = `Deadline: ${quiz.deadline ? new Date(quiz.deadline).toLocaleString() : 'Not set for this existing quiz'}`;
    deadlineForm.className = 'deadline-form';
    deadlineLabel.textContent = 'Set or change deadline';
    deadlineInput.className = 'input';
    deadlineInput.type = 'datetime-local';
    deadlineInput.required = true;
    if (quiz.deadline) deadlineInput.value = localDateTime(quiz.deadline);
    deadlineLabel.appendChild(deadlineInput);
    deadlineButton.type = 'submit';
    deadlineButton.className = 'text-link';
    deadlineButton.textContent = 'Save deadline';
    deadlineMessage.className = 'dashboard-message';
    deadlineMessage.setAttribute('role', 'status');
    deadlineForm.append(deadlineLabel, deadlineButton, deadlineMessage);
    deadlineForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      deadlineButton.disabled = true;
      deadlineMessage.textContent = 'Updating deadline…';
      try {
        const { error } = await window.quizitSupabase.rpc('update_classroom_quiz_deadline', {
          target_quiz_id: quiz.id,
          target_classroom_id: classroom.id,
          new_deadline: new Date(deadlineInput.value).toISOString(),
        });
        if (error) {
          deadlineMessage.textContent = error.message;
          return;
        }
        await loadClassroom();
      } catch (error) {
        deadlineMessage.textContent = `Could not update deadline: ${error.message}`;
      } finally {
        deadlineButton.disabled = false;
      }
    });

    learnerList.className = 'classroom-learner-list';
    students.forEach((student) => {
      const learnerAttempts = attempts.filter(
        (attempt) => attempt.quiz_id === quiz.id && attempt.user_id === student.student_id,
      );
      const learner = document.createElement('li');
      const learnerHeading = document.createElement('div');
      const name = document.createElement('strong');
      const status = document.createElement('span');
      learner.className = 'classroom-learner';
      learnerHeading.className = 'classroom-learner-heading';
      name.textContent = student.student_name;
      status.className = `attempt-status ${learnerAttempts.length ? 'attempted' : 'not-attempted'}`;
      status.textContent = learnerAttempts.length ? `${learnerAttempts.length} attempt${learnerAttempts.length === 1 ? '' : 's'}` : 'Not attempted';
      learnerHeading.append(name, status);
      learner.appendChild(learnerHeading);

      if (learnerAttempts.length) {
        const latest = learnerAttempts[0];
        const score = document.createElement('p');
        score.textContent = `Latest score: ${latest.score}/${latest.total_questions} (${percent(latest.score, latest.total_questions)}%)`;
        learner.appendChild(score);
        const history = document.createElement('details');
        const summary = document.createElement('summary');
        const historyList = document.createElement('ul');
        summary.textContent = 'Attempt history';
        learnerAttempts.forEach((attempt) => {
          const item = document.createElement('li');
          const timeout = attempt.timed_out ? ' · Time expired' : '';
          item.textContent = `${new Date(attempt.completed_at).toLocaleString()} · ${attempt.score}/${attempt.total_questions} (${percent(attempt.score, attempt.total_questions)}%)${timeout}`;
          historyList.appendChild(item);
        });
        history.append(summary, historyList);
        learner.appendChild(history);
      }
      learnerList.appendChild(learner);
    });

    report.append(heading, deadlineText, deadlineForm, learnerList);
    classroomQuizzes.appendChild(report);
  });
}

async function loadClassroom() {
  classroomMessage.textContent = 'Loading classroom…';
  const [classroomResult, rosterResult] = await Promise.all([
    window.quizitSupabase.from('classrooms')
      .select('id, name, description, join_code')
      .eq('id', classroom.id)
      .single(),
    window.quizitSupabase.rpc('get_classroom_student_roster', {
      target_classroom_id: classroom.id,
    }),
  ]);
  if (classroomResult.error) throw classroomResult.error;
  if (rosterResult.error) throw rosterResult.error;
  classroom = classroomResult.data;

  const { data: assignments, error: assignmentError } = await window.quizitSupabase
    .from('quiz_classrooms')
    .select('quiz_id, deadline, published_at, quizzes(id, title, category)')
    .eq('classroom_id', classroom.id)
    .order('published_at', { ascending: false });
  if (assignmentError) throw assignmentError;
  const quizzes = (assignments || [])
    .map((assignment) => assignment.quizzes && ({
      ...assignment.quizzes,
      deadline: assignment.deadline,
    }))
    .filter(Boolean);

  let attempts = [];
  if (quizzes.length) {
    const { data, error } = await window.quizitSupabase
      .from('attempts')
      .select('user_id, quiz_id, score, total_questions, timed_out, completed_at')
      .in('quiz_id', quizzes.map((quiz) => quiz.id))
      .order('completed_at', { ascending: false });
    if (error) throw error;
    attempts = data || [];
  }

  classroomTitle.textContent = classroom.name;
  classroomDescription.textContent = classroom.description || 'Manage students, quizzes, deadlines, and progress for this classroom.';
  classroomJoinCode.textContent = classroom.join_code;
  classroomMessage.textContent = '';
  classroomMetrics.replaceChildren();
  addMetric('Students', rosterResult.data.length);
  addMetric('Quizzes', quizzes.length);
  addMetric('Attempts', attempts.length);
  document.getElementById('roster-summary').textContent = `${rosterResult.data.length} student${rosterResult.data.length === 1 ? '' : 's'} joined this classroom.`;
  renderRoster(rosterResult.data || []);
  renderQuizReports(rosterResult.data || [], quizzes, attempts);
}

async function saveClassQuiz(event) {
  event.preventDefault();
  if (!quizForm.reportValidity()) return;
  saveQuizButton.disabled = true;
  builderMessage.textContent = 'Publishing quiz to this classroom…';
  try {
    const quizTitle = document.getElementById('class-quiz-title').value.trim();
    const { error } = await window.quizitSupabase.rpc('create_quiz_with_deadline', {
      input_title: quizTitle,
      input_slug: makeSlug(quizTitle),
      input_category: document.getElementById('class-quiz-category').value.trim(),
      input_duration_seconds: Number(document.getElementById('class-quiz-duration').value) * 60,
      input_is_published: true,
      input_questions: readQuestions(),
      input_classroom_ids: [classroom.id],
      input_deadline: new Date(document.getElementById('class-quiz-deadline').value).toISOString(),
    });
    if (error) {
      builderMessage.textContent = error.message;
      return;
    }
    quizForm.reset();
    builderQuestions.replaceChildren();
    addQuestion();
    quizBuilder.hidden = true;
    await loadClassroom();
  } catch (error) {
    builderMessage.textContent = `Could not publish quiz: ${error.message}`;
  } finally {
    saveQuizButton.disabled = false;
  }
}

async function initClassroom() {
  if (!window.quizitSupabase) throw new Error('Supabase is not configured.');
  currentUser = await window.getQuizitUser();
  if (!currentUser) {
    window.location.replace('index.html');
    return;
  }
  const { data: profile, error: profileError } = await window.quizitSupabase
    .from('profiles').select('role').eq('id', currentUser.id).single();
  if (profileError) throw profileError;
  if (!classId) throw new Error('Choose a classroom from your dashboard.');
  classroom = { id: classId };
  document.getElementById('logout-button').addEventListener('click', async () => {
    await window.quizitSupabase.auth.signOut();
    window.location.replace('index.html');
  });

  if (profile.role === 'student') {
    document.getElementById('classroom-code-card').hidden = true;
    document.getElementById('student-classroom-panel').hidden = false;
    document.getElementById('teacher-roster-panel').hidden = true;
    document.getElementById('teacher-quizzes-panel').hidden = true;
    await loadStudentClassroom();
    return;
  }
  if (profile.role !== 'educator') {
    window.location.replace('dashboard.html');
    return;
  }
  document.getElementById('classroom-code-card').hidden = false;
  document.getElementById('teacher-roster-panel').hidden = false;
  document.getElementById('teacher-quizzes-panel').hidden = false;
  document.getElementById('create-class-quiz').addEventListener('click', () => {
    quizBuilder.hidden = false;
    quizBuilder.scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.getElementById('class-quiz-title').focus();
  });
  document.getElementById('close-class-builder').addEventListener('click', () => {
    quizBuilder.hidden = true;
  });
  document.getElementById('add-class-question').addEventListener('click', addQuestion);
  quizForm.addEventListener('submit', saveClassQuiz);
  const deadlineInput = document.getElementById('class-quiz-deadline');
  deadlineInput.min = localDateTime(new Date().toISOString());
  addQuestion();
  await loadClassroom();
}

initClassroom().catch((error) => {
  classroomMessage.textContent = `Classroom could not load: ${error.message}`;
});
