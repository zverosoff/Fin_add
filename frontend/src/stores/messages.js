// frontend/src/stores/messages.js
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { api } from '@/api/client';
import { useAuthStore } from './auth';
import { notifyIncomingMessage } from '@/composables/usePushNotifications';

const USERS = ['Сергей', 'Саша'];

export const useMessagesStore = defineStore('messages', () => {
  const auth = useAuthStore();

  const messages = ref({
    'Сергей': [],
    'Саша':   [],
  });

  const unread = ref({
    'Сергей': 0,
    'Саша':   0,
  });

  const presence = ref({
    'Сергей': null,
    'Саша':   null,
  });

  const online = ref([]);
  const loaded = ref(false);
  const loading = ref(false);

  // ============================================================
  // Computed
  // ============================================================
  const totalUnread = computed(() =>
    Object.values(unread.value).reduce((s, n) => s + n, 0)
  );

  function myPeer() {
    const me = auth.user || 'Сергей';
    return USERS.find(u => u !== me) || 'Саша';
  }

  function isOnline(user) {
    return online.value.includes(user);
  }

  function lastSeen(user) {
    return presence.value[user];
  }

  function messagesWith(peer) {
    return messages.value[peer] || [];
  }

  function pinnedWith(peer) {
    return (messages.value[peer] || []).filter(m => m.pinnedAt && !m.deletedAt);
  }

  // ============================================================
  // Загрузка
  // ============================================================
  async function loadConversations() {
    loading.value = true;
    try {
      const { data } = await api.get('/messages/conversations');
      if (!data.ok) throw new Error(data.error);

      for (const c of data.conversations) {
        unread.value[c.peer] = c.unread;
        presence.value[c.peer] = c.lastSeen;
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

  async function loadPresence() {
    const { data } = await api.get('/messages/presence');
    if (!data.ok) throw new Error(data.error);
    presence.value = data.presence;
    return data.presence;
  }

  async function heartbeat() {
    try {
      await api.post('/messages/heartbeat');
    } catch (e) {
      // тихо
    }
  }

  // ============================================================
  // Отправка
  // ============================================================
  async function send(to, text, replyTo = null) {
    const cleanText = String(text || '').trim();
    if (!cleanText) throw new Error('Пустое сообщение');

    const { data } = await api.post('/messages', { to, text: cleanText, replyTo });
    if (!data.ok) throw new Error(data.error);

    pushMessage(data.message);
    return data.message;
  }

  // ============================================================
  // Редактирование
  // ============================================================
  async function edit(id, text) {
    const cleanText = String(text || '').trim();
    if (!cleanText) throw new Error('Пустой текст');

    const { data } = await api.patch(`/messages/${id}`, { text: cleanText });
    if (!data.ok) throw new Error(data.error);

    // Локально
    for (const peer of Object.keys(messages.value)) {
      const msg = messages.value[peer].find(m => m.id === id);
      if (msg) {
        msg.text = data.message.text;
        msg.editedAt = data.message.editedAt;
      }
    }
    return data.message;
  }

  // ============================================================
  // Удаление (soft)
  // ============================================================
  async function remove(id) {
    const { data } = await api.delete(`/messages/${id}`);
    if (!data.ok) throw new Error(data.error);

    for (const peer of Object.keys(messages.value)) {
      messages.value[peer] = messages.value[peer].filter(m => m.id !== id);
    }
    return data;
  }

  // ============================================================
  // Пиннед
  // ============================================================
  async function togglePin(id) {
    const { data } = await api.post(`/messages/${id}/pin`);
    if (!data.ok) throw new Error(data.error);

    for (const peer of Object.keys(messages.value)) {
      const msg = messages.value[peer].find(m => m.id === id);
      if (msg) msg.pinnedAt = data.message.pinnedAt;
    }
    return data;
  }

  // ============================================================
  // Прочитано
  // ============================================================
  async function markRead(id) {
    const { data } = await api.patch(`/messages/${id}/read`);
    if (!data.ok) throw new Error(data.error);

    for (const peer of Object.keys(messages.value)) {
      const msg = messages.value[peer].find(m => m.id === id);
      if (msg) msg.readAt = data.readAt;
    }
    return data;
  }

  async function markAllRead(peer) {
    const { data } = await api.patch(`/messages/read-all?peer=${encodeURIComponent(peer)}`);
    if (!data.ok) throw new Error(data.error);

    const list = messages.value[peer] || [];
    for (const m of list) {
      if (m.to === auth.user && !m.readAt) m.readAt = data.readAt;
    }
    unread.value[peer] = 0;
    return data;
  }

  // ============================================================
  // WebSocket-обработчики
  // ============================================================
  function pushMessage(msg) {
    if (!msg || !msg.from || !msg.to) return;
    const peer = msg.from === auth.user ? msg.to : msg.from;
    if (!messages.value[peer]) messages.value[peer] = [];
    if (messages.value[peer].some(m => m.id === msg.id)) return;

    messages.value[peer].push(msg);
    messages.value[peer].sort(
      (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
    );

    if (msg.to === auth.user && !msg.readAt) {
      unread.value[msg.from] = (unread.value[msg.from] || 0) + 1;
    }
  }

  function onIncoming(msg) {
    pushMessage(msg);

    // Обновляем presence отправителя
    if (msg.from) presence.value[msg.from] = msg.createdAt;

    if (msg.to === auth.user) {
      const isChatOpen = document.body.dataset.chatOpen === 'true';
      const isHidden = document.visibilityState !== 'visible';

      if (!isChatOpen || isHidden) {
        try { notifyIncomingMessage(msg); } catch (e) { /* ignore */ }
      }
    }
  }

  function onEdited(msg) {
    for (const peer of Object.keys(messages.value)) {
      const m = messages.value[peer].find(x => x.id === msg.id);
      if (m) {
        m.text = msg.text;
        m.editedAt = msg.editedAt;
      }
    }
  }

  function onDeleted({ id }) {
    for (const peer of Object.keys(messages.value)) {
      messages.value[peer] = messages.value[peer].filter(m => m.id !== id);
    }
  }

  function onPinned(msg) {
    for (const peer of Object.keys(messages.value)) {
      const m = messages.value[peer].find(x => x.id === msg.id);
      if (m) m.pinnedAt = msg.pinnedAt;
    }
  }

  function onRead({ id, readAt }) {
    for (const peer of Object.keys(messages.value)) {
      const msg = messages.value[peer].find(m => m.id === id);
      if (msg) msg.readAt = readAt;
    }
  }

  function onReadAll({ peer, by }) {
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

  function onPresence({ user, lastSeen }) {
    if (user && lastSeen) presence.value[user] = lastSeen;
  }

  function setOnline(list) {
    online.value = Array.isArray(list) ? list : [];
  }

  function reset() {
    messages.value = { 'Сергей': [], 'Саша': [] };
    unread.value = { 'Сергей': 0, 'Саша': 0 };
    presence.value = { 'Сергей': null, 'Саша': null };
    online.value = [];
    loaded.value = false;
  }

  return {
    messages,
    unread,
    presence,
    online,
    loaded,
    loading,

    totalUnread,

    myPeer,
    isOnline,
    lastSeen,
    messagesWith,
    pinnedWith,

    loadConversations,
    loadHistory,
    loadUnread,
    loadPresence,
    heartbeat,
    send,
    edit,
    remove,
    togglePin,
    markRead,
    markAllRead,

    pushMessage,
    onIncoming,
    onEdited,
    onDeleted,
    onPinned,
    onRead,
    onReadAll,
    onPresence,
    setOnline,
    reset,
  };
});