const forgotForm = document.querySelector('[data-forgot-form]');
const resetForm = document.querySelector('[data-reset-form]');
const messageEl = document.querySelector('[data-reset-message]');

const setMessage = (text, type = 'neutral') => {
  if (!messageEl) {
    return;
  }

  messageEl.textContent = text;
  messageEl.classList.remove('danger', 'success');

  if (type === 'danger') {
    messageEl.classList.add('danger');
  }

  if (type === 'success') {
    messageEl.classList.add('success');
  }
};

const prefillTokenFromUrl = () => {
  if (!resetForm) {
    return;
  }

  const tokenInput = resetForm.querySelector('input[name="token"]');
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');

  if (token && tokenInput) {
    tokenInput.value = token;
  }
};

if (forgotForm) {
  forgotForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const formData = new FormData(forgotForm);
    const email = String(formData.get('email') || '').trim();

    try {
      const result = await apiRequest('/password/forgot', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });

      setMessage(result.message || 'If the email exists, a reset link was created.', 'success');

      if (result.resetUrl) {
        setMessage(`Link generated for local setup: ${result.resetUrl}`, 'success');
      }
    } catch (error) {
      setMessage(error.message, 'danger');
    }
  });
}

if (resetForm) {
  resetForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const formData = new FormData(resetForm);
    const token = String(formData.get('token') || '').trim();
    const password = String(formData.get('password') || '');

    try {
      const result = await apiRequest('/password/reset', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });

      setMessage(result.message || 'Password reset successful. Redirecting to login...', 'success');
      window.setTimeout(() => {
        window.location.href = 'login.html';
      }, 1200);
    } catch (error) {
      setMessage(error.message, 'danger');
    }
  });
}

prefillTokenFromUrl();
