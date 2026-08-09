const modal = document.getElementById('loginModal');

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
  alert('error occurred.');
}

modal.addEventListener('click', (event) => {
  if (event.target === modal) {
    closeLogin();
  }
});
