// frontend/src/composables/useWebSocket.js
import { io } from 'socket.io-client';
import { ref } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useAccountsStore } from '@/stores/accounts';

let socket = null;
const connected = ref(false);
const online = ref([]);

export function useWebSocket() {
  const auth = useAuthStore();
  const accounts = useAccountsStore();

  function connect() {
    if (socket) return;

    const rawUrl = import.meta.env.VITE_WS_URL;
    const wsUrl = (!rawUrl || rawUrl === '/') ? undefined : rawUrl;

    socket = io(wsUrl, {
      withCredentials: true,
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socket.on('connect', () => {
      connected.value = true;
      console.log('[ws] подключились, id:', socket.id);
    });

    socket.on('state', (state) => accounts.setFromWS(state));

    socket.on('users:online', (list) => {
      online.value = Array.isArray(list) ? list : [];
    });

    // ✅ Профиль обновлён — может быть и от другого пользователя
    socket.on('profile:update', (payload) => {
      console.log('[ws] profile:update', payload);
      if (!payload) return;
      if (payload.user && payload.user !== auth.user) {
        auth.setPeerProfile(payload.user, {
          displayName: payload.displayName,
          avatar: payload.avatar,
        });
      }
      window.dispatchEvent(new CustomEvent('profile:updated', { detail: payload }));
    });

    socket.on('disconnect', (reason) => {
      connected.value = false;
      console.log('[ws] отключились:', reason);
    });

    socket.on('connect_error', (err) => {
      console.warn('[ws] ошибка подключения:', err.message);
    });
  }

  function disconnect() {
    if (!socket) return;
    socket.disconnect();
    socket = null;
    connected.value = false;
    online.value = [];
  }

  return { connect, disconnect, connected, online };
}