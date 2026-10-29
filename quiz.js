let questions = [];
let quizId = null;
let quizDuration = 300;
let quizDeadline = null;

const questionText = document.getElementById('question-text');
const answerList = document.getElementById('answer-list');
const questionCount = document.getElementById('question-count');
const progressBar = document.getElementById('progress-bar');
const previousButton = document.getElementById('previous-button');
const nextButton = document.getElementById('next-button');
const feedback = document.getElementById('answer-feedback');
const questionPanel = document.getElementById('question-panel');
const results = document.getElementById('results');
const score = document.getElementById('score');
const resultsSummary = document.getElementById('results-summary');
const retryButton = document.getElementById('retry-button');
const timerElement = document.getElementById('timer');
const timerBox = document.querySelector('.timer');
const quizMessage = document.getElementById('quiz-message');

let questionIndex = 0;
let answers = [];
let secondsLeft = 300;
let timerId;
let quizFinished = false;

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

function updateTimer() {
  timerElement.textContent = formatTime(secondsLeft);
  timerBox.classList.toggle('is-low', secondsLeft <= 60);

  if (secondsLeft <= 0) {
    finishQuiz(true);
    return;
  }

  secondsLeft -= 1;
}

function renderQuestion() {
  const question = questions[questionIndex];
  const selectedAnswer = answers[questionIndex];

  questionText.textContent = question.text;
  questionCount.textContent = `Question ${questionIndex + 1} of ${questions.length}`;
  progressBar.style.width = `${((questionIndex + 1) / questions.length) * 100}%`;
  previousButton.hidden = questionIndex === 0;
  nextButton.disabled = selectedAnswer === undefined;
  nextButton.innerHTML = questionIndex === questions.length - 1
    ? 'Finish quiz <span>→</span>'
    : 'Next question <span>→</span>';
  feedback.textContent = selectedAnswer === undefined
    ? 'Choose the answer you think is right.'
    : 'Answer saved. You can change it before continuing.';

  const answerButtons = question.answers.map((answer, answerIndex) => {
    const button = document.createElement('button');
    const isSelected = selectedAnswer === answerIndex;

    button.className = `answer${isSelected ? ' selected' : ''}`;
    button.type = 'button';
    button.setAttribute('role', 'radio');
    button.setAttribute('aria-checked', String(isSelected));
    const mark = document.createElement('span');
    const answerText = document.createElement('span');
    mark.className = 'answer-mark';
    mark.setAttribute('aria-hidden', 'true');
    mark.textContent = '✓';
    answerText.textContent = answer;
    button.append(mark, answerText);
    button.addEventListener('click', () => selectAnswer(answerIndex));

    return button;
  });

  answerList.replaceChildren(...answerButtons);
}

function selectAnswer(answerIndex) {
  answers[questionIndex] = answerIndex;
  renderQuestion();
}

async function finishQuiz(timedOut = false) {
  if (quizFinished) return;
  quizFinished = true;
  clearInterval(timerId);

  questionPanel.hidden = true;
  document.querySelector('.quiz-meta').hidden = true;
  document.querySelector('.quiz-shell .progress').hidden = true;
  results.hidden = false;
  score.textContent = '…';
  resultsSummary.textContent = timedOut ? 'Time is up. Saving your result…' : 'Saving your result…';
  const result = await saveAttempt(timedOut);
  if (!result || result.error) {
    score.textContent = '—';
    resultsSummary.textContent += result?.error
      ? ` Your result could not be saved: ${result.error}`
      : ' Your result could not be saved.';
    return;
  }
  score.textContent = `${result.score} / ${result.total_questions}`;
  resultsSummary.textContent = timedOut
    ? `Time is up. You answered ${result.score} of ${result.total_questions} questions correctly. Your result has been saved.`
    : `You answered ${result.score} of ${result.total_questions} questions correctly. Your result has been saved.`;
}

async function saveAttempt(timedOut) {
  if (!quizId) return null;
  try {
    const submittedAnswers = questions.map((_question, index) => answers[index] ?? null);
    const { data, error } = await window.quizitSupabase.rpc('submit_quiz_attempt', {
      input_quiz_id: quizId,
      input_answers: submittedAnswers,
      input_timed_out: timedOut,
    });
    return error ? { error: error.message } : data;
  } catch (error) {
    return { error: error.message };
  }
}

function startQuiz() {
  if (quizDeadline) {
    const secondsUntilDeadline = Math.floor((quizDeadline - Date.now()) / 1000) - 3;
    if (secondsUntilDeadline < 1) {
      showQuizUnavailable('The deadline for this quiz has passed.');
      return;
    }
    secondsLeft = Math.min(quizDuration, secondsUntilDeadline);
  } else {
    secondsLeft = quizDuration;
  }
  quizFinished = false;
  questionIndex = 0;
  answers = [];
  results.hidden = true;
  questionPanel.hidden = false;
  document.querySelector('.quiz-meta').hidden = false;
  document.querySelector('.quiz-shell .progress').hidden = false;
  clearInterval(timerId);
  updateTimer();
  timerId = setInterval(updateTimer, 1000);
  renderQuestion();
}

function showQuizUnavailable(text) {
  clearInterval(timerId);
  document.querySelector('.quiz-meta').hidden = true;
  document.querySelector('.quiz-shell .progress').hidden = true;
  timerBox.hidden = true;
  results.hidden = true;
  questionPanel.hidden = false;
  questionText.textContent = '';
  answerList.replaceChildren();
  feedback.textContent = '';
  quizMessage.textContent = text;
  previousButton.hidden = true;
  nextButton.hidden = true;
}

nextButton.addEventListener('click', () => {
  if (answers[questionIndex] === undefined) return;

  if (questionIndex === questions.length - 1) {
    finishQuiz();
    return;
  }

  questionIndex += 1;
  renderQuestion();
});

previousButton.addEventListener('click', () => {
  if (questionIndex === 0) return;

  questionIndex -= 1;
  renderQuestion();
});
retryButton.addEventListener('click', startQuiz);

async function loadQuiz() {
  if (!window.quizitSupabase) return showQuizUnavailable('Connect to your classroom to choose an assigned quiz.');
  const user = await window.getQuizitUser();
  if (!user) { window.location.replace('index.html'); return; }
  const slug = new URLSearchParams(window.location.search).get('quiz');
  if (!slug) return showQuizUnavailable('Choose a quiz from your student dashboard to get started.');
  const { data: quiz, error: quizError } = await window.quizitSupabase
    .from('quizzes')
    .select('id, title, category, duration_seconds, created_by, is_published')
    .eq('slug', slug)
    .single();

  if (quizError || !quiz) return showQuizUnavailable('This quiz is unavailable or its deadline has passed. Ask your teacher if you need access.');
  const { data: profile, error: profileError } = await window.quizitSupabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (profileError || !profile) return showQuizUnavailable('Your account could not be verified. Return to your dashboard and try again.');

  const { data: assignments, error: assignmentError } = await window.quizitSupabase
    .from('quiz_classrooms')
    .select('deadline')
    .eq('quiz_id', quiz.id);
  if (assignmentError) return showQuizUnavailable('This quiz availability could not be checked. Return to your dashboard and try again.');
  const teacherPreview = profile.role === 'educator' && quiz.created_by === user.id;
  const activeAssignments = (assignments || []).filter(
    (assignment) => !assignment.deadline || new Date(assignment.deadline).getTime() > Date.now(),
  );
  if (!teacherPreview && !activeAssignments.length) {
    return showQuizUnavailable('The deadline for this quiz has passed.');
  }
  const hasUnlimitedAssignment = activeAssignments.some((assignment) => !assignment.deadline);
  if (!teacherPreview && !hasUnlimitedAssignment) {
    const latestDeadline = Math.max(...activeAssignments.map((assignment) => new Date(assignment.deadline).getTime()));
    const secondsUntilDeadline = Math.floor((latestDeadline - Date.now()) / 1000) - 3;
    if (secondsUntilDeadline < 1) return showQuizUnavailable('The deadline for this quiz has passed.');
    quizDeadline = latestDeadline;
  }
  const { data: remoteQuestions, error: questionError } = await window.quizitSupabase
    .from('questions')
    .select('text, answers')
    .eq('quiz_id', quiz.id)
    .order('position');

  if (questionError || !remoteQuestions?.length) return showQuizUnavailable('This quiz has no available questions yet.');
  questions = remoteQuestions.map((question) => ({
    text: question.text,
    answers: question.answers,
  }));
  quizId = quiz.id;
  quizDuration = quiz.duration_seconds;
  if (teacherPreview || hasUnlimitedAssignment) quizDeadline = null;
  document.getElementById('quiz-title').textContent = quiz.title;
  document.querySelector('.quiz-meta .tag').textContent = quiz.category;
  startQuiz();
}

loadQuiz();
