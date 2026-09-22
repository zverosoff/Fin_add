import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '@/api/client';

export const useAuthStore = defineStore('auth', () => {
  const user = ref(localStorage.getItem('auth_user') || '');
  const token = ref(localStorage.getItem('auth_token') || '');
  const loading = ref(false);

  async function login(username, pin) {
    loading.value = true;
    try {
      const { data } = await api.post('/auth/login', { user: username, pin });
      if (!data.ok) throw new Error(data.error || 'Ошибка входа');

      user.value = data.user;
      token.value = data.token;

      // ✅ Сохраняем в localStorage
      localStorage.setItem('auth_user', data.user);
      localStorage.setItem('auth_token', data.token);

      console.log('[auth] logged in:', data.user, 'token length:', data.token.length);

      return true;
    } finally {
      loading.value = false;
    }
  }

  async function logout() {
    try {
      await api.post('/auth/logout');
    } catch { /* ignore */ }
    user.value = '';
    token.value = '';
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_token');
  }

  async function checkSession() {
    try {
      const { data } = await api.get('/auth/me');
      return data.valid;
    } catch {
      return false;
    }
  }

  return { user, token, loading, login, logout, checkSession };
});