import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '@/api/client';

export const useAuthStore = defineStore('auth', () => {
  const user = ref(localStorage.getItem('auth_user') || '');
  const displayName = ref(localStorage.getItem('auth_display_name') || '');
  const avatar = ref(localStorage.getItem('auth_avatar') || null);

  // ✅ Кэш профилей других пользователей
  const peerProfiles = ref({});

  // ✅ Флаг: какого пользователя уже загружали
  const loadedPeerUsers = ref(new Set());

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
      peerProfiles.value = {};
      loadedPeerUsers.value = new Set();
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
    peerProfiles.value = {};
    loadedPeerUsers.value = new Set();
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

  function setAvatar(dataUrl) {
    avatar.value = dataUrl || null;
    if (dataUrl) localStorage.setItem('auth_avatar', dataUrl);
    else localStorage.removeItem('auth_avatar');
  }

  function nameFor(technicalUser) {
    if (!technicalUser) return '';
    if (technicalUser === user.value) return displayName.value || user.value;
    return peerProfiles.value[technicalUser]?.displayName || technicalUser;
  }

  function avatarFor(technicalUser) {
    if (!technicalUser) return null;
    if (technicalUser === user.value) return avatar.value || null;
    return peerProfiles.value[technicalUser]?.avatar || null;
  }

  // ✅ Загрузить профиль любого пользователя (единожды)
  async function loadPeerProfile(technicalUser, force = false) {
    if (!technicalUser || technicalUser === user.value) return null;

    // Если уже загружали — не грузим повторно
    if (!force && loadedPeerUsers.value.has(technicalUser)) {
      return peerProfiles.value[technicalUser] || null;
    }

    try {
      const { data } = await api.get(
        `/profile/${encodeURIComponent(technicalUser)}`
      );
      if (data.ok && data.profile) {
        peerProfiles.value = {
          ...peerProfiles.value,
          [technicalUser]: {
            displayName: data.profile.displayName || technicalUser,
            avatar: data.profile.avatar || null,
          },
        };
        // ✅ Помечаем, что загрузили
        const next = new Set(loadedPeerUsers.value);
        next.add(technicalUser);
        loadedPeerUsers.value = next;

        return peerProfiles.value[technicalUser];
      }
    } catch (e) {
      console.warn('[auth] loadPeerProfile error:', technicalUser, e.message);
    }
    return null;
  }

  // ✅ Обновление профиля другого пользователя по WS
  function setPeerProfile(technicalUser, patch) {
    const cur = peerProfiles.value[technicalUser] || {};
    peerProfiles.value = {
      ...peerProfiles.value,
      [technicalUser]: {
        displayName: patch.displayName ?? cur.displayName ?? technicalUser,
        avatar: patch.avatar !== undefined ? patch.avatar : (cur.avatar ?? null),
      },
    };
    const next = new Set(loadedPeerUsers.value);
    next.add(technicalUser);
    loadedPeerUsers.value = next;
  }

  return {
    user, displayName, avatar, peerProfiles, loadedPeerUsers,
    isAuthenticated, loading,
    login, logout, checkSession,
    setDisplayName, setAvatar,
    nameFor, avatarFor,
    loadPeerProfile, setPeerProfile,
  };
});