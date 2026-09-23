import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '@/api/client';

export const useAuthStore = defineStore('auth', () => {
  // ✅ Токен больше НЕ хранится в JS — только httpOnly-cookie.
  // В localStorage храним только имя пользователя (не секрет).
  const user = ref(localStorage.getItem('auth_user') || '');
  const isAuthenticated = ref(false);
  const loading = ref(false);

  async function login(username, pin) {
    loading.value = true;
    try {
      const { data } = await api.post('/auth/login', { user: username, pin });
      if (!data.ok) throw new Error(data.error || 'Ошибка входа');

      user.value = data.user;
      isAuthenticated.value = true;

      // ✅ Сохраняем ТОЛЬКО имя (для отображения), не токен
      localStorage.setItem('auth_user', data.user);

      console.log('[auth] logged in:', data.user);

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
    isAuthenticated.value = false;
    localStorage.removeItem('auth_user');
  }

  /**
   * Проверка сессии через /auth/me.
   * Возвращает:
   *   true  — сессия валидна
   *   false — 401, надо логиниться
   *   null  — сетевая/5xx ошибка, не разлогиниваем
   */
  async function checkSession() {
    try {
      const { data } = await api.get('/auth/me');
      if (data.valid) {
        user.value = data.user || user.value;
        if (data.user) localStorage.setItem('auth_user', data.user);
        isAuthenticated.value = true;
        return true;
      }
      isAuthenticated.value = false;
      return false;
    } catch (e) {
      // 401 — точно невалидная сессия
      if (e.response?.status === 401) {
        isAuthenticated.value = false;
        return false;
      }
      // Сеть/5xx — не трогаем состояние, возвращаем null
      console.warn('[auth] checkSession: сеть недоступна', e.message);
      return null;
    }
  }

  return { user, isAuthenticated, loading, login, logout, checkSession };
});