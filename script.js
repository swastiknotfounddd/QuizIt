const modal = document.getElementById('loginModal');
const modalTitle = document.getElementById('modal-title');
const modalDescription = document.getElementById('modal-description');
const modalSubmit = document.getElementById('modal-submit');
const accountSwitch = document.getElementById('account-switch');
const authMessage = document.getElementById('auth-message');
const emailInput = document.getElementById('login-email');
const passwordInput = document.getElementById('login-password');
const roleButtons = document.querySelectorAll('.role button');
const openButtons = document.querySelectorAll('[data-open-modal]');
const scrollButtons = document.querySelectorAll('[data-scroll-to]');
const closeButton = document.querySelector('.close');
const authActions = document.getElementById('auth-actions');

let currentMode = 'login';
let selectedRole = 'student';

const modalContent = {
  login: { title: 'Welcome back', description: 'Log in to continue learning with QuizIt.', submit: 'Log in', switchText: 'New to QuizIt?', switchAction: 'Create an account', switchMode: 'signup' },
  signup: { title: 'Create your account', description: 'Choose your role and start learning with QuizIt for free.', submit: 'Create account', switchText: 'Already have an account?', switchAction: 'Log in', switchMode: 'login' },
};

function showMessage(message, isError = false) {
  authMessage.textContent = message;
  authMessage.classList.toggle('error', isError);
}

function openLogin(mode = 'login') {
  const config = modalContent[mode] || modalContent.login;
  currentMode = mode;
  modalTitle.textContent = config.title;
  modalDescription.textContent = config.description;
  modalSubmit.textContent = config.submit;
  passwordInput.autocomplete = mode === 'login' ? 'current-password' : 'new-password';
  showMessage('');
  const switchButton = document.createElement('button');
  switchButton.type = 'button';
  switchButton.textContent = config.switchAction;
  switchButton.addEventListener('click', () => openLogin(config.switchMode));
  accountSwitch.textContent = `${config.switchText} `;
  accountSwitch.appendChild(switchButton);
  modal.classList.add('show');
  emailInput.focus();
}

function closeLogin() { modal.classList.remove('show'); }

function selectRole(button) {
  roleButtons.forEach((item) => item.classList.toggle('selected', item === button));
  selectedRole = button.dataset.role;
}

function renderAuthActions(user) {
  if (!user) {
    authActions.innerHTML = '<button class="login" type="button" data-open-modal="login">Log in</button><button class="primary" type="button" data-open-modal="signup">Create account</button>';
    authActions.querySelectorAll('[data-open-modal]').forEach((button) => button.addEventListener('click', () => openLogin(button.dataset.openModal)));
    return;
  }
  authActions.innerHTML = `<a class="login" href="dashboard.html">Dashboard</a><button class="login" id="logout-button" type="button">Log out</button>`;
  document.getElementById('logout-button').addEventListener('click', () => window.quizitSupabase.auth.signOut());
}

async function submitAuth() {
  if (!emailInput.reportValidity() || !passwordInput.reportValidity()) return;
  if (!window.quizitSupabase) {
    showMessage('Add your Supabase URL and anon key in supabase-config.js first.', true);
    return;
  }
  modalSubmit.disabled = true;
  showMessage(currentMode === 'login' ? 'Logging in…' : 'Creating your account…');
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const result = currentMode === 'login'
    ? await window.quizitSupabase.auth.signInWithPassword({ email, password })
    : await window.quizitSupabase.auth.signUp({ email, password, options: { data: { role: selectedRole } } });
  modalSubmit.disabled = false;
  if (result.error) return showMessage(result.error.message, true);
  if (currentMode === 'signup' && !result.data.session) return showMessage('Account created. Check your email to confirm it, then log in.');
  window.location.assign('dashboard.html');
}

openButtons.forEach((button) => button.addEventListener('click', () => openLogin(button.dataset.openModal || 'login')));
scrollButtons.forEach((button) => button.addEventListener('click', () => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })));
roleButtons.forEach((button) => button.addEventListener('click', () => selectRole(button)));
modalSubmit.addEventListener('click', submitAuth);
closeButton.addEventListener('click', closeLogin);
modal.addEventListener('click', (event) => { if (event.target === modal) closeLogin(); });
modal.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && event.target.matches('input')) submitAuth();
  if (event.key === 'Escape') closeLogin();
});

if (window.quizitSupabase) {
  window.quizitSupabase.auth.getUser().then(({ data }) => renderAuthActions(data.user));
  window.quizitSupabase.auth.onAuthStateChange((_event, session) => renderAuthActions(session?.user || null));
}
