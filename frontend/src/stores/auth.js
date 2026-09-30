import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '@/api/client';

export const useAuthStore = defineStore('auth', () => {
  const user = ref(localStorage.getItem('auth_user') || '');
  const displayName = ref(localStorage.getItem('auth_display_name') || '');
  // ✅ НОВОЕ: аватар пользователя (base64 или null)
  const avatar = ref(localStorage.getItem('auth_avatar') || null);

  const isAuthenticated = ref(false);
  const loading = ref(false);

  async function login(username, pin) {
    loading.value = true;
    try {
      const { data } = await api.post('/auth/login', { user: username, pin });
      if (!data.ok) throw new Error(data.error || 'Ошибка входа');

      user.value = data.user;
      displayName.value = data.user;
      avatar.value = null;
      isAuthenticated.value = true;

      localStorage.setItem('auth_user', data.user);
      localStorage.setItem('auth_display_name', data.user);

      return true;
    } finally {
      loading.value = false;
    }
  }

  async function logout() {
    try { await api.post('/auth/logout'); } catch {}
    user.value = '';
    displayName.value = '';
    avatar.value = null;
    isAuthenticated.value = false;
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_display_name');
    localStorage.removeItem('auth_avatar');
  }

  async function checkSession() {
    try {
      const { data } = await api.get('/auth/me');
      if (data.valid) {
        user.value = data.user || user.value;
        if (data.user) {
          localStorage.setItem('auth_user', data.user);
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
      return null;
    }
  }

  function setDisplayName(name) {
    const clean = String(name || '').trim();
    if (!clean) return;
    displayName.value = clean;
    localStorage.setItem('auth_display_name', clean);
  }

  // ✅ НОВОЕ: установить/сбросить аватар
  function setAvatar(dataUrl) {
    avatar.value = dataUrl || null;
    if (dataUrl) localStorage.setItem('auth_avatar', dataUrl);
    else localStorage.removeItem('auth_avatar');
  }

  function nameFor(technicalUser) {
    if (!technicalUser) return '';
    if (technicalUser === user.value) return displayName.value || user.value;
    return technicalUser;
  }

  // ✅ Хелпер: аватар для пользователя (пока знаем только текущего)
  function avatarFor(technicalUser) {
    if (technicalUser === user.value) return avatar.value || null;
    return null;
  }

  return {
    user, displayName, avatar,
    isAuthenticated, loading,
    login, logout, checkSession,
    setDisplayName, setAvatar,
    nameFor, avatarFor,
  };
});