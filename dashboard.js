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
const studentClassroomsPanel = document.getElementById('student-classrooms');
const teacherClassroomsPanel = document.getElementById('teacher-classrooms');
const studentClassroomList = document.getElementById('student-classroom-list');
const teacherClassroomList = document.getElementById('teacher-classroom-list');
const classroomOptions = document.getElementById('quiz-classroom-options');
const joinClassroomForm = document.getElementById('join-classroom-form');
const createClassroomForm = document.getElementById('create-classroom-form');
let displayName = '';
let editingQuiz = null;

// Dashboard rendering helpers
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
  return row;
}

function showEmpty(text) {
  const empty = document.createElement('div');
  empty.className = 'empty-state';
  empty.textContent = text;
  activityList.appendChild(empty);
}

function addTeacherQuizRow(quiz, user) {
  const row = document.createElement('article');
  const info = document.createElement('div');
  const heading = document.createElement('h3');
  const description = document.createElement('p');
  const actions = document.createElement('div');
  const status = document.createElement('span');
  const preview = document.createElement('a');
  const remove = document.createElement('button');
  row.className = 'activity-row';
  actions.className = 'activity-actions';
  heading.textContent = quiz.title;
  description.textContent = `${quiz.category} · ${quiz.is_published ? 'Published' : 'Draft'}`;
  status.className = 'activity-score';
  status.textContent = quiz.is_published ? 'Published' : 'Draft';
  preview.className = 'activity-link';
  preview.href = `quiz.html?quiz=${encodeURIComponent(quiz.slug)}`;
  preview.textContent = 'Preview →';
  remove.type = 'button';
  remove.className = 'text-link quiz-delete-button';
  remove.textContent = 'Delete';
  remove.addEventListener('click', async () => {
    const messageText = quiz.is_published
      ? `Delete “${quiz.title}”? This also removes it from every classroom and deletes its attempt history.`
      : `Delete the draft “${quiz.title}”? This cannot be undone.`;
    if (!window.confirm(messageText)) return;
    remove.disabled = true;
    try {
      const { error } = await window.quizitSupabase
        .from('quizzes')
        .delete()
        .eq('id', quiz.id)
        .eq('created_by', user.id);
      if (error) throw error;
      await loadTeacherDashboard(user);
    } catch (error) {
      remove.disabled = false;
      message.textContent = `Could not delete quiz: ${error.message}`;
    }
  });
  actions.append(status, preview);
  if (!quiz.is_published) {
    const resume = document.createElement('button');
    resume.type = 'button';
    resume.className = 'text-link';
    resume.textContent = 'Resume draft';
    resume.addEventListener('click', () => resumeDraft(quiz.id));
    actions.appendChild(resume);
  }
  actions.appendChild(remove);
  info.append(heading, description);
  row.append(info, actions);
  activityList.appendChild(row);
}

function resetQuizBuilderForNewQuiz() {
  editingQuiz = null;
  quizForm.reset();
  builderQuestions.replaceChildren();
  addQuestion();
  classroomOptions.querySelectorAll('input[name="quiz-classroom"]').forEach((input) => {
    input.checked = false;
  });
  updatePublishControls();
  document.getElementById('builder-title').textContent = 'Create a quiz for multiple classes';
  document.getElementById('builder-description').textContent = 'Add your questions, then publish the quiz to the classrooms you select.';
  document.getElementById('save-quiz').textContent = 'Save quiz';
  builderMessage.textContent = '';
}

function updatePublishControls() {
  const isPublishing = document.getElementById('new-quiz-published').checked;
  document.getElementById('classroom-picker').hidden = !isPublishing;
  document.getElementById('deadline-field').hidden = !isPublishing;
  document.getElementById('new-quiz-deadline').required = isPublishing;
  document.getElementById('save-quiz').textContent = isPublishing ? 'Publish quiz' : 'Save draft';
}

async function resumeDraft(quizId) {
  builderMessage.textContent = 'Loading saved draft…';
  try {
    const { data: draft, error } = await window.quizitSupabase.rpc('get_draft_quiz_for_edit', {
      target_quiz_id: quizId,
    });
    if (error) throw error;
    editingQuiz = draft;
    document.getElementById('new-quiz-title').value = draft.title;
    document.getElementById('new-quiz-category').value = draft.category;
    document.getElementById('new-quiz-duration').value = draft.duration_seconds / 60;
    document.getElementById('new-quiz-published').checked = false;
    document.getElementById('new-quiz-deadline').value = '';
    updatePublishControls();
    classroomOptions.querySelectorAll('input[name="quiz-classroom"]').forEach((input) => {
      input.checked = false;
    });
    builderQuestions.replaceChildren();
    draft.questions.forEach((question) => {
      addQuestion();
      const card = builderQuestions.lastElementChild;
      card.querySelector('.question-text').value = question.text;
      card.querySelectorAll('.answer-text').forEach((answer, index) => {
        answer.value = question.answers[index];
      });
      card.querySelector(`input[type="radio"][value="${question.correct_answer}"]`).checked = true;
    });
    document.getElementById('builder-title').textContent = `Resume draft: ${draft.title}`;
    document.getElementById('builder-description').textContent = 'Continue editing, save the draft, or select classrooms and a deadline to publish it.';
    document.getElementById('save-quiz').textContent = 'Save draft';
    builderMessage.textContent = '';
    builder.hidden = false;
    builder.scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.getElementById('new-quiz-title').focus();
  } catch (error) {
    builderMessage.textContent = `Could not load draft: ${error.message}`;
    builder.hidden = false;
    builder.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function percent(score, total) {
  return total ? Math.round((score / total) * 100) : 0;
}

function formatDeadline(value) {
  if (!value) return 'No deadline';
  return new Date(value).toLocaleString();
}

function toDatetimeLocal(value) {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

function clearDashboard() {
  metrics.replaceChildren();
  activityList.replaceChildren();
}

// Classroom rendering and data loading
function addClassroomRow(container, classroom, showCode = false) {
  const row = document.createElement('article');
  const info = document.createElement('div');
  const heading = document.createElement('h3');
  const description = document.createElement('p');
  row.className = 'classroom-row';
  heading.textContent = classroom.name;
  description.textContent = classroom.description || (
    showCode
      ? 'Share the code with your students.'
      : 'You are enrolled in this classroom.'
  );
  info.append(heading, description);
  row.appendChild(info);
  if (showCode) {
    const code = document.createElement('span');
    const openLink = document.createElement('a');
    code.className = 'join-code';
    code.textContent = classroom.join_code;
    code.title = 'Classroom join code';
    openLink.className = 'activity-link';
    openLink.href = `classroom.html?id=${encodeURIComponent(classroom.id)}`;
    openLink.textContent = 'Open classroom →';
    row.append(code, openLink);
  } else {
    const openLink = document.createElement('a');
    const leaveButton = document.createElement('button');
    openLink.className = 'activity-link';
    openLink.href = `classroom.html?id=${encodeURIComponent(classroom.id)}`;
    openLink.textContent = 'Open classroom →';
    leaveButton.type = 'button';
    leaveButton.className = 'text-link';
    leaveButton.textContent = 'Leave';
    leaveButton.addEventListener('click', async () => {
      leaveButton.disabled = true;
      try {
        const { error } = await window.quizitSupabase.rpc('leave_classroom', {
          target_classroom_id: classroom.id,
        });
        if (error) {
          message.textContent = error.message;
          return;
        }
        await loadStudentDashboard(await window.getQuizitUser());
      } catch (error) {
        message.textContent = `Could not leave classroom: ${error.message}`;
      } finally {
        leaveButton.disabled = false;
      }
    });
    row.append(openLink, leaveButton);
  }
  container.appendChild(row);
}

function renderClassroomOptions(classrooms) {
  classroomOptions.replaceChildren();
  if (!classrooms.length) {
    const text = document.createElement('p');
    text.textContent = 'Create a classroom before publishing a quiz.';
    classroomOptions.appendChild(text);
    return;
  }
  classrooms.forEach((classroom) => {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.name = 'quiz-classroom';
    input.value = classroom.id;
    label.className = 'classroom-option';
    label.append(input, document.createTextNode(classroom.name));
    classroomOptions.appendChild(label);
  });
}

async function loadStudentClassroomsAndQuizzes() {
  const { data: classrooms, error: classroomError } = await window.quizitSupabase
    .from('classrooms')
    .select('id, name, description')
    .order('created_at', { ascending: false });
  if (classroomError) throw classroomError;
  studentClassroomList.replaceChildren();
  (classrooms || []).forEach((classroom) => addClassroomRow(studentClassroomList, classroom));
  if (!(classrooms || []).length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'You have not joined a classroom yet.';
    studentClassroomList.appendChild(empty);
  }

  const { data: assignments, error: assignmentError } = await window.quizitSupabase
    .from('quiz_classrooms')
    .select('published_at, deadline, quizzes(id, slug, title, category, is_published), classrooms(name)')
    .order('published_at', { ascending: false });
  if (assignmentError) throw assignmentError;

  const uniqueQuizzes = new Map();
  (assignments || []).forEach((assignment) => {
    if (!assignment.quizzes?.is_published) return;
    const existing = uniqueQuizzes.get(assignment.quizzes.id);
    const className = assignment.classrooms?.name;
    const classAssignment = { name: className, deadline: assignment.deadline };
    if (existing) existing.classAssignments.push(classAssignment);
    else uniqueQuizzes.set(assignment.quizzes.id, {
      ...assignment.quizzes,
      classAssignments: [classAssignment],
    });
  });
  return [...uniqueQuizzes.values()].map((quiz) => {
    const deadlines = quiz.classAssignments.map((item) => item.deadline);
    const hasNoDeadline = deadlines.some((deadline) => !deadline);
    const latestDeadline = deadlines.filter(Boolean).sort().at(-1) || null;
    return {
      ...quiz,
      available: hasNoDeadline || Boolean(latestDeadline && new Date(latestDeadline).getTime() > Date.now()),
    };
  });
}

async function loadTeacherClassrooms(user) {
  const { data: classrooms, error } = await window.quizitSupabase
    .from('classrooms')
    .select('id, name, description, join_code')
    .eq('teacher_id', user.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  teacherClassroomList.replaceChildren();
  (classrooms || []).forEach((classroom) => addClassroomRow(teacherClassroomList, classroom, true));
  if (!(classrooms || []).length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No classrooms yet. Create one before publishing a quiz.';
    teacherClassroomList.appendChild(empty);
  }
  renderClassroomOptions(classrooms || []);
  return classrooms || [];
}

function addStudentAttemptReport(row, attempts) {
  const report = document.createElement('details');
  const summary = document.createElement('summary');
  const history = document.createElement('ul');
  report.className = 'student-quiz-report';
  summary.textContent = 'View your report';
  attempts.forEach((attempt) => {
    const item = document.createElement('li');
    const completed = new Date(attempt.completed_at).toLocaleString();
    const timeout = attempt.timed_out ? ' · Time expired' : '';
    item.textContent = `${completed} · Score ${attempt.score}/${attempt.total_questions} (${percent(attempt.score, attempt.total_questions)}%)${timeout}`;
    history.appendChild(item);
  });
  report.append(summary, history);
  row.appendChild(report);
}

async function loadStudentDashboard(user) {
  clearDashboard();
  roleLabel.textContent = 'Student dashboard';
  title.textContent = displayName ? `Keep growing, ${displayName}.` : 'Keep growing.';
  intro.textContent = 'Join classrooms, complete assigned quizzes, and track your progress.';
  activityTitle.textContent = 'Assigned quizzes';
  activityDescription.textContent = 'Quizzes published to your classrooms.';
  dashboardAction.textContent = 'Choose a quiz';
  dashboardAction.onclick = () => {
    activityList.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  studentClassroomsPanel.hidden = false;
  teacherClassroomsPanel.hidden = true;
  const assignedQuizzes = await loadStudentClassroomsAndQuizzes();
  const { data: attempts, error } = await window.quizitSupabase
    .from('attempts')
    .select('quiz_id, score, total_questions, timed_out, completed_at, quizzes(title, category)')
    .eq('user_id', user.id)
    .order('completed_at', { ascending: false });
  if (error) throw error;
  const rows = attempts || [];
  const average = rows.length
    ? Math.round(
      rows.reduce((sum, item) => sum + percent(item.score, item.total_questions), 0)
      / rows.length,
    )
    : 0;
  addMetric('Quizzes completed', String(rows.length));
  addMetric('Average score', `${average}%`);
  const bestScore = rows.length
    ? `${Math.max(...rows.map((item) => percent(item.score, item.total_questions)))}%`
    : '—';
  addMetric('Best score', bestScore);
  assignedQuizzes.forEach((quiz) => {
    const classDetails = quiz.classAssignments
      .map((assignment) => `${assignment.name || 'Class'} · ${formatDeadline(assignment.deadline)}`)
      .join(', ');
    const quizUrl = `quiz.html?quiz=${encodeURIComponent(quiz.slug)}`;
    const quizAttempts = rows.filter((attempt) => attempt.quiz_id === quiz.id);
    const latestAttempt = quizAttempts[0];
    const progress = latestAttempt
      ? `Latest: ${latestAttempt.score}/${latestAttempt.total_questions} (${percent(latestAttempt.score, latestAttempt.total_questions)}%)`
      : 'Not attempted';
    const status = quiz.available ? progress : `Closed · Deadline passed · ${progress}`;
    const row = addRow(quiz.title, `${quiz.category} · ${classDetails}`, status, quiz.available ? quizUrl : null);
    if (quizAttempts.length) addStudentAttemptReport(row, quizAttempts);
  });
  if (!assignedQuizzes.length) showEmpty('No quizzes have been published to your classrooms yet.');
}

// Quiz builder
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
  remove.addEventListener('click', () => {
    card.remove();
    renumberQuestions();
  });
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
    correct.setAttribute(
      'aria-label',
      `Correct answer for option ${answerIndex + 1}`,
    );
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
    card.querySelectorAll('input[type="radio"]').forEach((radio) => {
      radio.name = `correct-answer-${index + 1}`;
    });
    card.querySelector('.remove-question').disabled = index === 0;
  });
}

function makeSlug(value) {
  const base = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'quiz';
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

function readQuestions() {
  return [...builderQuestions.children].map((card, index) => {
    const answers = [...card.querySelectorAll('.answer-text')]
      .map((input) => input.value.trim());
    const correct = card.querySelector('input[type="radio"]:checked');
    return {
      position: index + 1,
      text: card.querySelector('.question-text').value.trim(),
      answers,
      correct_answer: Number(correct.value),
    };
  });
}

// Quiz and classroom actions
async function saveQuiz(user) {
  if (!quizForm.reportValidity()) return;
  const saveButton = document.getElementById('save-quiz');
  const isPublished = document.getElementById('new-quiz-published').checked;
  const selectedClassroomIds = [...document.querySelectorAll('input[name="quiz-classroom"]:checked')]
    .map((input) => input.value);
  if (isPublished && !selectedClassroomIds.length) {
    builderMessage.textContent = 'Select at least one classroom before publishing this quiz.';
    return;
  }
  const deadlineValue = document.getElementById('new-quiz-deadline').value;
  if (isPublished && !deadlineValue) {
    builderMessage.textContent = 'Set a deadline before publishing this quiz.';
    return;
  }
  if (isPublished && deadlineValue && new Date(deadlineValue).getTime() <= Date.now()) {
    builderMessage.textContent = 'Choose a deadline in the future.';
    return;
  }
  saveButton.disabled = true;
  builderMessage.textContent = 'Saving your quiz…';
  try {
    const quizTitle = document.getElementById('new-quiz-title').value.trim();
    const quizFields = {
      input_title: quizTitle,
      input_slug: editingQuiz?.slug || makeSlug(quizTitle),
      input_category: document.getElementById('new-quiz-category').value.trim(),
      input_duration_seconds: Number(document.getElementById('new-quiz-duration').value) * 60,
      input_is_published: isPublished,
      input_questions: readQuestions(),
      input_classroom_ids: isPublished ? selectedClassroomIds : [],
      input_deadline: isPublished && deadlineValue ? new Date(deadlineValue).toISOString() : null,
    };
    const { error } = editingQuiz
      ? await window.quizitSupabase.rpc('update_draft_quiz', {
        input_quiz_id: editingQuiz.id,
        ...quizFields,
      })
      : await window.quizitSupabase.rpc('create_quiz_with_deadline', quizFields);
    if (error) {
      builderMessage.textContent = error.message;
      return;
    }
    editingQuiz = null;
    quizForm.reset();
    updatePublishControls();
    builderQuestions.replaceChildren();
    addQuestion();
    builder.hidden = true;
    await loadTeacherDashboard(user);
  } catch (error) {
    builderMessage.textContent = `Could not save the quiz: ${error.message}`;
  } finally {
    saveButton.disabled = false;
  }
}

async function loadTeacherDashboard(user) {
  clearDashboard();
  roleLabel.textContent = 'Educator dashboard';
  title.textContent = displayName ? `See learning take shape, ${displayName}.` : 'See learning take shape.';
  intro.textContent = 'Create quizzes, then track learner progress and spot where they need support.';
  activityTitle.textContent = 'Quiz library';
  activityDescription.textContent = 'Create one quiz for several classrooms, or open a classroom to view its results.';
  dashboardAction.textContent = 'Create quiz for multiple classes';
  dashboardAction.onclick = async () => {
    await loadTeacherClassrooms(user);
    resetQuizBuilderForNewQuiz();
    builder.hidden = false;
    builder.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  document.querySelector('.dashboard-section').before(teacherClassroomsPanel);
  studentClassroomsPanel.hidden = true;
  teacherClassroomsPanel.hidden = false;
  const classrooms = await loadTeacherClassrooms(user);
  const { data: quizzes, error: quizError } = await window.quizitSupabase
    .from('quizzes')
    .select('id, slug, title, category, is_published, created_at')
    .eq('created_by', user.id)
    .order('created_at', { ascending: false });
  if (quizError) throw quizError;
  const quizRows = quizzes || [];
  addMetric('Quizzes created', String(quizRows.length));
  addMetric('Classrooms', String(classrooms.length));
  if (!quizRows.length) {
    return showEmpty('Create your first quiz to share it with learners and see its performance here.');
  }
  quizRows.forEach((quiz) => {
    addTeacherQuizRow(quiz, user);
  });
}

async function joinClassroom(user) {
  const messageElement = document.getElementById('join-classroom-message');
  const input = document.getElementById('join-classroom-code');
  if (!joinClassroomForm.reportValidity()) return;
  const submitButton = joinClassroomForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  messageElement.textContent = 'Joining classroom…';
  try {
    const { error } = await window.quizitSupabase.rpc('join_classroom_by_code', {
      input_code: input.value.trim().toUpperCase(),
    });
    if (error) {
      messageElement.textContent = error.message;
      return;
    }
    input.value = '';
    messageElement.textContent = 'Classroom joined successfully.';
    await loadStudentDashboard(user);
  } catch (error) {
    messageElement.textContent = `Could not join classroom: ${error.message}`;
  } finally {
    submitButton.disabled = false;
  }
}

async function createClassroom(user) {
  const messageElement = document.getElementById('create-classroom-message');
  if (!createClassroomForm.reportValidity()) return;
  const submitButton = createClassroomForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  messageElement.textContent = 'Creating classroom…';
  try {
    const { error } = await window.quizitSupabase
      .from('classrooms')
      .insert({
        teacher_id: user.id,
        name: document.getElementById('new-classroom-name').value.trim(),
        description: document.getElementById('new-classroom-description').value.trim() || null,
      });
    if (error) {
      messageElement.textContent = error.message;
      return;
    }
    createClassroomForm.reset();
    messageElement.textContent = 'Classroom created. Share its code with your students.';
    await loadTeacherClassrooms(user);
  } catch (error) {
    messageElement.textContent = `Could not create classroom: ${error.message}`;
  } finally {
    submitButton.disabled = false;
  }
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
  document.getElementById('add-question').addEventListener('click', addQuestion);
  document.getElementById('close-builder').addEventListener('click', () => {
    builder.hidden = true;
  });
  document.getElementById('new-quiz-deadline').min = toDatetimeLocal(new Date().toISOString());
  document.getElementById('new-quiz-published').addEventListener('change', () => {
    updatePublishControls();
  });
  updatePublishControls();
  const { data: profile, error } = await window.quizitSupabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single();
  if (error) throw error;
  displayName = profile.full_name?.trim().split(/\s+/)[0] || '';
  if (profile.role === 'educator') {
    addQuestion();
    quizForm.addEventListener('submit', (event) => {
      event.preventDefault();
      saveQuiz(user);
    });
    createClassroomForm.addEventListener('submit', (event) => {
      event.preventDefault();
      createClassroom(user);
    });
    await loadTeacherDashboard(user);
  } else {
    joinClassroomForm.addEventListener('submit', (event) => {
      event.preventDefault();
      joinClassroom(user);
    });
    await loadStudentDashboard(user);
  }
}

initDashboard().catch((error) => {
  message.textContent = `Dashboard could not load: ${error.message}`;
  intro.textContent = 'Please refresh the page after checking your Supabase setup.';
});
