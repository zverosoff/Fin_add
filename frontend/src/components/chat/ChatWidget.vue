<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { useMessagesStore } from '@/stores/messages';
import { useAuthStore } from '@/stores/auth';
import { useToast } from '@/composables/useToast';
import { linkify } from '@/composables/useLinkify';
import { useTheme } from '@/composables/useTheme';
import {
  playOutgoingMessage,
  playReaction,
  playError,
} from '@/composables/useNotificationSound';
import {
  getPermission,
  requestPermission,
  updateBadge,
} from '@/composables/usePushNotifications';

const messages = useMessagesStore();
const auth = useAuthStore();
const toast = useToast();
const { theme, background, setTheme, setBackground, THEMES, BACKGROUNDS } = useTheme();

const open = ref(false);
const text = ref('');
const sending = ref(false);
const scrollEl = ref(null);
const inputEl = ref(null);
const fileEl = ref(null);

// Контекстное меню
const menu = ref({ open: false, x: 0, y: 0, message: null });

// Панели
const activePanel = ref('keyboard');

// Режим редактирования
const editing = ref(null);
const editText = ref('');

// Ответ
const replyTo = ref(null);

// ✅ Изображение к отправке
const pendingImage = ref(null);

// ✅ Fullscreen просмотр
const fullscreenImage = ref(null);

// Mobile viewport
const panelHeight = ref('');
const panelTop = ref('');

// Пагинация
const loadingOlder = ref(false);

// Кнопка «вниз»
const showScrollDown = ref(false);
const newBelowCount = ref(0);

// ✅ Swipe-to-reply
const swipeState = ref({ id: null, startX: 0, startY: 0, dx: 0, active: false });

// Emoji picker
const EMOJI_CATEGORIES = [
  {
    id: 'smileys',
    icon: '😀',
    label: 'Смайлы',
    emojis: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🤧','🥵','🥶','😵','🤯','🤠','🥳','😎','🤓','🧐','😕','😟','🙁','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿'],
  },
  {
    id: 'gestures',
    icon: '👍',
    label: 'Жесты',
    emojis: ['👍','👎','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','👇','☝️','✋','🤚','🖐️','🖖','👋','🤝','🙏','✍️','💅','🤳','💪','🦾','🦵','🦶','👂','🦻','👃','🧠','🦷','👀','👁️','👅','👄','💋','🩸','🤲','👐','🙌','👏','🤜','🤛','✊','👊'],
  },
  {
    id: 'hearts',
    icon: '❤️',
    label: 'Сердца',
    emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','♥️','💌','💋','🔥','✨','⭐','🌟','💫','⚡','💥','💢','💤','💨','🎉','🎊','🎈','🎁'],
  },
  {
    id: 'animals',
    icon: '🐱',
    label: 'Животные',
    emojis: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐒','🐔','🐧','🐦','🐤','🐣','🐥','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🐛','🦋','🐌','🐞','🐜','🦗','🕷️','🦂','🐢','🐍','🦎','🦖','🦕','🐙','🦑','🦐'],
  },
  {
    id: 'food',
    icon: '🍕',
    label: 'Еда',
    emojis: ['🍏','🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🍆','🥑','🥦','🥬','🥒','🌶️','🌽','🥕','🧄','🧅','🥔','🍠','🥐','🥯','🍞','🥖','🥨','🧀','🥚','🍳','🧈','🥞','🧇','🥓','🥩','🍗','🍖','🌭','🍔','🍟','🍕'],
  },
];

const activeEmojiCat = ref('smileys');
const currentEmojiList = computed(() =>
  EMOJI_CATEGORIES.find(c => c.id === activeEmojiCat.value)?.emojis || []
);

const me = computed(() => auth.user || 'Сергей');
const peer = computed(() => messages.myPeer());
const peerEmoji = computed(() => peer.value === 'Сергей' ? '👨' : '👩');
const peerOnline = computed(() => messages.isOnline(peer.value));
const peerTyping = computed(() => messages.isTyping(peer.value));

const history = computed(() => messages.messagesWith(peer.value));
const pinned = computed(() => messages.pinnedWith(peer.value));
const pinnedLatest = computed(() =>
  [...pinned.value].sort((a, b) => new Date(b.pinnedAt) - new Date(a.pinnedAt))[0]
);
const totalUnread = computed(() => messages.totalUnread);
const firstUnreadId = computed(() => messages.firstUnreadId[peer.value]);

const peerStatusText = computed(() => {
  if (peerTyping.value) return 'печатает…';
  if (peerOnline.value) return 'в сети';
  const last = messages.lastSeen(peer.value);
  if (!last) return 'был(а) недавно';
  return fmtLastSeen(last);
});

function fmtLastSeen(iso) {
  if (!iso) return 'был(а) недавно';
  const d = new Date(iso);
  const now = new Date();
  const diffSec = Math.floor((now - d) / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffSec < 60) return 'был(а) только что';
  if (diffMin < 60) return `был(а) ${diffMin} мин назад`;
  if (diffHours < 24) return `был(а) ${diffHours} ч назад`;
  if (diffDays === 1) return 'был(а) вчера';
  if (diffDays < 7) return `был(а) ${diffDays} дн назад`;
  return 'был(а) ' + d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

// ============================================================
// Авторастущий textarea
// ============================================================
function autoResize() {
  const el = inputEl.value;
  if (!el) return;
  el.style.height = 'auto';
  const maxH = 5 * 18 + 14;
  el.style.height = Math.min(el.scrollHeight, maxH) + 'px';
}

function onInput() {
  autoResize();
  if (text.value.trim()) messages.notifyTypingStart(peer.value);
  else messages.notifyTypingStop(peer.value);
}

// ============================================================
// ✅ Swipe style (вынесено из template, чтобы не ломать парсер)
// ============================================================
function swipeStyle(m) {
  if (swipeState.value.active && swipeState.value.id === m.id) {
    const dx = Math.min(swipeState.value.dx, 80);
    return { transform: `translateX(${dx}px)` };
  }
  return {};
}

// ============================================================
// Изображения
// ============================================================
function openFilePicker() {
  fileEl.value?.click();
}

function onFileChange(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    toast.error('Только изображения');
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    toast.error('Максимум 5MB');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    pendingImage.value = reader.result;
  };
  reader.readAsDataURL(file);
  e.target.value = '';
}

function cancelImage() {
  pendingImage.value = null;
}

function openFullscreen(src) {
  fullscreenImage.value = src;
}

function closeFullscreen() {
  fullscreenImage.value = null;
}

// ============================================================
// Emoji picker
// ============================================================
function toggleEmoji() {
  if (activePanel.value === 'emoji') {
    activePanel.value = 'keyboard';
    nextTick(() => inputEl.value?.focus());
  } else {
    activePanel.value = 'emoji';
    inputEl.value?.blur();
  }
}

function insertEmoji(emoji) {
  text.value += emoji;
  nextTick(() => {
    autoResize();
    inputEl.value?.focus();
  });
  messages.notifyTypingStart(peer.value);
}

function onBackspace() {
  text.value = [...text.value].slice(0, -1).join('');
  nextTick(autoResize);
}

// ============================================================
// Settings panel
// ============================================================
function toggleSettings() {
  if (activePanel.value === 'settings') {
    activePanel.value = 'keyboard';
    nextTick(() => inputEl.value?.focus());
  } else {
    activePanel.value = 'settings';
    inputEl.value?.blur();
  }
}

// ============================================================
// Скролл
// ============================================================
function isNearBottom() {
  if (!scrollEl.value) return true;
  const el = scrollEl.value;
  return el.scrollHeight - el.scrollTop - el.clientHeight < 120;
}

function scrollToBottom(smooth = false) {
  if (!scrollEl.value) return;
  if (smooth) {
    scrollEl.value.scrollTo({ top: scrollEl.value.scrollHeight, behavior: 'smooth' });
  } else {
    scrollEl.value.scrollTop = scrollEl.value.scrollHeight;
  }
  newBelowCount.value = 0;
  showScrollDown.value = false;
}

function scrollToMessage(id) {
  const el = scrollEl.value?.querySelector(`[data-msg-id="${id}"]`);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('highlight');
    setTimeout(() => el.classList.remove('highlight'), 1200);
  }
}

async function onScroll() {
  const el = scrollEl.value;
  if (!el) return;
  const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  showScrollDown.value = !nearBottom && newBelowCount.value > 0;

  if (el.scrollTop < 80 && messages.hasMore[peer.value] && !loadingOlder.value) {
    loadingOlder.value = true;
    const prevScrollHeight = el.scrollHeight;
    const prevScrollTop = el.scrollTop;
    try {
      await messages.loadMore(peer.value);
      await nextTick();
      el.scrollTop = el.scrollHeight - prevScrollHeight + prevScrollTop;
    } catch (e) {
      console.warn('[chat] loadMore error:', e);
    } finally {
      loadingOlder.value = false;
    }
  }
}

// ============================================================
// Открытие/закрытие
// ============================================================
async function toggle() {
  open.value = !open.value;
  if (open.value) {
    document.body.dataset.chatOpen = 'true';
    await ensureHistory();
    await nextTick();
    const firstUnread = firstUnreadId.value;
    if (firstUnread) {
      const m = messages.messageById(firstUnread);
      if (m && !m.readAt) nextTick(() => scrollToMessage(firstUnread));
      else scrollToBottom();
    } else {
      scrollToBottom();
    }
    setTimeout(() => inputEl.value?.focus(), 150);
    try {
      await messages.markAllRead(peer.value);
      await updateBadge(messages.totalUnread);
    } catch (e) {}
    updateViewport();
  } else {
    document.body.dataset.chatOpen = 'false';
    closeMenu();
    messages.notifyTypingStop(peer.value);
    activePanel.value = 'keyboard';
    pendingImage.value = null;
  }
}

async function ensureHistory() {
  if (!messages.loaded) {
    try { await messages.loadConversations(); } catch (e) {}
  }
  try { await messages.loadHistory(peer.value); } catch (e) {}
}

function close() { if (open.value) toggle(); }

// ============================================================
// Отправка
// ============================================================
async function send() {
  const clean = text.value.trim();
  if ((!clean && !pendingImage.value) || sending.value) return;
  sending.value = true;
  try {
    await messages.send(peer.value, clean, replyTo.value?.id || null, pendingImage.value);
    text.value = '';
    replyTo.value = null;
    pendingImage.value = null;
    await nextTick();
    autoResize();
    try { playOutgoingMessage(); } catch (e) {}
    await nextTick();
    scrollToBottom(true);
  } catch (e) {
    toast.error('Не отправилось: ' + e.message);
    try { playError(); } catch (err) {}
  } finally {
    sending.value = false;
  }
}

function onKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  if (e.key === 'Escape') {
    if (fullscreenImage.value) fullscreenImage.value = null;
    else if (editing.value) editing.value = null;
    else if (replyTo.value) replyTo.value = null;
    else close();
  }
}

// ============================================================
// Редактирование / Удаление / Пиннед / Ответ
// ============================================================
function startEdit(msg) {
  editing.value = msg;
  editText.value = msg.text;
  replyTo.value = null;
  closeMenu();
  activePanel.value = 'keyboard';
  nextTick(() => { inputEl.value?.focus(); autoResize(); });
}

async function saveEdit() {
  const clean = editText.value.trim();
  if (!clean || clean === editing.value.text) { editing.value = null; return; }
  try {
    await messages.edit(editing.value.id, clean);
    toast.success('✏️ Сообщение изменено');
    editing.value = null;
    editText.value = '';
  } catch (e) {
    toast.error('Ошибка: ' + e.message);
  }
}

function cancelEdit() { editing.value = null; editText.value = ''; }

async function removeMsg(msg) {
  closeMenu();
  if (!confirm('Удалить сообщение?')) return;
  try {
    await messages.remove(msg.id);
    toast.info('🗑 Сообщение удалено');
  } catch (e) { toast.error('Ошибка: ' + e.message); }
}

async function togglePin(msg) {
  closeMenu();
  try {
    const res = await messages.togglePin(msg.id);
    toast.info(res.pinned ? '📌 Закреплено' : '📌 Откреплено');
  } catch (e) { toast.error('Ошибка: ' + e.message); }
}

function startReply(msg) {
  replyTo.value = msg;
  editing.value = null;
  closeMenu();
  activePanel.value = 'keyboard';
  nextTick(() => { inputEl.value?.focus(); autoResize(); });
}

function cancelReply() { replyTo.value = null; }

function getQuoteText(id) {
  const m = messages.messageById(id);
  if (!m) return 'сообщение';
  const who = m.from === me.value ? 'Вы' : m.from;
  const txt = (m.text || '').slice(0, 60) || (m.image ? '📷 Изображение' : '');
  return `${who}: ${txt}`;
}

// ============================================================
// Реакции
// ============================================================
async function addReaction(msg, emoji) {
  try {
    await messages.toggleReaction(msg.id, emoji);
    try { playReaction(); } catch (e) {}
  } catch (e) { toast.error('Ошибка: ' + e.message); }
  closeMenu();
}

async function copyMessage(msg) {
  closeMenu();
  try {
    await navigator.clipboard.writeText(msg.text || '');
    toast.success('📋 Скопировано');
  } catch (e) { toast.error('Не удалось скопировать'); }
}

// ============================================================
// Контекстное меню
// ============================================================
let longPressTimer = null;
let longPressStart = null;
let longPressTriggered = false;
let pointerStillDown = false;
let menuOpenedAt = 0;

function openMenu(e, msg) {
  if (e.cancelable) e.preventDefault();
  e.stopPropagation();

  let x = e.clientX || 0;
  let y = e.clientY || 0;
  if (e.touches?.[0]) { x = e.touches[0].clientX; y = e.touches[0].clientY; }
  if (e.changedTouches?.[0]) { x = e.changedTouches[0].clientX; y = e.changedTouches[0].clientY; }

  const menuW = 340;
  const menuH = 400;
  x = Math.min(x, window.innerWidth - menuW - 8);
  y = Math.min(y, window.innerHeight - menuH - 8);
  x = Math.max(8, x);
  y = Math.max(8, y);

  menuOpenedAt = Date.now();
  menu.value = { open: true, x, y, message: msg };

  if (navigator.vibrate) navigator.vibrate(15);
}

function closeMenu() {
  if (pointerStillDown) return;
  if (Date.now() - menuOpenedAt < 400) return;
  menu.value.open = false;
  menu.value.message = null;
}

const menuIsMine = computed(() => menu.value.message?.from === me.value);
const currentUserReactionOn = computed(() => {
  const m = menu.value.message;
  if (!m) return null;
  return (m.reactions || []).find(r => r.users.includes(me.value))?.emoji || null;
});

// ============================================================
// Long-press + Swipe-to-reply
// ============================================================
function onTouchStart(e, msg) {
  if (window.innerWidth > 700) return;
  if (e.touches.length !== 1) return;

  swipeState.value = {
    id: msg.id,
    startX: e.touches[0].clientX,
    startY: e.touches[0].clientY,
    dx: 0,
    active: true,
  };

  longPressTriggered = false;
  pointerStillDown = true;
  longPressStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  if (longPressTimer) clearTimeout(longPressTimer);
  longPressTimer = setTimeout(() => {
    longPressTimer = null;
    longPressTriggered = true;
    openMenu({
      clientX: longPressStart.x,
      clientY: longPressStart.y,
      cancelable: false,
      preventDefault: () => {},
      stopPropagation: () => {},
    }, msg);
  }, 450);
}

function onTouchMove(e) {
  const s = swipeState.value;
  if (!s.active || e.touches.length !== 1) return;
  const dx = e.touches[0].clientX - s.startX;
  const dy = e.touches[0].clientY - s.startY;

  if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    s.dx = Math.max(0, dx);
  } else if (Math.abs(dy) > 10) {
    s.dx = 0;
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }
}

function onTouchEnd(e) {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
  pointerStillDown = false;

  const s = swipeState.value;
  if (s.active && s.dx > 60) {
    const msg = messages.messageById(s.id);
    if (msg) startReply(msg);
    if (e && e.cancelable) e.preventDefault();
    e && e.stopPropagation();
  }
  swipeState.value = { id: null, startX: 0, startY: 0, dx: 0, active: false };

  if (longPressTriggered) {
    if (e && e.cancelable) e.preventDefault();
    e && e.stopPropagation();
    setTimeout(() => { longPressTriggered = false; }, 250);
  }
  longPressStart = null;
}

function onContextMenu(e, msg) {
  e.preventDefault();
  e.stopPropagation();
  pointerStillDown = false;
  openMenu(e, msg);
}

// ============================================================
// Время
// ============================================================
function fmtTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function fmtDay(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  const same = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (same(d, today)) return 'Сегодня';
  if (same(d, yest)) return 'Вчера';
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long' });
}

function isSameDay(a, b) {
  if (!a || !b) return false;
  const da = new Date(a), db = new Date(b);
  return da.getFullYear() === db.getFullYear() &&
         da.getMonth() === db.getMonth() &&
         da.getDate() === db.getDate();
}

// ============================================================
// Viewport / PWA / heartbeat
// ============================================================
let heartbeatTimer = null;

function updateViewport() {
  if (window.innerWidth > 700) { panelHeight.value = ''; panelTop.value = ''; return; }
  const vv = window.visualViewport;
  if (!vv) return;
  panelHeight.value = vv.height + 'px';
  panelTop.value = vv.offsetTop + 'px';
}

async function askNotifications() {
  const cur = getPermission();
  if (cur === 'default') {
    const res = await requestPermission();
    if (res === 'granted') toast.success('🔔 Уведомления включены');
  }
}

function onVisibilityChange() {
  if (document.visibilityState === 'visible') {
    messages.heartbeat();
    updateViewport();
  }
}

function onBeforeUnload() {
  messages.heartbeat();
  messages.notifyTypingStop(peer.value);
}

function onViewportResize() { updateViewport(); }

watch(history, async (newList, oldList) => {
  if (!open.value) return;
  const added = newList.length > (oldList?.length || 0);
  if (!added) return;

  const wasNearBottom = isNearBottom();
  await nextTick();

  if (wasNearBottom) {
    scrollToBottom(true);
  } else {
    newBelowCount.value += (newList.length - (oldList?.length || 0));
    showScrollDown.value = true;
  }
}, { deep: false });

onMounted(async () => {
  try {
    await messages.loadPresence();
    await messages.loadUnread();
    await updateBadge(messages.totalUnread);
  } catch (e) {}

  messages.heartbeat();
  heartbeatTimer = setInterval(() => {
    if (document.visibilityState === 'visible') messages.heartbeat();
  }, 30 * 1000);

  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('beforeunload', onBeforeUnload);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', onViewportResize);
    window.visualViewport.addEventListener('scroll', onViewportResize);
  }
  window.addEventListener('resize', onViewportResize);
  updateViewport();
});

onUnmounted(() => {
  document.body.dataset.chatOpen = 'false';
  document.removeEventListener('visibilitychange', onVisibilityChange);
  window.removeEventListener('beforeunload', onBeforeUnload);
  if (window.visualViewport) {
    window.visualViewport.removeEventListener('resize', onViewportResize);
    window.visualViewport.removeEventListener('scroll', onViewportResize);
  }
  window.removeEventListener('resize', onViewportResize);
  if (heartbeatTimer) clearInterval(heartbeatTimer);
});

watch(totalUnread, (n) => updateBadge(n));
watch(open, (v) => { if (v) askNotifications(); });
</script>

<template>
  <!-- FAB (скрыт при открытом чате) -->
  <button
    v-if="!open"
    class="chat-fab"
    :class="{ 'has-unread': totalUnread > 0 }"
    type="button"
    @click="toggle"
  >
    <span class="chat-fab-icon">
      <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
        <path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
      </svg>
    </span>
    <span v-if="totalUnread > 0" class="chat-fab-badge">
      {{ totalUnread > 99 ? '99+' : totalUnread }}
    </span>
  </button>

  <!-- Панель -->
  <Transition name="chat-panel">
    <div
      v-if="open"
      class="chat-panel"
      :style="{ height: panelHeight || undefined, top: panelTop || undefined }"
      @click.stop
    >
      <!-- Header -->
      <div class="chat-head">
        <button class="chat-back" @click="close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="20" height="20">
            <path d="M15 18l-6-6 6-6" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>

        <div class="chat-head-main" @click="close">
          <div class="chat-avatar" :class="{ online: peerOnline }">
            {{ peerEmoji }}
          </div>
          <div class="chat-user-info">
            <div class="chat-user-name">{{ peer }}</div>
            <div class="chat-user-status" :class="{ online: peerOnline, typing: peerTyping }">
              {{ peerStatusText }}
            </div>
          </div>
        </div>

        <button
          class="chat-head-action"
          :class="{ active: activePanel === 'settings' }"
          @click="toggleSettings"
          title="Настройки"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>

        <button class="chat-head-action" @click="close" title="Закрыть">
          <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
            <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </div>

      <!-- Pinned -->
      <div v-if="pinnedLatest" class="chat-pinned" @click="scrollToMessage(pinnedLatest.id)">
        <div class="pinned-icon">📌</div>
        <div class="pinned-body">
          <div class="pinned-label">
            Закреплённое
            <span v-if="peerTyping" class="pinned-typing">· {{ peer }} печатает…</span>
          </div>
          <div class="pinned-text">{{ pinnedLatest.text || '📷 Изображение' }}</div>
        </div>
        <button class="pinned-unpin" @click.stop="togglePin(pinnedLatest)">
          <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
            <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </div>

      <!-- Body -->
      <div ref="scrollEl" class="chat-body" @scroll.passive="onScroll">
        <div v-if="loadingOlder" class="loading-older">
          <span class="spinner"></span> Загрузка…
        </div>
        <div v-else-if="!messages.hasMore[peer] && history.length > 0" class="history-start">
          Начало истории
        </div>

        <div v-if="history.length === 0" class="chat-empty">
          <div class="chat-empty-icon">💬</div>
          <div class="chat-empty-text">Пока нет сообщений с {{ peer }}</div>
          <div class="chat-empty-hint">Напиши первым!</div>
        </div>

        <template v-else>
          <template v-for="(m, i) in history" :key="m.id">
            <div
              v-if="i === 0 || !isSameDay(history[i - 1].createdAt, m.createdAt)"
              class="chat-day"
            >{{ fmtDay(m.createdAt) }}</div>

            <div v-if="m.id === firstUnreadId && !m.readAt" class="unread-divider">
              <span>Новые сообщения</span>
            </div>

            <div
              class="chat-msg"
              :class="{
                out: m.from === me,
                in: m.from !== me,
                swiping: swipeState.active && swipeState.id === m.id && swipeState.dx > 0,
              }"
              :style="swipeStyle(m)"
              :data-msg-id="m.id"
              @contextmenu="onContextMenu($event, m)"
              @touchstart="onTouchStart($event, m)"
              @touchmove="onTouchMove"
              @touchend="onTouchEnd"
              @touchcancel="onTouchEnd"
            >
              <div class="chat-row">
                <!-- Реакции слева от bubble -->
                <div v-if="m.reactions?.length" class="bubble-reactions">
                  <button
                    v-for="r in m.reactions"
                    :key="r.emoji"
                    class="reaction-chip"
                    :class="{ mine: r.users.includes(me) }"
                    @click.stop="addReaction(m, r.emoji)"
                  >
                    <span class="rc-emoji">{{ r.emoji }}</span>
                    <span v-if="r.users.length > 1" class="rc-count">{{ r.users.length }}</span>
                  </button>
                </div>

                <div class="chat-bubble" :class="{ 'is-pinned': m.pinnedAt }">
                  <div v-if="m.pinnedAt" class="bubble-pin">📌</div>

                  <div
                    v-if="m.replyTo"
                    class="bubble-reply"
                    @click.stop="scrollToMessage(m.replyTo)"
                  >
                    <div class="br-line"></div>
                    <div class="br-text">{{ getQuoteText(m.replyTo) }}</div>
                  </div>

                  <!-- ✅ Изображение -->
                  <div v-if="m.image" class="bubble-image" @click.stop="openFullscreen(m.image)">
                    <img :src="m.image" alt="image" loading="lazy" />
                  </div>

                  <div v-if="m.text" class="chat-text" v-html="linkify(m.text)"></div>

                  <div class="chat-meta">
                    <span v-if="m.editedAt" class="chat-edited">изм.</span>
                    <span class="chat-time">{{ fmtTime(m.createdAt) }}</span>
                    <span
                      v-if="m.from === me"
                      class="chat-read"
                      :class="{ read: !!m.readAt }"
                    >{{ m.readAt ? '✓✓' : '✓' }}</span>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </template>
      </div>

      <!-- Кнопка вниз -->
      <Transition name="scroll-down">
        <button v-if="showScrollDown" class="scroll-down-btn" @click="scrollToBottom(true)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="18" height="18">
            <path d="M12 5v14M19 12l-7 7-7-7" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span v-if="newBelowCount > 0" class="sd-badge">{{ newBelowCount }}</span>
        </button>
      </Transition>

      <!-- Reply preview -->
      <div v-if="replyTo" class="chat-reply-preview">
        <div class="crp-line"></div>
        <div class="crp-body">
          <div class="crp-label">Ответ</div>
          <div class="crp-text">{{ getQuoteText(replyTo.id) }}</div>
        </div>
        <button class="crp-close" @click="cancelReply">✕</button>
      </div>

      <!-- Edit preview -->
      <div v-if="editing" class="chat-edit-preview">
        <div class="cep-icon">✏️</div>
        <div class="cep-body">
          <div class="cep-label">Редактирование</div>
          <div class="cep-text">{{ editing.text || '📷 Изображение' }}</div>
        </div>
        <button class="cep-close" @click="cancelEdit">✕</button>
      </div>

      <!-- ✅ Превью изображения перед отправкой -->
      <div v-if="pendingImage" class="chat-image-preview">
        <img :src="pendingImage" alt="preview" />
        <button class="cip-close" @click="cancelImage">✕</button>
      </div>

      <!-- Ввод -->
      <div class="chat-input-row">
        <template v-if="editing">
          <button class="chat-input-btn chat-input-btn-accept" @click="saveEdit">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="16" height="16">
              <polyline points="20 6 9 17 4 12" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <textarea
            ref="inputEl"
            v-model="editText"
            class="chat-input"
            rows="1"
            @input="autoResize"
            @keydown="onKeydown"
            placeholder="Редактировать…"
          />
        </template>

        <template v-else>
          <input
            ref="fileEl"
            type="file"
            accept="image/*"
            class="chat-file-input"
            @change="onFileChange"
          />

          <button
            class="chat-input-icon"
            @click="openFilePicker"
            title="Прикрепить изображение"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>

          <button
            class="chat-input-icon"
            :class="{ active: activePanel === 'emoji' }"
            @click="toggleEmoji"
            :title="activePanel === 'emoji' ? 'Клавиатура' : 'Эмодзи'"
          >
            <svg v-if="activePanel !== 'emoji'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="22" height="22">
              <circle cx="12" cy="12" r="10"/>
              <path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" stroke-linecap="round"/>
            </svg>
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="22" height="22">
              <rect x="3" y="6" width="18" height="12" rx="2"/>
              <path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10" stroke-linecap="round"/>
            </svg>
          </button>

          <textarea
            ref="inputEl"
            v-model="text"
            class="chat-input"
            placeholder="Сообщение"
            rows="1"
            @input="onInput"
            @keydown="onKeydown"
            @focus="activePanel = 'keyboard'"
          />

          <button
            class="chat-send"
            :disabled="(!text.trim() && !pendingImage) || sending"
            @click="send"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
              <path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        </template>
      </div>

      <!-- Emoji -->
      <Transition name="panel">
        <div v-if="activePanel === 'emoji'" class="chat-panel-bottom emoji-panel">
          <div class="emoji-cats">
            <button
              v-for="c in EMOJI_CATEGORIES"
              :key="c.id"
              class="emoji-cat"
              :class="{ active: activeEmojiCat === c.id }"
              @click="activeEmojiCat = c.id"
              :title="c.label"
            >{{ c.icon }}</button>
          </div>
          <div class="emoji-grid">
            <button
              v-for="e in currentEmojiList"
              :key="e"
              class="emoji-cell"
              @click="insertEmoji(e)"
            >{{ e }}</button>
            <div class="emoji-spacer"></div>
            <button class="emoji-cell emoji-backspace" @click="onBackspace" title="Удалить">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM18 9l-6 6M12 9l6 6" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      </Transition>

      <!-- Настройки -->
      <Transition name="panel">
        <div v-if="activePanel === 'settings'" class="chat-panel-bottom settings-panel">
          <div class="settings-section">
            <div class="settings-title">Тема</div>
            <div class="theme-grid">
              <button
                v-for="t in THEMES"
                :key="t.id"
                class="theme-btn"
                :class="{ active: theme === t.id }"
                @click="setTheme(t.id)"
              >
                <span class="theme-icon">{{ t.icon }}</span>
                <span class="theme-label">{{ t.label }}</span>
              </button>
            </div>
          </div>

          <div class="settings-section">
            <div class="settings-title">Фон чата</div>
            <div class="bg-grid">
              <button
                v-for="b in BACKGROUNDS"
                :key="b.id"
                class="bg-btn"
                :class="{ active: background === b.id }"
                :style="b.style ? { background: b.style } : {}"
                @click="setBackground(b.id)"
              >
                <span v-if="!b.style" class="bg-default-mark">Aa</span>
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>

  <!-- Контекстное меню -->
  <Teleport to="body">
    <Transition name="ctx-menu">
      <div
        v-if="menu.open"
        class="ctx-backdrop"
        @click="closeMenu"
        @contextmenu.prevent="closeMenu"
      >
        <div
          class="ctx-menu"
          :style="{ left: menu.x + 'px', top: menu.y + 'px' }"
          @click.stop
          @touchstart.stop
          @touchend.stop
          @contextmenu.prevent
        >
          <div class="reactions-row">
            <button
              v-for="e in ['❤️','👍','🔥','😂','😮','😢','👎','🎉']"
              :key="e"
              class="reaction-btn"
              :class="{ active: currentUserReactionOn === e }"
              @click="addReaction(menu.message, e)"
            >{{ e }}</button>
          </div>

          <button class="ctx-item" @click="startReply(menu.message)">
            <span class="ctx-icon">↩️</span><span class="ctx-label">Ответить</span>
          </button>
          <button class="ctx-item" @click="copyMessage(menu.message)">
            <span class="ctx-icon">📋</span><span class="ctx-label">Копировать</span>
          </button>
          <button class="ctx-item" @click="togglePin(menu.message)">
            <span class="ctx-icon">📌</span>
            <span class="ctx-label">{{ menu.message?.pinnedAt ? 'Открепить' : 'Закрепить' }}</span>
          </button>
          <button v-if="menuIsMine" class="ctx-item" @click="startEdit(menu.message)">
            <span class="ctx-icon">✏️</span><span class="ctx-label">Редактировать</span>
          </button>
          <button class="ctx-item danger" @click="removeMsg(menu.message)">
            <span class="ctx-icon">🗑</span><span class="ctx-label">Удалить</span>
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>

  <!-- ✅ Fullscreen image -->
  <Teleport to="body">
    <Transition name="fs">
      <div v-if="fullscreenImage" class="fs-overlay" @click="closeFullscreen">
        <img :src="fullscreenImage" alt="fullscreen" @click.stop />
        <button class="fs-close" @click="closeFullscreen">✕</button>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
$chat-font: 12px;
$chat-font-sm: 10px;
$chat-font-lg: 13px;

.chat-fab {
  position: fixed;
  right: 20px;
  bottom: calc(90px + env(safe-area-inset-bottom, 0));
  z-index: 950;
  width: 56px; height: 56px;
  border-radius: 50%;
  border: 3px solid #ffffff;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  color: #ffffff;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 10px 28px -8px rgba(99, 102, 241, 0.6), 0 4px 12px -4px rgba(15, 23, 42, 0.15);
  transition: transform 0.2s cubic-bezier(.34,1.56,.64,1);
  &:hover { transform: scale(1.08); }
  &:active { transform: scale(0.94); }
  &.has-unread { animation: fabPulse 1.6s ease-in-out infinite; }
}

@keyframes fabPulse {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.06); }
}

.chat-fab-icon { display: flex; }

.chat-fab-badge {
  position: absolute;
  top: -4px; right: -4px;
  min-width: 20px; height: 20px;
  padding: 0 6px;
  border-radius: 999px;
  background: linear-gradient(135deg, #ef4444, #dc2626);
  color: #ffffff;
  font-family: var(--mono);
  font-size: $chat-font-sm;
  font-weight: 800;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px -2px rgba(239, 68, 68, 0.7), 0 0 0 3px #ffffff;
}

/* Panel */
.chat-panel {
  position: fixed;
  right: 20px;
  bottom: calc(90px + env(safe-area-inset-bottom, 0));
  z-index: 940;
  width: 400px;
  max-width: calc(100vw - 32px);
  height: 580px;
  max-height: calc(100vh - 200px);
  background: var(--chat-bg);
  border-radius: 20px;
  border: 1px solid var(--chat-border);
  box-shadow: 0 30px 70px -20px rgba(15, 23, 42, 0.3), 0 10px 30px -10px rgba(15, 23, 42, 0.15);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  margin-bottom: 72px;
}

/* Header */
.chat-head {
  position: relative;
  display: flex; align-items: center; gap: 6px;
  padding: 10px 12px;
  background: var(--chat-header-bg);
  backdrop-filter: blur(20px) saturate(180%);
  border-bottom: 0.5px solid var(--chat-border);
  flex-shrink: 0;
  z-index: 5;
}

.chat-back {
  width: 30px; height: 30px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--chat-accent);
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  &:hover { background: var(--chat-menu-hover); }
}

.chat-head-main {
  flex: 1;
  display: flex; align-items: center; gap: 10px;
  min-width: 0;
  cursor: pointer;
  user-select: none;
}

.chat-avatar {
  position: relative;
  width: 34px; height: 34px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(139, 92, 246, 0.2));
  display: flex; align-items: center; justify-content: center;
  font-size: 17px;
  flex-shrink: 0;

  &.online::after {
    content: '';
    position: absolute;
    right: 0; bottom: 0;
    width: 10px; height: 10px;
    border-radius: 50%;
    background: #22c55e;
    border: 2px solid var(--chat-bg);
  }
}

.chat-user-info { min-width: 0; flex: 1; }

.chat-user-name {
  font-size: $chat-font-lg;
  font-weight: 600;
  color: var(--chat-text);
  line-height: 1.2;
}

.chat-user-status {
  font-size: $chat-font;
  color: var(--chat-text-muted);
  font-weight: 400;
  margin-top: 1px;
  &.online { color: #22c55e; }
  &.typing { color: #22c55e; font-style: italic; }
}

.chat-head-action {
  width: 30px; height: 30px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--chat-accent);
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  transition: background 0.15s;
  &:hover { background: var(--chat-menu-hover); }
  &.active {
    background: var(--chat-menu-hover);
    color: var(--chat-accent);
  }
}

/* Pinned */
.chat-pinned {
  display: flex; align-items: center; gap: 10px;
  padding: 6px 12px;
  background: var(--chat-header-bg);
  border-bottom: 0.5px solid var(--chat-border);
  cursor: pointer;
  flex-shrink: 0;
  &:hover { opacity: 0.9; }
}

.pinned-icon { font-size: $chat-font; flex-shrink: 0; color: var(--chat-accent); }

.pinned-body {
  flex: 1; min-width: 0;
  border-left: 3px solid var(--chat-accent);
  padding-left: 8px;
}

.pinned-label {
  font-size: $chat-font-sm;
  font-weight: 600;
  color: var(--chat-accent);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  display: flex; align-items: center; gap: 6px;
  flex-wrap: wrap;
}

.pinned-typing {
  color: #22c55e;
  font-weight: 500;
  text-transform: none;
  letter-spacing: 0;
  font-style: italic;
}

.pinned-text {
  font-size: $chat-font;
  color: var(--chat-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 1px;
  opacity: 0.85;
}

.pinned-unpin {
  width: 26px; height: 26px;
  border-radius: 50%;
  border: none;
  background: rgba(120, 120, 128, 0.15);
  color: var(--chat-text-muted);
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  &:hover { background: rgba(255, 59, 48, 0.15); color: #ff3b30; }
}

/* Body */
.chat-body {
  flex: 1;
  overflow-y: auto;
  padding: 10px 12px 6px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  background: var(--chat-bg);
  background-image: var(--chat-bg-pattern, none);
  background-attachment: local;
  -webkit-overflow-scrolling: touch;
  position: relative;
}

.loading-older {
  display: flex; align-items: center; justify-content: center;
  gap: 6px; padding: 8px;
  color: var(--chat-text-muted);
  font-size: $chat-font-sm;
}

.spinner {
  width: 12px; height: 12px;
  border: 2px solid rgba(120, 120, 128, 0.25);
  border-top-color: var(--chat-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.history-start {
  text-align: center;
  padding: 8px;
  color: var(--chat-text-muted);
  font-size: $chat-font-sm;
  opacity: 0.7;
}

.unread-divider {
  display: flex; align-items: center; gap: 8px;
  margin: 8px 0;
  color: var(--chat-accent);
  font-size: $chat-font-sm;
  font-weight: 600;
  &::before, &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: currentColor;
    opacity: 0.35;
  }
}

.chat-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 6px; padding: 40px 20px;
  color: var(--chat-text-muted);
  text-align: center;
}

.chat-empty-icon { font-size: 38px; opacity: 0.5; }
.chat-empty-text { font-size: $chat-font; font-weight: 500; }
.chat-empty-hint { font-size: $chat-font-sm; opacity: 0.75; }

.chat-day {
  align-self: center;
  padding: 2px 10px;
  margin: 6px 0 4px;
  border-radius: 999px;
  background: rgba(120, 120, 128, 0.15);
  color: var(--chat-text-muted);
  font-size: $chat-font-sm;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.chat-msg {
  display: flex;
  flex-direction: column;
  max-width: 82%;
  -webkit-user-select: none;
  user-select: none;
  transition: transform 0.15s ease;

  &.swiping { transition: none; }

  &.in { align-self: flex-start; }
  &.out { align-self: flex-end; }

  &.in {
    .chat-bubble {
      background: var(--chat-bubble-in-bg);
      color: var(--chat-bubble-in-text);
      border-radius: 16px 16px 16px 4px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
    }
    .chat-meta { color: var(--chat-text-muted); }
  }

  &.out {
    .chat-bubble {
      background: var(--chat-bubble-out-bg);
      color: var(--chat-bubble-out-text);
      border-radius: 16px 16px 4px 16px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
    }
    .chat-meta { color: rgba(255, 255, 255, 0.7); }
  }

  &.highlight .chat-bubble { animation: msgHighlight 1.2s ease-out; }
}

@keyframes msgHighlight {
  0%, 100% { box-shadow: 0 0 0 0 rgba(255, 149, 0, 0); }
  30%      { box-shadow: 0 0 0 4px rgba(255, 149, 0, 0.5); }
}

/* Строка: реакции слева + bubble */
.chat-row {
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
}

.chat-msg.out .chat-row {
  flex-direction: row-reverse;
}

/* ✅ Реакции — вертикальный столбик слева от bubble */
.bubble-reactions {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex-shrink: 0;
  align-self: center;
}

.reaction-chip {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0;
  padding: 2px 4px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-family: inherit;
  transition: transform 0.12s;
  line-height: 1;

  &:hover { transform: scale(1.15); }
}

.rc-emoji { font-size: 16px; line-height: 1; }
.rc-count {
  font-size: 9px;
  font-weight: 700;
  color: var(--chat-text);
  opacity: 0.75;
  margin-top: 1px;
}

.chat-bubble {
  position: relative;
  padding: 6px 10px 5px;
  max-width: 100%;
  word-wrap: break-word;
  overflow-wrap: anywhere;
  font-size: $chat-font;
  line-height: 1.4;
  cursor: default;

  &.is-pinned { padding-top: 14px; }
}

.bubble-pin {
  position: absolute;
  top: 2px; right: 6px;
  font-size: 9px;
  opacity: 0.75;
}

/* ✅ Изображение в bubble */
.bubble-image {
  margin: -2px -4px 4px;
  border-radius: 10px;
  overflow: hidden;
  cursor: pointer;
  max-width: 260px;

  img {
    display: block;
    width: 100%;
    height: auto;
    max-height: 320px;
    object-fit: cover;
    transition: transform 0.2s;
  }

  &:hover img { transform: scale(1.02); }
}

.chat-text {
  white-space: pre-wrap;
  font-size: $chat-font;
}

.chat-text :deep(a.md-link),
.chat-text :deep(a.md-phone) {
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 2px;
  text-decoration-thickness: 1px;
  word-break: break-all;
  font-weight: 500;
}

.chat-msg.out .chat-text :deep(a.md-link),
.chat-msg.out .chat-text :deep(a.md-phone) {
  color: var(--chat-bubble-out-text);
  text-decoration-color: rgba(255, 255, 255, 0.7);
}

.chat-text :deep(code.md-code) {
  display: inline-block;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.08);
  font-family: var(--mono);
  font-size: 11px;
}

.chat-msg.out .chat-text :deep(code.md-code) {
  background: rgba(255, 255, 255, 0.22);
}

.bubble-reply {
  display: flex; align-items: stretch; gap: 5px;
  margin: -2px 0 3px;
  padding: 3px 6px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.05);
  cursor: pointer;
  font-size: $chat-font-sm;

  .chat-msg.out & { background: rgba(255, 255, 255, 0.15); }
}

.br-line {
  width: 2px;
  background: currentColor;
  border-radius: 2px;
  flex-shrink: 0;
  opacity: 0.6;
}

.br-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}

.chat-meta {
  display: flex; align-items: center; justify-content: flex-end;
  gap: 3px;
  font-size: 9px;
  font-weight: 500;
  margin-top: 2px;
  line-height: 1;
  opacity: 0.65;
}

.chat-edited {
  font-style: italic;
  font-size: 9px;
  opacity: 0.85;
}

.chat-time {
  font-family: -apple-system, "SF Pro Text", var(--mono);
  font-size: 9.5px;
  letter-spacing: 0.02em;
}

.chat-read {
  font-size: $chat-font;
  opacity: 0.75;
  margin-left: 2px;
  &.read { opacity: 1; }
}

/* Кнопка вниз */
.scroll-down-btn {
  position: absolute;
  right: 14px;
  bottom: calc(100% + 14px);
  width: 36px; height: 36px;
  border-radius: 50%;
  border: 1px solid var(--chat-border);
  background: var(--chat-menu-bg);
  color: var(--chat-accent);
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 8px 24px -6px rgba(15, 23, 42, 0.25);
  z-index: 20;
  position: relative;
  margin-bottom: 6px;
  align-self: flex-end;
  transition: transform 0.15s;
  &:hover { transform: scale(1.08); }
  &:active { transform: scale(0.94); }
}

.sd-badge {
  position: absolute;
  top: -4px; right: -4px;
  min-width: 18px; height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--chat-accent);
  color: #fff;
  font-size: 10px;
  font-weight: 800;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 6px rgba(0, 122, 255, 0.5);
}

.scroll-down-enter-active,
.scroll-down-leave-active {
  transition: opacity 0.18s, transform 0.22s cubic-bezier(.34,1.56,.64,1);
}
.scroll-down-enter-from,
.scroll-down-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.9);
}

/* Reply / Edit / Image preview */
.chat-reply-preview,
.chat-edit-preview {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 12px;
  background: var(--chat-header-bg);
  border-top: 0.5px solid var(--chat-border);
  flex-shrink: 0;
}

.crp-line {
  width: 3px;
  align-self: stretch;
  border-radius: 2px;
  background: var(--chat-accent);
  flex-shrink: 0;
}

.crp-body, .cep-body { flex: 1; min-width: 0; }

.crp-label, .cep-label {
  font-size: $chat-font-sm;
  font-weight: 600;
  color: var(--chat-accent);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.cep-icon { font-size: $chat-font; flex-shrink: 0; }

.crp-text, .cep-text {
  font-size: $chat-font;
  color: var(--chat-text);
  opacity: 0.85;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 1px;
}

.crp-close, .cep-close {
  width: 24px; height: 24px;
  border-radius: 50%;
  border: none;
  background: rgba(120, 120, 128, 0.15);
  color: var(--chat-text-muted);
  cursor: pointer;
  font-size: 11px;
  flex-shrink: 0;
  &:hover { background: rgba(255, 59, 48, 0.15); color: #ff3b30; }
}

/* ✅ Превью изображения */
.chat-image-preview {
  position: relative;
  padding: 8px 12px;
  background: var(--chat-header-bg);
  border-top: 0.5px solid var(--chat-border);
  display: flex;
  align-items: center;
  justify-content: center;

  img {
    max-width: 120px;
    max-height: 120px;
    border-radius: 10px;
    object-fit: cover;
    box-shadow: 0 4px 12px -4px rgba(0, 0, 0, 0.25);
  }
}

.cip-close {
  position: absolute;
  top: 12px;
  right: 16px;
  width: 24px; height: 24px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  cursor: pointer;
  font-size: 12px;
  display: flex; align-items: center; justify-content: center;
}

/* Input */
.chat-input-row {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  padding: 6px 8px;
  padding-bottom: calc(6px + env(safe-area-inset-bottom, 0));
  background: var(--chat-header-bg);
  border-top: 0.5px solid var(--chat-border);
  flex-shrink: 0;
}

.chat-file-input { display: none; }

.chat-input-icon {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: var(--chat-text-muted);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.15s;

  &:hover {
    background: var(--chat-menu-hover);
    color: var(--chat-accent);
  }

  &.active {
    color: var(--chat-accent);
    background: var(--chat-menu-hover);
  }
}

.chat-input {
  flex: 1;
  min-height: 30px;
  max-height: 110px;
  padding: 7px 12px;
  border-radius: 16px;
  border: 0.5px solid var(--chat-input-border);
  background: var(--chat-input-bg);
  color: var(--chat-text);
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif;
  font-size: $chat-font;
  font-weight: 400;
  line-height: 1.4;
  letter-spacing: normal;
  resize: none;
  outline: none;
  overflow-y: auto;
  transition: border-color 0.15s;

  &:focus { border-color: var(--chat-accent); }
  &::placeholder { color: var(--chat-text-muted); }
}

.chat-send {
  width: 30px; height: 30px;
  border-radius: 50%;
  border: none;
  background: var(--chat-accent);
  color: #ffffff;
  cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  &:disabled { opacity: 0.35; cursor: not-allowed; }
  &:not(:disabled):active { transform: scale(0.94); }
}

.chat-input-btn {
  width: 30px; height: 30px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}

.chat-input-btn-accept {
  background: #34c759;
  color: #ffffff;
  &:active { transform: scale(0.94); }
}

/* Панель снизу */
.chat-panel-bottom {
  border-top: 0.5px solid var(--chat-border);
  background: var(--chat-header-bg);
  flex-shrink: 0;
  overflow: hidden;
}

.panel-enter-active,
.panel-leave-active {
  transition: max-height 0.25s cubic-bezier(.34,1.56,.64,1), opacity 0.2s;
  max-height: 280px;
}
.panel-enter-from,
.panel-leave-to {
  max-height: 0;
  opacity: 0;
}

/* Emoji panel */
.emoji-panel {
  display: flex;
  flex-direction: column;
  max-height: 240px;
}

.emoji-cats {
  display: flex;
  gap: 2px;
  padding: 4px 8px;
  border-bottom: 0.5px solid var(--chat-border);
  overflow-x: auto;
  flex-shrink: 0;
  &::-webkit-scrollbar { display: none; }
}

.emoji-cat {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.15s;

  &:hover { background: var(--chat-menu-hover); }
  &.active { background: var(--chat-menu-hover); box-shadow: inset 0 -2px 0 var(--chat-accent); }
}

.emoji-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(36px, 1fr));
  gap: 2px;
  padding: 6px 6px 8px;
  overflow-y: auto;
  max-height: 190px;
  -webkit-overflow-scrolling: touch;
}

.emoji-cell {
  width: 100%;
  height: 36px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 22px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 0.12s, transform 0.12s;

  &:hover {
    background: var(--chat-menu-hover);
    transform: scale(1.1);
  }
  &:active { transform: scale(0.9); }
}

.emoji-spacer { height: 0; }

.emoji-backspace {
  grid-column: 1 / -1;
  height: 38px;
  color: var(--chat-text-muted);
  background: rgba(120, 120, 128, 0.08);
  border-radius: 8px;
  margin-top: 4px;

  &:hover { background: rgba(120, 120, 128, 0.15); transform: none; }
}

/* Settings panel */
.settings-panel {
  max-height: 280px;
  overflow-y: auto;
  padding: 12px 14px 14px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.settings-title {
  font-size: $chat-font-sm;
  font-weight: 700;
  color: var(--chat-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.theme-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.theme-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 10px 6px;
  border-radius: 12px;
  border: 1.5px solid var(--chat-border);
  background: var(--chat-input-bg);
  color: var(--chat-text);
  cursor: pointer;
  font-family: inherit;
  font-size: 11px;
  font-weight: 600;
  transition: all 0.15s;

  &:hover { border-color: var(--chat-accent); }
  &.active {
    border-color: var(--chat-accent);
    background: var(--chat-menu-hover);
    color: var(--chat-accent);
  }
}

.theme-icon { font-size: 18px; }
.theme-label { font-size: 10px; font-weight: 600; }

.bg-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 6px;
}

.bg-btn {
  position: relative;
  aspect-ratio: 1;
  border-radius: 10px;
  border: 2px solid var(--chat-border);
  background: #f5f5f5;
  cursor: pointer;
  transition: all 0.15s;
  overflow: hidden;

  &:hover { transform: scale(1.05); }
  &.active {
    border-color: var(--chat-accent);
    box-shadow: 0 0 0 2px rgba(0, 122, 255, 0.25);
  }
}

.bg-default-mark {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 800;
  color: #8e8e93;
  background: linear-gradient(135deg, #f2f2f7, #ffffff);
}

/* Animations */
.chat-panel-enter-active,
.chat-panel-leave-active {
  transition: opacity 0.22s ease, transform 0.28s cubic-bezier(.34,1.56,.64,1);
}

.chat-panel-enter-from,
.chat-panel-leave-to {
  opacity: 0;
  transform: translateY(20px) scale(0.94);
  transform-origin: bottom right;
}

/* Backdrop / Menu */
.ctx-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.05);
}

.ctx-menu {
  position: absolute;
  min-width: 220px;
  max-width: 340px;
  padding: 6px;
  background: var(--chat-menu-bg);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border-radius: 14px;
  box-shadow: 0 12px 40px -8px rgba(15, 23, 42, 0.3), 0 4px 12px -4px rgba(15, 23, 42, 0.15);
  border: 0.5px solid var(--chat-border);
  overflow: hidden;
}

.reactions-row {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px 6px 8px;
  border-bottom: 0.5px solid var(--chat-border);
  margin-bottom: 4px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  &::-webkit-scrollbar { display: none; }
}

.reaction-btn {
  width: 32px; height: 32px;
  border-radius: 50%;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: transform 0.12s, background 0.12s;
  &:hover { transform: scale(1.2); background: var(--chat-menu-hover); }
  &.active {
    background: var(--chat-menu-hover);
    box-shadow: inset 0 0 0 1.5px var(--chat-accent);
  }
  &:active { transform: scale(0.9); }
}

.ctx-item {
  display: flex; align-items: center; gap: 10px;
  width: 100%;
  padding: 9px 11px;
  border: none;
  background: transparent;
  color: var(--chat-menu-text);
  font-family: -apple-system, "SF Pro Text", inherit;
  font-size: $chat-font-lg;
  font-weight: 500;
  cursor: pointer;
  border-radius: 8px;
  text-align: left;

  &:hover {
    background: var(--chat-menu-hover);
    color: var(--chat-accent);
  }

  &.danger {
    color: #ff3b30;
    &:hover { background: rgba(255, 59, 48, 0.12); color: #ff3b30; }
  }
}

.ctx-icon { font-size: $chat-font; width: 18px; text-align: center; flex-shrink: 0; }
.ctx-label { flex: 1; }

.ctx-menu-enter-active,
.ctx-menu-leave-active {
  transition: opacity 0.15s ease, transform 0.18s cubic-bezier(.34,1.56,.64,1);
}
.ctx-menu-enter-from,
.ctx-menu-leave-to { opacity: 0; transform: scale(0.9); }

/* ✅ Fullscreen image */
.fs-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: rgba(0, 0, 0, 0.92);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  cursor: zoom-out;
}

.fs-overlay img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 8px;
  cursor: default;
}

.fs-close {
  position: absolute;
  top: calc(16px + env(safe-area-inset-top, 0));
  right: 16px;
  width: 36px; height: 36px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  font-size: 16px;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}

.fs-enter-active,
.fs-leave-active { transition: opacity 0.2s ease; }
.fs-enter-from,
.fs-leave-to { opacity: 0; }

/* Мобильный */
@media (max-width: 700px) {
  .chat-fab {
    right: 16px;
    bottom: calc(84px + env(safe-area-inset-bottom, 0));
    width: 52px; height: 52px;
  }

  .chat-panel {
    right: 0; left: 0; top: 0; bottom: 0;
    width: 100%; max-width: 100%;
    height: 100%; max-height: 100%;
    margin-bottom: 0;
    border-radius: 0;
    border: none;
  }

  .chat-head {
    padding-top: calc(10px + env(safe-area-inset-top, 0));
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .chat-pinned {
    position: sticky;
    top: calc(54px + env(safe-area-inset-top, 0));
    z-index: 9;
  }

  .chat-body {
    padding: 8px 10px;
    overscroll-behavior: contain;
  }

  .chat-msg { max-width: 85%; }
  .chat-bubble { font-size: $chat-font-lg; }
  .chat-text { font-size: $chat-font-lg; }
  .chat-input { font-size: $chat-font-lg; }

  .ctx-menu {
    left: 8px !important;
    right: 8px !important;
    top: auto !important;
    bottom: calc(8px + env(safe-area-inset-bottom, 0));
    max-width: none;
    width: auto;
    border-radius: 18px;
  }

  .reaction-btn { width: 38px; height: 38px; font-size: 22px; }
  .reactions-row { justify-content: space-between; padding: 6px 2px 10px; }

  .scroll-down-btn { right: 12px; width: 40px; height: 40px; }

  .emoji-grid { max-height: 220px; }
  .bg-grid { grid-template-columns: repeat(6, 1fr); }
}
</style>