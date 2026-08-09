const modal = document.getElementById('loginModal');
const themeToggle = document.getElementById('themeToggle');

function updateTheme(isDark) {
  document.body.classList.toggle('dark-theme', isDark);
  themeToggle.setAttribute('aria-pressed', String(isDark));
  themeToggle.setAttribute('aria-label', isDark ? 'Switch to light theme' : 'Switch to dark theme');
  themeToggle.querySelector('.theme-icon').textContent = isDark ? '☀' : '☾';
  themeToggle.querySelector('.theme-label').textContent = isDark ? 'Dark mode' : 'Light mode';
  localStorage.setItem('quizit-theme', isDark ? 'dark' : 'light');
}

const savedTheme = localStorage.getItem('quizit-theme');
const prefersDarkTheme = window.matchMedia('(prefers-color-scheme: dark)').matches;
updateTheme(savedTheme ? savedTheme === 'dark' : prefersDarkTheme);

themeToggle.addEventListener('click', () => {
  updateTheme(!document.body.classList.contains('dark-theme'));
});

function openLogin() {
  modal.classList.add('show');
}

function closeLogin() {
  modal.classList.remove('show');
}

function selectRole(selectedButton) {
  document.querySelectorAll('.role button').forEach((button) => {
    button.classList.remove('selected');
  });

  selectedButton.classList.add('selected');
}

function scrollToFeatures() {
  document.getElementById('features').scrollIntoView({ behavior: 'smooth' });
}

function showDemoMessage() {
  closeLogin();
  alert('Bsdk bana to pahele.');
}

modal.addEventListener('click', (event) => {
  if (event.target === modal) {
    closeLogin();
  }
});
