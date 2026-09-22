import axios from 'axios';

/**
 * Axios-instance для всех запросов к бэкенду.
 * withCredentials: true — отправляет httpOnly cookies автоматически.
 */
export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  timeout: 15_000,
});

// Response interceptor — на 401 (кроме логина) перекидываем на /login
api.interceptors.response.use(
  response => response,
  error => {
    if (
      error.response?.status === 401 &&
      !error.config.url.includes('/auth/login')
    ) {
      localStorage.removeItem('auth_user');
      localStorage.removeItem('auth_token');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);