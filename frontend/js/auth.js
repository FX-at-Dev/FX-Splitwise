const authForm = document.querySelector('[data-auth-form]');
const authMessage = document.querySelector('[data-auth-message]');

if (authForm) {
  authForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const formData = new FormData(authForm);
    const endpoint = authForm.dataset.endpoint;
    const body = Object.fromEntries(formData.entries());

    try {
      const result = await apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
      });

      saveAuth(result);
      window.location.href = 'dashboard.html';
    } catch (error) {
      authMessage.textContent = error.message;
      authMessage.classList.add('danger');
    }
  });
}
