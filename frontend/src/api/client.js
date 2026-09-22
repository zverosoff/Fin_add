import axios from 'axios';

// В продакшене — Amvera из .env.production
// В деве — '/api' (прокси Vite)
const API_BASE = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  timeout: 15000,
});

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