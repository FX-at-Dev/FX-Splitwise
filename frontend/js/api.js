const API_BASE_URL = window.API_BASE_URL || 'http://localhost:5000';

const getToken = () => localStorage.getItem('fx_splitwise_token');

const setToken = (token) => {
  localStorage.setItem('fx_splitwise_token', token);
};

const clearAuth = () => {
  localStorage.removeItem('fx_splitwise_token');
  localStorage.removeItem('fx_splitwise_user');
};

const saveAuth = ({ token, user }) => {
  setToken(token);
  localStorage.setItem('fx_splitwise_user', JSON.stringify(user));
};

const getUser = () => {
  const raw = localStorage.getItem('fx_splitwise_user');
  return raw ? JSON.parse(raw) : null;
};

const apiRequest = async (path, options = {}) => {
  const headers = {
    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers || {}),
  };

  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const message = typeof payload === 'object' && payload.message ? payload.message : 'Request failed';
    throw new Error(message);
  }

  return payload;
};