const modal = document.getElementById('loginModal');

function openLogin(mode = 'login') {
  const isSignup = mode === 'signup';
  document.getElementById('modal-title').textContent = isSignup ? 'Create your account' : 'Welcome back';
  document.getElementById('modal-description').textContent = isSignup
    ? 'Choose your role and start learning with QuizIt for free.'
    : 'Log in to continue learning with QuizIt.';
  document.getElementById('modal-submit').textContent = isSignup ? 'Create account' : 'Log in';
  document.getElementById('account-switch').innerHTML = isSignup
    ? 'Already have an account? <button type="button" onclick="openLogin()">Log in</button>'
    : 'New to QuizIt? <button type="button" onclick="openLogin(\'signup\')">Create an account</button>';
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
  alert('No Data Available at the moment.');
}

modal.addEventListener('click', (event) => {
  if (event.target === modal) {
    closeLogin();
  }
});
