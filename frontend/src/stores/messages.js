// frontend/src/stores/messages.js
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { api } from '@/api/client';
import { useAuthStore } from './auth';
import { playIncomingMessage } from '@/composables/useNotificationSound';

const USERS = ['Сергей', 'Саша'];
const TYPING_TIMEOUT = 3000;
const PAGE_SIZE = 50;

export const useMessagesStore = defineStore('messages', () => {
  const auth = useAuthStore();

  const messages = ref({ 'Сергей': [], 'Саша': [] });
  const unread = ref({ 'Сергей': 0, 'Саша': 0 });
  const presence = ref({ 'Сергей': null, 'Саша': null });
  const typing = ref({ 'Сергей': 0, 'Саша': 0 });

  const online = ref([]);
  const loaded = ref(false);
  const loading = ref(false);
  const hasMore = ref({ 'Сергей': true, 'Саша': true });
  const loadingMore = ref({ 'Сергей': false, 'Саша': false });

  const firstUnreadId = ref({ 'Сергей': null, 'Саша': null });

  // ✅ Флаг онлайн-соединения
  const isOnline = ref(typeof navigator !== 'undefined' ? navigator.onLine : true);
  // ✅ Очередь исходящих, которые не удалось отправить
  const pendingOut = ref([]);

  const tick = ref(0);
  setInterval(() => { tick.value++; }, 30 * 1000);

  const totalUnread = computed(() =>
    Object.values(unread.value).reduce((s, n) => s + n, 0)
  );

  function myPeer() {
    const me = auth.user || 'Сергей';
    return USERS.find(u => u !== me) || 'Саша';
  }

  function isUserOnline(user) { return online.value.includes(user); }
  function lastSeen(user) { return presence.value[user]; }
  function isTyping(user) {
    tick.value;
    return Date.now() - typing.value[user] < TYPING_TIMEOUT;
  }

  function messagesWith(peer) { return messages.value[peer] || []; }
  function pinnedWith(peer) {
    return (messages.value[peer] || []).filter(m => m.pinnedAt && !m.deletedAt);
  }
  function messageById(id) {
    for (const peer of Object.keys(messages.value)) {
      const m = messages.value[peer].find(x => x.id === id);
      if (m) return m;
    }
    return null;
  }

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

  async function loadHistory(peer, before = null) {
    const params = { peer, limit: PAGE_SIZE };
    if (before) params.before = before;

    const { data } = await api.get('/messages', { params });
    if (!data.ok) throw new Error(data.error);

    if (before) {
      const existing = messages.value[peer] || [];
      messages.value[peer] = [...data.messages, ...existing];
      hasMore.value[peer] = data.hasMore;
    } else {
      messages.value[peer] = data.messages;
      hasMore.value[peer] = data.hasMore;

      const firstUnread = data.messages.find(
        m => m.to === auth.user && !m.readAt
      );
      firstUnreadId.value[peer] = firstUnread?.id || null;
    }

    return data.messages;
  }

  async function loadMore(peer) {
    if (!hasMore.value[peer] || loadingMore.value[peer]) return;
    const list = messages.value[peer] || [];
    if (list.length === 0) return;

    loadingMore.value[peer] = true;
    try {
      const oldest = list[0].createdAt;
      await loadHistory(peer, oldest);
    } finally {
      loadingMore.value[peer] = false;
    }
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
    try { await api.post('/messages/heartbeat'); } catch (e) {}
  }

  let lastTypingSent = 0;
  let typingStopTimer = null;

  async function sendTyping(to, isTyping) {
    try { await api.post('/messages/typing', { to, typing: isTyping }); } catch (e) {}
  }

  function notifyTypingStart(to) {
    const now = Date.now();
    if (now - lastTypingSent > 1500) {
      lastTypingSent = now;
      sendTyping(to, true);
    }
    if (typingStopTimer) clearTimeout(typingStopTimer);
    typingStopTimer = setTimeout(() => {
      sendTyping(to, false);
      lastTypingSent = 0;
    }, 2500);
  }

  function notifyTypingStop(to) {
    if (typingStopTimer) clearTimeout(typingStopTimer);
    sendTyping(to, false);
    lastTypingSent = 0;
  }

  // ============================================================
  // ✅ Optimistic send
  // ============================================================
  function makeLocalId() {
    return 'local_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  }

  async function send(to, text, replyTo = null, image = null) {
    const cleanText = String(text || '').trim();
    if (!cleanText && !image) throw new Error('Пустое сообщение');

    const localId = makeLocalId();
    const now = new Date().toISOString();

    const optimistic = {
      id: localId,
      from: auth.user,
      to,
      text: cleanText,
      image: image || null,
      createdAt: now,
      readAt: null,
      editedAt: null,
      deletedAt: null,
      pinnedAt: null,
      replyTo: replyTo || null,
      reactions: [],
      pending: true,
      failed: false,
    };
    pushMessage(optimistic);

    if (!isOnline.value) {
      pendingOut.value.push({ localId, to, text: cleanText, image, replyTo, createdAt: now });
      notifyTypingStop(to);
      return optimistic;
    }

    try {
      const { data } = await api.post('/messages', {
        to,
        text: cleanText,
        replyTo,
        image: image || null,
      });
      if (!data.ok) throw new Error(data.error);

      replaceMessage(localId, data.message);
      notifyTypingStop(to);
      return data.message;
    } catch (e) {
      const m = messageById(localId);
      if (m) {
        m.pending = false;
        m.failed = true;
      }
      pendingOut.value.push({ localId, to, text: cleanText, image, replyTo, createdAt: now });
      throw e;
    }
  }

  function replaceMessage(localId, realMsg) {
    for (const peer of Object.keys(messages.value)) {
      const idx = messages.value[peer].findIndex(m => m.id === localId);
      if (idx !== -1) {
        messages.value[peer][idx] = realMsg;
        return;
      }
    }
  }

  async function retryMessage(localId) {
    const item = pendingOut.value.find(p => p.localId === localId);
    if (!item) return;

    const m = messageById(localId);
    if (m) {
      m.pending = true;
      m.failed = false;
    }

    try {
      const { data } = await api.post('/messages', {
        to: item.to,
        text: item.text,
        replyTo: item.replyTo,
        image: item.image || null,
      });
      if (!data.ok) throw new Error(data.error);
      replaceMessage(localId, data.message);
      pendingOut.value = pendingOut.value.filter(p => p.localId !== localId);
      return data.message;
    } catch (e) {
      if (m) {
        m.pending = false;
        m.failed = true;
      }
      throw e;
    }
  }

  async function flushPending() {
    if (!isOnline.value) return;
    const queue = [...pendingOut.value];
    for (const item of queue) {
      try {
        await retryMessage(item.localId);
      } catch (e) {
        console.warn('[messages] retry failed:', e.message);
      }
    }
  }

  async function edit(id, text) {
    const cleanText = String(text || '').trim();
    if (!cleanText) throw new Error('Пустой текст');
    const { data } = await api.patch(`/messages/${id}`, { text: cleanText });
    if (!data.ok) throw new Error(data.error);
    const msg = messageById(id);
    if (msg) {
      msg.text = data.message.text;
      msg.editedAt = data.message.editedAt;
    }
    return data.message;
  }

  async function remove(id) {
    const { data } = await api.delete(`/messages/${id}`);
    if (!data.ok) throw new Error(data.error);
    for (const peer of Object.keys(messages.value)) {
      messages.value[peer] = messages.value[peer].filter(m => m.id !== id);
    }
    return data;
  }

  async function togglePin(id) {
    const { data } = await api.post(`/messages/${id}/pin`);
    if (!data.ok) throw new Error(data.error);
    const msg = messageById(id);
    if (msg) msg.pinnedAt = data.message.pinnedAt;
    return data;
  }

  async function toggleReaction(id, emoji) {
    const msg = messageById(id);
    if (!msg) return;
    const previousReactions = JSON.parse(JSON.stringify(msg.reactions || []));
    const currentUserReaction = (msg.reactions || [])
      .find(r => r.users.includes(auth.user))?.emoji;
    const nextReactions = (msg.reactions || [])
      .map(r => ({ ...r, users: r.users.filter(u => u !== auth.user) }))
      .filter(r => r.users.length > 0);
    if (currentUserReaction !== emoji) {
      const target = nextReactions.find(r => r.emoji === emoji);
      if (target) target.users.push(auth.user);
      else nextReactions.push({ emoji, users: [auth.user] });
    }
    msg.reactions = nextReactions;
    try {
      const { data } = await api.post(`/messages/${id}/reaction`, { emoji });
      if (!data.ok) throw new Error(data.error);
      msg.reactions = data.reactions;
      return data;
    } catch (e) {
      msg.reactions = previousReactions;
      throw e;
    }
  }

  async function markRead(id) {
    const { data } = await api.patch(`/messages/${id}/read`);
    if (!data.ok) throw new Error(data.error);
    const msg = messageById(id);
    if (msg) msg.readAt = data.readAt;
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
    firstUnreadId.value[peer] = null;
    return data;
  }

  function pushMessage(msg) {
    if (!msg || !msg.from || !msg.to) return;
    const peer = msg.from === auth.user ? msg.to : msg.from;
    if (!messages.value[peer]) messages.value[peer] = [];
    if (messages.value[peer].some(m => m.id === msg.id)) return;
    messages.value[peer].push(msg);
    messages.value[peer].sort(
      (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
    );
    if (msg.to === auth.user && !msg.readAt && !msg.pending) {
      unread.value[msg.from] = (unread.value[msg.from] || 0) + 1;
    }
  }

  function onIncoming(msg) {
    pushMessage(msg);
    if (msg.from) presence.value[msg.from] = msg.createdAt;
    if (msg.to === auth.user) {
      try { playIncomingMessage(); } catch (e) {}
    }
    if (msg.from) typing.value[msg.from] = 0;
  }

  function onEdited(msg) {
    const m = messageById(msg.id);
    if (m) { m.text = msg.text; m.editedAt = msg.editedAt; }
  }

  function onDeleted({ id }) {
    for (const peer of Object.keys(messages.value)) {
      messages.value[peer] = messages.value[peer].filter(m => m.id !== id);
    }
  }

  function onPinned(msg) {
    const m = messageById(msg.id);
    if (m) m.pinnedAt = msg.pinnedAt;
  }

  function onRead({ id, readAt }) {
    const m = messageById(id);
    if (m) m.readAt = readAt;
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

  function onPresence({ user, lastSeen: ls }) {
    if (user && ls) presence.value[user] = ls;
  }

  function onReaction({ messageId, reactions }) {
    const m = messageById(messageId);
    if (m) m.reactions = reactions;
  }

  function onTyping({ from, to, typing: isTypingFlag }) {
    if (to !== auth.user) return;
    typing.value[from] = isTypingFlag ? Date.now() : 0;
  }

  function setOnline(list) {
    online.value = Array.isArray(list) ? list : [];
  }

  function setNetworkOnline(flag) {
    isOnline.value = !!flag;
    if (flag) flushPending();
  }

  function reset() {
    messages.value = { 'Сергей': [], 'Саша': [] };
    unread.value = { 'Сергей': 0, 'Саша': 0 };
    presence.value = { 'Сергей': null, 'Саша': null };
    typing.value = { 'Сергей': 0, 'Саша': 0 };
    online.value = [];
    loaded.value = false;
    hasMore.value = { 'Сергей': true, 'Саша': true };
    firstUnreadId.value = { 'Сергей': null, 'Саша': null };
    pendingOut.value = [];
  }

  return {
    messages, unread, presence, typing, online, loaded, loading,
    tick, hasMore, loadingMore, firstUnreadId,
    isOnline, pendingOut,
    totalUnread,

    myPeer, isUserOnline, lastSeen, isTyping,
    messagesWith, pinnedWith, messageById,

    loadConversations, loadHistory, loadMore, loadUnread, loadPresence, heartbeat,
    notifyTypingStart, notifyTypingStop,

    send, retryMessage, flushPending,
    edit, remove, togglePin, toggleReaction, markRead, markAllRead,

    pushMessage, onIncoming, onEdited, onDeleted, onPinned,
    onRead, onReadAll, onPresence, onReaction, onTyping,
    setOnline, setNetworkOnline, reset,
  };
});