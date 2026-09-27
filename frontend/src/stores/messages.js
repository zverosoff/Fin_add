// frontend/src/stores/messages.js
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { api } from '@/api/client';
import { useAuthStore } from './auth';
import { useToast } from '@/composables/useToast';
import { notifyIncomingMessage } from '@/composables/usePushNotifications';

const USERS = ['Сергей', 'Саша'];

export const useMessagesStore = defineStore('messages', () => {
  const auth = useAuthStore();

  // messages: { 'Саша': [ {id, from, to, text, createdAt, readAt}, ... ] }
  const messages = ref({
    'Сергей': [],
    'Саша':   [],
  });

  const unread = ref({
    'Сергей': 0,
    'Саша':   0,
  });

  const online = ref([]);   // ['Сергей', 'Саша']
  const loaded = ref(false);
  const loading = ref(false);

  // ============================================================
  // Computed
  // ============================================================
  const totalUnread = computed(() =>
    Object.values(unread.value).reduce((s, n) => s + n, 0)
  );

  function myPeer() {
    // Возвращает имя второго пользователя (не меня)
    const me = auth.user || 'Сергей';
    return USERS.find(u => u !== me) || 'Саша';
  }

  function isOnline(user) {
    return online.value.includes(user);
  }

  function messagesWith(peer) {
    return messages.value[peer] || [];
  }

  // ============================================================
  // Загрузка
  // ============================================================
  async function loadConversations() {
    loading.value = true;
    try {
      const { data } = await api.get('/messages/conversations');
      if (!data.ok) throw new Error(data.error);
      // Обновляем unread
      for (const c of data.conversations) {
        unread.value[c.peer] = c.unread;
      }
      loaded.value = true;
      return data.conversations;
    } finally {
      loading.value = false;
    }
  }

  async function loadHistory(peer, limit = 200) {
    const { data } = await api.get('/messages', { params: { peer, limit } });
    if (!data.ok) throw new Error(data.error);
    messages.value[peer] = data.messages;
    return data.messages;
  }

  async function loadUnread() {
    const { data } = await api.get('/messages/unread');
    if (!data.ok) throw new Error(data.error);
    unread.value = data.unread;
    return data.unread;
  }

  // ============================================================
  // Отправка
  // ============================================================
  async function send(to, text) {
    const cleanText = String(text || '').trim();
    if (!cleanText) throw new Error('Пустое сообщение');

    const { data } = await api.post('/messages', { to, text: cleanText });
    if (!data.ok) throw new Error(data.error);

    // Оптимистично добавляем в список
    pushMessage(data.message);
    return data.message;
  }

  // ============================================================
  // Прочитано
  // ============================================================
  async function markRead(id) {
    const { data } = await api.patch(`/messages/${id}/read`);
    if (!data.ok) throw new Error(data.error);
    // Локально
    for (const peer of Object.keys(messages.value)) {
      const msg = messages.value[peer].find(m => m.id === id);
      if (msg) msg.readAt = data.readAt;
    }
    return data;
  }

  async function markAllRead(peer) {
    const { data } = await api.patch(`/messages/read-all?peer=${encodeURIComponent(peer)}`);
    if (!data.ok) throw new Error(data.error);
    // Локально
    const list = messages.value[peer] || [];
    for (const m of list) {
      if (m.to === auth.user && !m.readAt) m.readAt = data.readAt;
    }
    unread.value[peer] = 0;
    return data;
  }

  async function remove(id) {
    const { data } = await api.delete(`/messages/${id}`);
    if (!data.ok) throw new Error(data.error);
    for (const peer of Object.keys(messages.value)) {
      messages.value[peer] = messages.value[peer].filter(m => m.id !== id);
    }
    return data;
  }

  // ============================================================
  // WebSocket-обработчики
  // ============================================================
  function pushMessage(msg) {
    if (!msg || !msg.from || !msg.to) return;
    const peer = msg.from === auth.user ? msg.to : msg.from;
    if (!messages.value[peer]) messages.value[peer] = [];

    // Дедупликация
    if (messages.value[peer].some(m => m.id === msg.id)) return;

    messages.value[peer].push(msg);

    // Сортировка по дате
    messages.value[peer].sort(
      (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
    );

    // Обновляем unread если сообщение адресовано мне
    if (msg.to === auth.user && !msg.readAt) {
      unread.value[msg.from] = (unread.value[msg.from] || 0) + 1;
    }
  }

  function onIncoming(msg) {
    pushMessage(msg);

    // ✅ PWA-уведомление, если сообщение адресовано мне и я не на этой странице
    if (msg.to === auth.user) {
      const isChatOpen = document.body.dataset.chatOpen === 'true';
      const isHidden = document.visibilityState !== 'visible';

      if (!isChatOpen || isHidden) {
        try {
          notifyIncomingMessage(msg);
        } catch (e) {
          console.warn('[messages] notify error:', e);
        }
      }
    }
  }

  function onRead({ id, readAt }) {
    for (const peer of Object.keys(messages.value)) {
      const msg = messages.value[peer].find(m => m.id === id);
      if (msg) msg.readAt = readAt;
    }
  }

  function onReadAll({ peer, by }) {
    // peer — кто читал, by — кто прочитал (я)
    if (by === auth.user) {
      unread.value[peer] = 0;
      const list = messages.value[peer] || [];
      for (const m of list) {
        if (m.from === peer && m.to === auth.user && !m.readAt) {
          m.readAt = new Date().toISOString();
        }
      }
    }
  }

  function onDeleted({ id }) {
    for (const peer of Object.keys(messages.value)) {
      messages.value[peer] = messages.value[peer].filter(m => m.id !== id);
    }
  }

  function setOnline(list) {
    online.value = Array.isArray(list) ? list : [];
  }

  function reset() {
    messages.value = { 'Сергей': [], 'Саша': [] };
    unread.value = { 'Сергей': 0, 'Саша': 0 };
    online.value = [];
    loaded.value = false;
  }

  return {
    // state
    messages,
    unread,
    online,
    loaded,
    loading,

    // computed
    totalUnread,

    // helpers
    myPeer,
    isOnline,
    messagesWith,

    // actions
    loadConversations,
    loadHistory,
    loadUnread,
    send,
    markRead,
    markAllRead,
    remove,

    // ws
    pushMessage,
    onIncoming,
    onRead,
    onReadAll,
    onDeleted,
    setOnline,
    reset,
  };
});