import { io } from 'socket.io-client';
import { ref } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useAccountsStore } from '@/stores/accounts';

let socket = null;
const connected = ref(false);

export function useWebSocket() {
  const auth = useAuthStore();
  const accounts = useAccountsStore();

  function connect() {
    if (socket) return;

    // ✅ Если VITE_WS_URL не задан или '/' — подключаемся к текущему origin
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

    socket.on('state', (state) => {
      console.log('[ws] новое состояние');
      accounts.setFromWS(state);
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