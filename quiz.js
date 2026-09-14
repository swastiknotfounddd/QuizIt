const defaultQuestions = [
  {
    text: 'Which organ pumps blood around the body?',
    answers: ['The lungs', 'The heart', 'The brain', 'The stomach'],
    correctAnswer: 1,
  },
  {
    text: 'What is the largest organ in the human body?',
    answers: ['The skin', 'The liver', 'The lungs', 'The heart'],
    correctAnswer: 0,
  },
  {
    text: 'How many bones does a typical adult human have?',
    answers: ['106', '206', '306', '406'],
    correctAnswer: 1,
  },
  {
    text: 'Which body system carries oxygen and nutrients around the body?',
    answers: ['Digestive system', 'Nervous system', 'Circulatory system', 'Skeletal system'],
    correctAnswer: 2,
  },
  {
    text: 'Which part of the body is responsible for thinking and memory?',
    answers: ['The brain', 'The kidneys', 'The muscles', 'The pancreas'],
    correctAnswer: 0,
  },
];

let questions = defaultQuestions;
let quizId = null;
let quizDuration = 300;

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

let questionIndex = 0;
let answers = [];
let secondsLeft = 300;
let timerId;

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
    button.innerHTML = `<span class="answer-mark" aria-hidden="true">✓</span><span>${answer}</span>`;
    button.addEventListener('click', () => selectAnswer(answerIndex));

    return button;
  });

  answerList.replaceChildren(...answerButtons);
}

function selectAnswer(answerIndex) {
  answers[questionIndex] = answerIndex;
  renderQuestion();
}

function getScore() {
  return answers.reduce((total, answer, index) => {
    return total + (answer === questions[index].correctAnswer ? 1 : 0);
  }, 0);
}

function finishQuiz(timedOut = false) {
  clearInterval(timerId);
  const correctAnswers = getScore();

  questionPanel.hidden = true;
  document.querySelector('.quiz-meta').hidden = true;
  document.querySelector('.quiz-shell .progress').hidden = true;
  results.hidden = false;
  score.textContent = `${correctAnswers} / ${questions.length}`;
  resultsSummary.textContent = timedOut
    ? `Time is up. You answered ${correctAnswers} of ${questions.length} questions correctly.`
    : `You answered ${correctAnswers} of ${questions.length} questions correctly.`;
  saveAttempt(correctAnswers, timedOut);
}

async function saveAttempt(correctAnswers, timedOut) {
  const user = await window.getQuizitUser();
  if (!user || !quizId) return;

  const { error } = await window.quizitSupabase.from('attempts').insert({
    user_id: user.id,
    quiz_id: quizId,
    answers,
    score: correctAnswers,
    total_questions: questions.length,
    timed_out: timedOut,
  });

  if (error) {
    resultsSummary.textContent += ' Your result could not be saved.';
  } else {
    resultsSummary.textContent += ' Your result has been saved.';
  }
}

function startQuiz() {
  questionIndex = 0;
  answers = [];
  secondsLeft = quizDuration;
  results.hidden = true;
  questionPanel.hidden = false;
  document.querySelector('.quiz-meta').hidden = false;
  document.querySelector('.quiz-shell .progress').hidden = false;
  clearInterval(timerId);
  updateTimer();
  timerId = setInterval(updateTimer, 1000);
  renderQuestion();
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
  if (!window.quizitSupabase) return startQuiz();
  const { data: quiz, error: quizError } = await window.quizitSupabase
    .from('quizzes')
    .select('id, title, duration_seconds')
    .eq('slug', 'human-body')
    .single();

  if (quizError || !quiz) return startQuiz();
  const { data: remoteQuestions, error: questionError } = await window.quizitSupabase
    .from('questions')
    .select('text, answers, correct_answer')
    .eq('quiz_id', quiz.id)
    .order('position');

  if (!questionError && remoteQuestions?.length) {
    questions = remoteQuestions.map((question) => ({
      text: question.text,
      answers: question.answers,
      correctAnswer: question.correct_answer,
    }));
    quizId = quiz.id;
    quizDuration = quiz.duration_seconds;
    document.getElementById('quiz-title').textContent = quiz.title;
  }
  startQuiz();
}

loadQuiz();
