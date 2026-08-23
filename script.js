const modal = document.getElementById('loginModal');
const modalTitle = document.getElementById('modal-title');
const modalDescription = document.getElementById('modal-description');
const modalSubmit = document.getElementById('modal-submit');
const accountSwitch = document.getElementById('account-switch');
const roleButtons = document.querySelectorAll('.role button');
const openButtons = document.querySelectorAll('[data-open-modal]');
const scrollButtons = document.querySelectorAll('[data-scroll-to]');
const closeButton = document.querySelector('.close');

const modalContent = {
  login: {
    title: 'Welcome back',
    description: 'Log in to continue learning with QuizIt.',
    submit: 'Log in',
    switchText: 'New to QuizIt?',
    switchAction: 'Create an account',
    switchMode: 'signup',
  },
  signup: {
    title: 'Create your account',
    description: 'Choose your role and start learning with QuizIt for free.',
    submit: 'Create account',
    switchText: 'Already have an account?',
    switchAction: 'Log in',
    switchMode: 'login',
  },
};

function openLogin(mode = 'login') {
  const config = modalContent[mode] || modalContent.login;

  modalTitle.textContent = config.title;
  modalDescription.textContent = config.description;
  modalSubmit.textContent = config.submit;

  const switchButton = document.createElement('button');
  switchButton.type = 'button';
  switchButton.textContent = config.switchAction;
  switchButton.addEventListener('click', () => openLogin(config.switchMode));

  accountSwitch.textContent = `${config.switchText} `;
  accountSwitch.appendChild(switchButton);
  modal.classList.add('show');
}

function closeLogin() {
  modal.classList.remove('show');
}

function selectRole(selectedButton) {
  roleButtons.forEach((button) => button.classList.toggle('selected', button === selectedButton));
}

function scrollToFeatures() {
  document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
}

function showDemoMessage() {
  closeLogin();
  alert('No Data Available at the moment.');
}

openButtons.forEach((button) => {
  const mode = button.dataset.openModal || 'login';
  button.addEventListener('click', () => openLogin(mode));
});

scrollButtons.forEach((button) => {
  button.addEventListener('click', () => scrollToFeatures());
});

roleButtons.forEach((button) => {
  button.addEventListener('click', () => selectRole(button));
});

modalSubmit.addEventListener('click', showDemoMessage);
closeButton.addEventListener('click', closeLogin);

modal.addEventListener('click', (event) => {
  if (event.target === modal) {
    closeLogin();
  }
});
