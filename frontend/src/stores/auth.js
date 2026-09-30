import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '@/api/client';

export const useAuthStore = defineStore('auth', () => {
  // ✅ Токен больше НЕ хранится в JS — только httpOnly-cookie.
  // В localStorage храним только имя пользователя (не секрет).
  const user = ref(localStorage.getItem('auth_user') || '');

  // ✅ НОВОЕ: отображаемое имя (может отличаться от технического user).
  // user      — технический ключ: 'Сергей' / 'Саша'
  // displayName — то, что видит пользователь: 'Сергей' / 'Сергей Иванов' / и т.д.
  const displayName = ref(localStorage.getItem('auth_display_name') || '');

  const isAuthenticated = ref(false);
  const loading = ref(false);

  async function login(username, pin) {
    loading.value = true;
    try {
      const { data } = await api.post('/auth/login', { user: username, pin });
      if (!data.ok) throw new Error(data.error || 'Ошибка входа');

      user.value = data.user;
      displayName.value = data.user;   // пока не загрузили профиль — равен техническому
      isAuthenticated.value = true;

      localStorage.setItem('auth_user', data.user);
      localStorage.setItem('auth_display_name', data.user);

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
    displayName.value = '';
    isAuthenticated.value = false;
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_display_name');
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
        if (data.user) {
          localStorage.setItem('auth_user', data.user);
          // Если displayName ещё не загружали — ставим равным техническому
          if (!displayName.value) {
            displayName.value = data.user;
            localStorage.setItem('auth_display_name', data.user);
          }
        }
        isAuthenticated.value = true;
        return true;
      }
      isAuthenticated.value = false;
      return false;
    } catch (e) {
      if (e.response?.status === 401) {
        isAuthenticated.value = false;
        return false;
      }
      console.warn('[auth] checkSession: сеть недоступна', e.message);
      return null;
    }
  }

  // ✅ НОВОЕ: обновить displayName (после сохранения в профиле)
  function setDisplayName(name) {
    const clean = String(name || '').trim();
    if (!clean) return;
    displayName.value = clean;
    localStorage.setItem('auth_display_name', clean);
  }

  // ✅ Хелпер: получить отображаемое имя по техническому ключу.
  // Для текущего пользователя — displayName, для остальных — сам ключ.
  function nameFor(technicalUser) {
    if (!technicalUser) return '';
    if (technicalUser === user.value) {
      return displayName.value || user.value;
    }
    return technicalUser;
  }

  return {
    user,
    displayName,
    isAuthenticated,
    loading,
    login,
    logout,
    checkSession,
    setDisplayName,
    nameFor,
  };
});