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

    const wsUrl = import.meta.env.VITE_WS_URL || undefined;

    socket = io(wsUrl, {
      auth: { token: auth.token },
      transports: ['websocket'],
      withCredentials: true,
    });

    socket.on('connect', () => {
      connected.value = true;
      console.log('[ws] подключились');
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
      console.warn('[ws] ошибка:', err.message);
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