// frontend/src/composables/useWebSocket.js
import { io } from 'socket.io-client';
import { ref } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useAccountsStore } from '@/stores/accounts';
import { useMessagesStore } from '@/stores/messages';

let socket = null;
const connected = ref(false);

export function useWebSocket() {
  const auth = useAuthStore();
  const accounts = useAccountsStore();
  const messages = useMessagesStore();

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

    // Сообщения
    socket.on('message:new',      (msg) => messages.onIncoming(msg));
    socket.on('message:edited',   (msg) => messages.onEdited(msg));
    socket.on('message:deleted',  (p)   => messages.onDeleted(p));
    socket.on('message:pinned',   (msg) => messages.onPinned(msg));
    socket.on('message:read',     (p)   => messages.onRead(p));
    socket.on('message:read-all', (p)   => messages.onReadAll(p));
    socket.on('reaction:update',  (p)   => messages.onReaction(p));
    socket.on('typing:update',    (p)   => messages.onTyping(p));

    socket.on('users:online',    (list) => messages.setOnline(list));
    socket.on('presence:update', (p)    => messages.onPresence(p));

    // ✅ НОВОЕ: обновление профиля (имя/аватар)
    // Бэкенд шлёт: { user, displayName, avatar }
    // Прокидываем через CustomEvent, чтобы ProfileView мог отреагировать.
    socket.on('profile:update', (payload) => {
      console.log('[ws] profile:update', payload);
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
  }

  return { connect, disconnect, connected };
}