const form = document.getElementById('demo-form');
const status = document.getElementById('status');

function closeDemo() {
  form.reset();
  window.close();
  // A directly opened tab may not allow scripts to close it.
  status.textContent = 'Simulation finished. You can close this window.';
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  // Native form validation accepts only the published dummy value. The script
  // never reads the input, authenticates an account, or transmits anything.
  closeDemo();
});
document.getElementById('cancel').addEventListener('click', closeDemo);
