import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  timeout: 15000,
});

// ✅ Никаких Authorization-заголовков — только httpOnly-cookie.
// axios с withCredentials: true автоматически шлёт cookie.

// ✅ 401 → logout (кроме login/me)
api.interceptors.response.use(
  response => response,
  error => {
    const url = error.config?.url || '';
    if (
      error.response?.status === 401 &&
      !url.includes('/auth/login') &&
      !url.includes('/auth/me')
    ) {
      localStorage.removeItem('auth_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);