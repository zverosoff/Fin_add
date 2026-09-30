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
  playSendError,
} from '@/composables/useNotificationSound';
import {
  getPermission,
  requestPermission,
  updateBadge,
} from '@/composables/usePushNotifications';

const messages = useMessagesStore();
const auth = useAuthStore();
const toast = useToast();
const {
  theme, background, fontSize, fontFamily,
  setTheme, setBackground, setFontSize, setFontFamily,
  THEMES, BACKGROUNDS, FONT_SIZES, FONT_FAMILIES,
} = useTheme();

const open = ref(false);
const text = ref('');
const sending = ref(false);
const scrollEl = ref(null);
const inputEl = ref(null);
const fileEl = ref(null);

const menu = ref({ open: false, x: 0, y: 0, message: null });
const activePanel = ref('keyboard');
const editing = ref(null);
const editText = ref('');
const replyTo = ref(null);
const pendingImage = ref(null);
const fullscreenImage = ref(null);

const panelHeight = ref('');
const panelTop = ref('');
const loadingOlder = ref(false);
const showScrollDown = ref(false);
const newBelowCount = ref(0);

const swipeState = ref({ id: null, startX: 0, startY: 0, dx: 0, active: false });

// ✅ "Сообщение улетает" при отправке
const sendingFlight = ref(null);

// ✅ Аватар — перезапуск анимации при открытии
const avatarKey = ref(0);

// ✅ Новое сообщение: FAB расширяется и показывает "Новое СООБЩЕНИЕ"
const hasFreshMessage = ref(false);
let freshMessageTimer = null;

function triggerFreshMessage() {
  hasFreshMessage.value = true;
  if (freshMessageTimer) clearTimeout(freshMessageTimer);
  freshMessageTimer = setTimeout(() => {
    hasFreshMessage.value = false;
  }, 8000);
}

const EMOJI_CATEGORIES = [
  { id: 'smileys', icon: '😀', label: 'Смайлы', emojis: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🤧','🥵','🥶','😵','🤯','🤠','🥳','😎','🤓','🧐','😕','😟','🙁','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿'] },
  { id: 'gestures', icon: '👍', label: 'Жесты', emojis: ['👍','👎','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','👇','☝️','✋','🤚','🖐️','🖖','👋','🤝','🙏','✍️','💅','🤳','💪','🦾','🦵','🦶','👂','🦻','👃','🧠','🦷','👀','👁️','👅','👄','💋','🩸','🤲','👐','🙌','👏','🤜','🤛','✊','👊'] },
  { id: 'hearts', icon: '❤️', label: 'Сердца', emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','♥️','💌','💋','🔥','✨','⭐','🌟','💫','⚡','💥','💢','💤','💨','🎉','🎊','🎈','🎁'] },
  { id: 'animals', icon: '🐱', label: 'Животные', emojis: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐒','🐔','🐧','🐦','🐤','🐣','🐥','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🐛','🦋','🐌','🐞','🐜','🦗','🕷️','🦂','🐢','🐍','🦎','🦖','🦕','🐙','🦑','🦐'] },
  { id: 'food', icon: '🍕', label: 'Еда', emojis: ['🍏','🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🍆','🥑','🥦','🥬','🥒','🌶️','🌽','🥕','🧄','🧅','🥔','🍠','🥐','🥯','🍞','🥖','🥨','🧀','🥚','🍳','🧈','🥞','🧇','🥓','🥩','🍗','🍖','🌭','🍔','🍟','🍕'] },
];

const activeEmojiCat = ref('smileys');
const currentEmojiList = computed(() =>
  EMOJI_CATEGORIES.find(c => c.id === activeEmojiCat.value)?.emojis || []
);

const me = computed(() => auth.user || 'Сергей');
const peer = computed(() => messages.myPeer());
const peerEmoji = computed(() => peer.value === 'Сергей' ? '👨' : '👩');
const peerOnline = computed(() => messages.isUserOnline(peer.value));
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

function swipeStyle(m) {
  if (swipeState.value.active && swipeState.value.id === m.id) {
    const dx = Math.min(swipeState.value.dx, 80);
    return { transform: `translateX(${dx}px)` };
  }
  return {};
}

function onInputFocus() { activePanel.value = 'keyboard'; }

function onBodyClick() {
  if (activePanel.value !== 'keyboard') {
    activePanel.value = 'keyboard';
  }
}

// ============================================================
// Изображения
// ============================================================
function openFilePicker() { fileEl.value?.click(); }

async function compressImage(file, maxSize = 1600, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          if (width >= height) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          } else {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function onFileChange(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { toast.error('Только изображения'); return; }
  if (file.size > 10 * 1024 * 1024) { toast.error('Максимум 10MB'); return; }
  try {
    pendingImage.value = await compressImage(file);
  } catch (err) {
    console.error('[img] compress error:', err);
    toast.error('Не удалось обработать изображение');
  }
  e.target.value = '';
}

function cancelImage() { pendingImage.value = null; }
function openFullscreen(src) { fullscreenImage.value = src; }
function closeFullscreen() { fullscreenImage.value = null; }

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
  nextTick(() => { autoResize(); inputEl.value?.focus(); });
  messages.notifyTypingStart(peer.value);
}

function onBackspace() {
  text.value = [...text.value].slice(0, -1).join('');
  nextTick(autoResize);
}

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
  const el = scrollEl.value;
  if (smooth) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  else {
    el.style.scrollBehavior = 'auto';
    el.scrollTop = el.scrollHeight;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
      el.style.scrollBehavior = '';
    });
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
    } finally { loadingOlder.value = false; }
  }
}

// ============================================================
// Открытие/закрытие
// ============================================================
async function toggle() {
  open.value = !open.value;
  if (open.value) {
    document.body.dataset.chatOpen = 'true';
    avatarKey.value++;
    // ✅ Открыли чат — гасим "Новое СООБЩЕНИЕ"
    hasFreshMessage.value = false;
    if (freshMessageTimer) {
      clearTimeout(freshMessageTimer);
      freshMessageTimer = null;
    }

    await ensureHistory();
    await nextTick();
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    const firstUnread = firstUnreadId.value;
    if (firstUnread) {
      const m = messages.messageById(firstUnread);
      if (m && !m.readAt) nextTick(() => scrollToMessage(firstUnread));
      else scrollToBottom();
    } else scrollToBottom();
    try {
      await messages.markAllRead(peer.value);
      await updateBadge(messages.totalUnread);
    } catch (e) {}
    await nextTick();
    requestAnimationFrame(() => scrollToBottom(false));
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
  if (!messages.loaded) { try { await messages.loadConversations(); } catch (e) {} }
  try { await messages.loadHistory(peer.value); } catch (e) {}
}

function close() { if (open.value) toggle(); }

// ============================================================
// Отправка + "сообщение улетает"
// ============================================================
async function send() {
  const clean = text.value.trim();
  if ((!clean && !pendingImage.value) || sending.value) return;
  sending.value = true;
  try {
    const sent = await messages.send(
      peer.value, clean, replyTo.value?.id || null, pendingImage.value
    );

    if (sent?.id) {
      await nextTick();
      const msgEl = scrollEl.value?.querySelector(`[data-msg-id="${sent.id}"]`);
      const bubble = msgEl?.querySelector('.chat-bubble');
      const panel = scrollEl.value?.closest('.chat-panel');
      if (bubble && panel) {
        const bRect = bubble.getBoundingClientRect();
        const pRect = panel.getBoundingClientRect();
        sendingFlight.value = {
          id: sent.id,
          x: bRect.left - pRect.left + bRect.width / 2,
          y: bRect.top - pRect.top + bRect.height / 2,
        };
        setTimeout(() => { sendingFlight.value = null; }, 750);
      }
    }

    text.value = '';
    replyTo.value = null;
    pendingImage.value = null;
    await nextTick();
    autoResize();
    try { playOutgoingMessage(); } catch (e) {}
    await nextTick();
    scrollToBottom(true);
  } catch (e) {
    try { playSendError(); } catch (err) {}
    toast.error('Не отправилось: ' + e.message);
  } finally { sending.value = false; }
}

async function onRetry(m) {
  if (!m.failed) return;
  try {
    await messages.retryMessage(m.id);
    toast.success('Отправлено');
    try { playOutgoingMessage(); } catch (e) {}
  } catch (e) { toast.error('Снова не удалось: ' + e.message); }
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
  } catch (e) { toast.error('Ошибка: ' + e.message); }
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
  const menuW = 340, menuH = 400;
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
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
    s.dx = Math.max(0, dx);
  } else if (Math.abs(dy) > 10) {
    s.dx = 0;
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
  }
}

function onTouchEnd(e) {
  if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
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
function onNetworkOnline() { messages.setNetworkOnline(true); }
function onNetworkOffline() { messages.setNetworkOnline(false); }

watch(open, async (v) => {
  if (v) {
    await nextTick();
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    if (inputEl.value) inputEl.value.blur();
  } else {
    if (inputEl.value) inputEl.value.blur();
  }
});

watch(history, async (newList, oldList) => {
  if (!open.value) return;
  const added = newList.length > (oldList?.length || 0);
  if (!added) return;
  const wasNearBottom = isNearBottom();
  await nextTick();
  if (wasNearBottom) scrollToBottom(true);
  else {
    newBelowCount.value += (newList.length - (oldList?.length || 0));
    showScrollDown.value = true;
  }
}, { deep: false });

// ✅ Новое сообщение — растягиваем FAB
watch(totalUnread, (n, old) => {
  if (!open.value && n > old) {
    triggerFreshMessage();
  }
});

onMounted(async () => {
  try {
    await messages.loadPresence();
    await messages.loadUnread();
    await updateBadge(messages.totalUnread);
  } catch (e) {}
  messages.setNetworkOnline(navigator.onLine);
  messages.heartbeat();
  heartbeatTimer = setInterval(() => {
    if (document.visibilityState === 'visible') messages.heartbeat();
  }, 30 * 1000);
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('beforeunload', onBeforeUnload);
  window.addEventListener('online', onNetworkOnline);
  window.addEventListener('offline', onNetworkOffline);
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
  window.removeEventListener('online', onNetworkOnline);
  window.removeEventListener('offline', onNetworkOffline);
  if (window.visualViewport) {
    window.visualViewport.removeEventListener('resize', onViewportResize);
    window.visualViewport.removeEventListener('scroll', onViewportResize);
  }
  window.removeEventListener('resize', onViewportResize);
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  if (freshMessageTimer) clearTimeout(freshMessageTimer);
});

watch(totalUnread, (n) => updateBadge(n));
watch(open, (v) => { if (v) askNotifications(); });
</script>

<template>
  <!-- FAB -->
  <Transition name="fab-pop">
    <button
      v-if="!open"
      class="chat-fab"
      :class="{
        'has-unread': totalUnread > 0,
        'is-expanded': hasFreshMessage,
      }"
      type="button"
      @click="toggle"
    >
      <span class="chat-fab-icon">
        <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
          <path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
        </svg>
      </span>

      <Transition name="fab-label">
        <span v-if="hasFreshMessage" class="chat-fab-label">Новое СООБЩЕНИЕ</span>
      </Transition>

      <span v-if="totalUnread > 0" class="chat-fab-badge">
        {{ totalUnread > 99 ? '99+' : totalUnread }}
      </span>

      <span v-if="hasFreshMessage" class="chat-fab-pulse" aria-hidden="true"></span>
    </button>
  </Transition>

  <!-- Панель -->
  <Transition name="chat-panel">
    <div
      v-if="open"
      class="chat-panel"
      :style="{ height: panelHeight || undefined, top: panelTop || undefined }"
      @click.stop
    >
      <div class="chat-head">
        <button class="chat-back" @click="close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="20" height="20">
            <path d="M15 18l-6-6 6-6" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>

        <div class="chat-head-main">
          <div :key="avatarKey" class="chat-avatar" :class="{ online: peerOnline }">
            {{ peerEmoji }}
          </div>
          <div class="chat-user-info">
            <div class="chat-user-name">{{ peer }}</div>
            <Transition name="status-fade" mode="out-in">
              <div
                :key="peerStatusText"
                class="chat-user-status"
                :class="{ online: peerOnline, typing: peerTyping }"
              >
                {{ peerStatusText }}
              </div>
            </Transition>
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

      <Transition name="offline-slide">
        <div v-if="!messages.isOnline" class="chat-offline">
          ⚠️ Нет соединения — сообщения отправятся, когда сеть вернётся
        </div>
      </Transition>

      <Transition name="pinned-slide">
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
      </Transition>

      <div ref="scrollEl" class="chat-body" @scroll.passive="onScroll" @click="onBodyClick">
        <Transition name="fade-slow">
          <div v-if="loadingOlder" class="loading-older">
            <span class="spinner"></span> Загрузка…
          </div>
        </Transition>

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

            <Transition name="msg-in" appear>
              <div
                class="chat-msg"
                :class="{
                  out: m.from === me,
                  in: m.from !== me,
                  'from-system': m.from === 'Приложение',
                  swiping: swipeState.active && swipeState.id === m.id && swipeState.dx > 0,
                  'is-pending': m.pending,
                  'is-failed': m.failed,
                }"
                :style="swipeStyle(m)"
                :data-msg-id="m.id"
                @contextmenu="onContextMenu($event, m)"
                @touchstart="onTouchStart($event, m)"
                @touchmove="onTouchMove"
                @touchend="onTouchEnd"
                @touchcancel="onTouchEnd"
              >
                <div class="chat-bubble" :class="{ 'is-pinned': m.pinnedAt }">
                  <div v-if="m.pinnedAt" class="bubble-pin">📌</div>

                  <div v-if="m.replyTo" class="bubble-reply" @click.stop="scrollToMessage(m.replyTo)">
                    <div class="br-line"></div>
                    <div class="br-text">{{ getQuoteText(m.replyTo) }}</div>
                  </div>

                  <div v-if="m.image" class="bubble-image" @click.stop="openFullscreen(m.image)">
                    <img :src="m.image" alt="image" loading="lazy" />
                  </div>

                  <div v-if="m.text" class="chat-text" v-html="linkify(m.text)"></div>

                  <div class="chat-meta">
                    <span v-if="m.editedAt" class="chat-edited">изм.</span>
                    <span class="chat-time">{{ fmtTime(m.createdAt) }}</span>

                    <Transition name="status-swap" mode="out-in">
                      <span
                        v-if="m.pending"
                        key="pending"
                        class="chat-status pending"
                        title="Отправляется…"
                      >
                        <span class="clock-dot"></span>
                      </span>
                      <span
                        v-else-if="m.failed"
                        key="failed"
                        class="chat-status failed"
                        title="Не отправлено — нажмите, чтобы повторить"
                        @click.stop="onRetry(m)"
                      >!</span>
                      <span
                        v-else-if="m.from === me"
                        key="read"
                        class="chat-read"
                        :class="{ read: !!m.readAt }"
                      >
                        <svg
                          v-if="!m.readAt"
                          viewBox="0 0 16 11"
                          width="14" height="10"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="1.6"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        ><path d="M2 6l3.5 3.5L13 2"/></svg>
                        <svg
                          v-else
                          viewBox="0 0 20 11"
                          width="18" height="10"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="1.6"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        >
                          <path d="M2 6l3.5 3.5L13 2"/>
                          <path d="M7 6l3.5 3.5L18 2"/>
                        </svg>
                      </span>
                    </Transition>
                  </div>

                  <TransitionGroup name="reactions-pop" tag="div" v-if="m.reactions?.length" class="bubble-reactions">
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
                  </TransitionGroup>
                </div>
              </div>
            </Transition>
          </template>
        </template>

        <!-- Пузырь "печатает" -->
        <Transition name="typing-bubble">
          <div v-if="peerTyping" class="chat-msg in typing-msg">
            <div class="chat-bubble typing-bubble">
              <span class="typing-dot"></span>
              <span class="typing-dot"></span>
              <span class="typing-dot"></span>
            </div>
          </div>
        </Transition>
      </div>

      <!-- Сообщение улетает -->
      <Transition name="flight">
        <div
          v-if="sendingFlight"
          class="chat-flight-dot"
          :style="{ left: sendingFlight.x + 'px', top: sendingFlight.y + 'px' }"
          aria-hidden="true"
        />
      </Transition>

      <Transition name="scroll-down">
        <button v-if="showScrollDown" class="scroll-down-btn" @click="scrollToBottom(true)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="18" height="18">
            <path d="M12 5v14M19 12l-7 7-7-7" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <Transition name="badge-pop">
            <span v-if="newBelowCount > 0" class="sd-badge">{{ newBelowCount }}</span>
          </Transition>
        </button>
      </Transition>

      <Transition name="slide-up">
        <div v-if="replyTo" class="chat-reply-preview">
          <div class="crp-line"></div>
          <div class="crp-body">
            <div class="crp-label">Ответ</div>
            <div class="crp-text">{{ getQuoteText(replyTo.id) }}</div>
          </div>
          <button class="crp-close" @click="cancelReply">✕</button>
        </div>
      </Transition>

      <Transition name="slide-up">
        <div v-if="editing" class="chat-edit-preview">
          <div class="cep-icon">✏️</div>
          <div class="cep-body">
            <div class="cep-label">Редактирование</div>
            <div class="cep-text">{{ editing.text || '📷 Изображение' }}</div>
          </div>
          <button class="cep-close" @click="cancelEdit">✕</button>
        </div>
      </Transition>

      <Transition name="slide-up">
        <div v-if="pendingImage" class="chat-image-preview">
          <img :src="pendingImage" alt="preview" />
          <button class="cip-close" @click="cancelImage">✕</button>
        </div>
      </Transition>

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

          <button class="chat-input-icon" @click="openFilePicker" title="Прикрепить изображение">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>

          <button
            class="chat-input-icon"
            :class="{ active: activePanel === 'emoji' }"
            @click="toggleEmoji"
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
            inputmode="text"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="sentences"
            @input="onInput"
            @keydown="onKeydown"
            @focus="onInputFocus"
            @click="onInputFocus"
          />

          <Transition name="send-pop" mode="out-in">
            <button
              key="send"
              class="chat-send"
              :disabled="(!text.trim() && !pendingImage) || sending"
              @click="send"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                <path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            </button>
          </Transition>
        </template>
      </div>

      <Transition name="panel-slide">
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

      <Transition name="panel-slide">
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

          <div class="settings-section">
            <div class="settings-title">Размер шрифта</div>
            <div class="theme-grid">
              <button
                v-for="f in FONT_SIZES"
                :key="f.id"
                class="theme-btn"
                :class="{ active: fontSize === f.id }"
                @click="setFontSize(f.id)"
              >
                <span class="theme-icon">Aa</span>
                <span class="theme-label">{{ f.label }}</span>
              </button>
            </div>
          </div>

          <div class="settings-section">
            <div class="settings-title">Шрифт</div>
            <div class="theme-grid">
              <button
                v-for="f in FONT_FAMILIES"
                :key="f.id"
                class="theme-btn"
                :class="{ active: fontFamily === f.id }"
                @click="setFontFamily(f.id)"
              >
                <span class="theme-icon" :style="{ fontFamily: f.family }">Aa</span>
                <span class="theme-label">{{ f.label }}</span>
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

  <!-- Fullscreen image -->
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

/* ============================================================
   FAB — растягивается в красную пилюлю при новом сообщении
   ============================================================ */
.chat-fab {
  position: fixed;
  right: 20px;
  bottom: calc(90px + env(safe-area-inset-bottom, 0));
  z-index: 950;
  height: 56px;
  width: 56px;
  border-radius: 28px;
  border: 3px solid #ffffff;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  color: #ffffff;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  gap: 8px;
  padding: 0;
  box-shadow: 0 10px 28px -8px rgba(99, 102, 241, 0.6), 0 4px 12px -4px rgba(15, 23, 42, 0.15);
  transition:
    width 0.42s cubic-bezier(.34,1.56,.64,1),
    padding 0.42s cubic-bezier(.34,1.56,.64,1),
    transform 0.25s cubic-bezier(.34,1.56,.64,1),
    background 0.3s ease,
    box-shadow 0.3s ease;
  overflow: hidden;
  white-space: nowrap;

  &:hover { transform: scale(1.08); }
  &:active { transform: scale(0.94); }
  &.has-unread:not(.is-expanded) { animation: fabPulse 1.8s ease-in-out infinite; }

  /* ✅ Развёрнутое состояние с надписью */
  &.is-expanded {
    width: 240px;
    padding: 0 22px 0 16px;
    justify-content: flex-start;
    background: linear-gradient(135deg, #ef4444, #dc2626);
    animation: fabAttention 1.4s ease-in-out infinite;
  }
}

.chat-fab-icon {
  display: flex;
  flex-shrink: 0;
  transition: transform 0.35s cubic-bezier(.34,1.56,.64,1);
}

.chat-fab.is-expanded .chat-fab-icon {
  animation: bellShake 1.6s ease-in-out infinite;
}

@keyframes bellShake {
  0%, 100% { transform: rotate(0deg); }
  10%      { transform: rotate(-12deg); }
  20%      { transform: rotate(10deg); }
  30%      { transform: rotate(-8deg); }
  40%      { transform: rotate(6deg); }
  50%      { transform: rotate(0deg); }
}

.chat-fab-label {
  font-family: -apple-system, "SF Pro Text", inherit;
  font-size: 11.5px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #ffffff;
  white-space: nowrap;
  margin-left: 4px;
}

/* ✅ Пульсирующая точка */
.chat-fab-pulse {
  position: absolute;
  top: 8px;
  right: 12px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.7);
  animation: pulseDot 1.4s ease-in-out infinite;
}

@keyframes pulseDot {
  0% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.9),
                0 0 0 0 rgba(255, 255, 255, 0.6);
  }
  70% {
    transform: scale(1.15);
    box-shadow: 0 0 0 10px rgba(255, 255, 255, 0),
                0 0 0 20px rgba(255, 255, 255, 0);
  }
  100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(255, 255, 255, 0),
                0 0 0 0 rgba(255, 255, 255, 0);
  }
}

@keyframes fabPulse {
  0%, 100% { transform: scale(1); box-shadow: 0 10px 28px -8px rgba(99, 102, 241, 0.6); }
  50%      { transform: scale(1.06); box-shadow: 0 10px 36px -6px rgba(99, 102, 241, 0.85); }
}

@keyframes fabAttention {
  0%, 100% {
    box-shadow:
      0 10px 28px -8px rgba(239, 68, 68, 0.7),
      0 0 0 0 rgba(239, 68, 68, 0.5);
  }
  50% {
    box-shadow:
      0 10px 36px -6px rgba(239, 68, 68, 0.95),
      0 0 0 12px rgba(239, 68, 68, 0);
  }
}

/* Анимация появления лейбла */
.fab-label-enter-active {
  transition: opacity 0.3s ease 0.12s, transform 0.35s cubic-bezier(.34,1.56,.64,1) 0.12s;
}
.fab-label-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.fab-label-enter-from {
  opacity: 0;
  transform: translateX(-8px);
}
.fab-label-leave-to {
  opacity: 0;
  transform: translateX(-8px);
}

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

.chat-fab.is-expanded .chat-fab-badge {
  top: 6px;
  right: 6px;
  box-shadow: 0 4px 12px -2px rgba(255, 255, 255, 0.9), 0 0 0 3px #dc2626;
}

/* ============================================================
   Panel
   ============================================================ */
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
  min-width: 30px; min-height: 30px;
  aspect-ratio: 1 / 1;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--chat-accent);
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  transition: background 0.15s, transform 0.15s;
  &:hover { background: var(--chat-menu-hover); }
  &:active { transform: scale(0.9); }
}

.chat-head-main {
  flex: 1;
  display: flex; align-items: center; gap: 10px;
  min-width: 0;
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
  animation: avatarParallax 0.65s cubic-bezier(.34,1.56,.64,1);
  will-change: transform;

  &.online::after {
    content: '';
    position: absolute;
    right: 0; bottom: 0;
    width: 10px; height: 10px;
    border-radius: 50%;
    background: #22c55e;
    border: 2px solid var(--chat-bg);
    animation: onlinePulse 2s ease-in-out infinite;
  }
}

@keyframes avatarParallax {
  0%   { transform: translateX(-12px) scale(1.2); opacity: 0; filter: blur(4px); }
  60%  { transform: translateX(0) scale(1.05); opacity: 1; filter: blur(0); }
  100% { transform: translateX(0) scale(1); opacity: 1; }
}

@keyframes onlinePulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.5); }
  50%      { box-shadow: 0 0 0 4px rgba(34, 197, 94, 0); }
}

.chat-user-info { min-width: 0; flex: 1; }
.chat-user-name {
  font-family: var(--chat-font-family, -apple-system, "SF Pro Text", sans-serif);
  font-size: calc(#{$chat-font-lg} * var(--chat-font-scale, 1));
  font-weight: 600;
  color: var(--chat-text);
  line-height: 1.2;
}
.chat-user-status {
  font-size: calc(#{$chat-font} * var(--chat-font-scale, 1));
  color: var(--chat-text-muted);
  font-weight: 400;
  margin-top: 1px;
  &.online { color: #22c55e; }
  &.typing { color: #22c55e; font-style: italic; }
}
.chat-head-action {
  width: 30px; height: 30px;
  min-width: 30px; min-height: 30px;
  aspect-ratio: 1 / 1;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: var(--chat-accent);
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  transition: background 0.15s, transform 0.15s;
  &:hover { background: var(--chat-menu-hover); }
  &:active { transform: scale(0.9); }
  &.active { background: var(--chat-menu-hover); }
}

.chat-offline {
  padding: 6px 12px;
  background: rgba(255, 149, 0, 0.15);
  color: #b45309;
  font-size: calc(#{$chat-font-sm} * var(--chat-font-scale, 1));
  font-weight: 600;
  text-align: center;
  border-bottom: 0.5px solid var(--chat-border);
  flex-shrink: 0;
}

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
  color: #22c55e; font-weight: 500; text-transform: none;
  letter-spacing: 0; font-style: italic;
}
.pinned-text {
  font-size: calc(#{$chat-font} * var(--chat-font-scale, 1));
  color: var(--chat-text);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  margin-top: 1px; opacity: 0.85;
}
.pinned-unpin {
  width: 26px; height: 26px;
  min-width: 26px; min-height: 26px;
  aspect-ratio: 1 / 1;
  border-radius: 50%;
  border: none;
  background: rgba(120, 120, 128, 0.15);
  color: var(--chat-text-muted);
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  transition: background 0.15s, transform 0.15s;
  &:hover { background: rgba(255, 59, 48, 0.15); color: #ff3b30; }
  &:active { transform: scale(0.9); }
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

.chat-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 6px; padding: 40px 20px;
  color: var(--chat-text-muted);
  text-align: center;
}
.chat-empty-icon { font-size: 38px; opacity: 0.5; }
.chat-empty-text { font-size: calc(#{$chat-font} * var(--chat-font-scale, 1)); font-weight: 500; }
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
  transition: transform 0.18s cubic-bezier(.34,1.56,.64,1), opacity 0.25s;
  margin-bottom: 14px;

  &.swiping { transition: transform 0s, opacity 0.25s; }
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
  &.is-pending .chat-bubble { opacity: 0.72; }
  &.is-failed .chat-bubble {
    opacity: 0.85;
    box-shadow: 0 0 0 1.5px rgba(255, 59, 48, 0.6), 0 1px 2px rgba(0, 0, 0, 0.15);
  }
}

.chat-msg.from-system {
  max-width: 100% !important;
  align-self: center !important;
  margin-left: auto;
  margin-right: auto;
  align-items: center;

  .chat-bubble {
    background: linear-gradient(135deg, #eef2ff 0%, #f5f3ff 100%) !important;
    color: #4338ca !important;
    border: 1px solid rgba(99, 102, 241, 0.25) !important;
    border-radius: 16px !important;
    box-shadow: 0 4px 14px -6px rgba(99, 102, 241, 0.25) !important;
    font-style: italic;
    text-align: center;
    max-width: 90%;
  }
  .chat-meta { color: #6366f1 !important; justify-content: center; }
  .chat-read { display: none; }
}

:global(:root[data-theme="dark"]) .chat-msg.from-system,
:global(:root[data-theme="night"]) .chat-msg.from-system,
:global(:root[data-theme="sunset-dark"]) .chat-msg.from-system,
:global(:root[data-theme="ocean-dark"]) .chat-msg.from-system {
  .chat-bubble {
    background: linear-gradient(135deg, #1e2732 0%, #2b3546 100%) !important;
    color: #a5b4fc !important;
    border-color: rgba(165, 180, 252, 0.25) !important;
  }
  .chat-meta { color: #a5b4fc !important; }
}

@keyframes msgHighlight {
  0%, 100% { box-shadow: 0 0 0 0 rgba(255, 149, 0, 0); }
  30%      { box-shadow: 0 0 0 4px rgba(255, 149, 0, 0.5); }
}

.chat-bubble {
  position: relative;
  padding: 6px 10px 5px;
  max-width: 100%;
  word-wrap: break-word;
  overflow-wrap: anywhere;
  font-size: calc(#{$chat-font} * var(--chat-font-scale, 1));
  line-height: 1.4;
  cursor: default;
  transition: opacity 0.25s, box-shadow 0.25s;
  &.is-pinned { padding-top: 14px; }
}

.bubble-pin {
  position: absolute;
  top: 2px; right: 6px;
  font-size: 9px;
  opacity: 0.75;
}

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
    transition: transform 0.25s cubic-bezier(.34,1.56,.64,1);
  }
  &:hover img { transform: scale(1.03); }
}

.chat-text {
  font-family: var(--chat-font-family, -apple-system, "SF Pro Text", sans-serif);
  white-space: pre-wrap;
  font-size: calc(#{$chat-font} * var(--chat-font-scale, 1));
  line-height: 1.45;
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
.chat-msg.out .chat-text :deep(code.md-code) { background: rgba(255, 255, 255, 0.22); }

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
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
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
  min-height: 10px;
}
.chat-edited { font-style: italic; font-size: 9px; opacity: 0.85; }
.chat-time {
  font-family: -apple-system, "SF Pro Text", var(--mono);
  font-size: 9.5px;
  letter-spacing: 0.02em;
}
.chat-read {
  display: inline-flex;
  align-items: center;
  margin-left: 3px;
  color: currentColor;
  opacity: 0.75;
  transition: opacity 0.2s ease, color 0.2s ease;
  svg { display: block; transition: transform 0.25s cubic-bezier(.34,1.56,.64,1); }
  &.read { opacity: 1; color: #4fc3f7; }
  &.read svg { animation: readPop 0.35s cubic-bezier(.34,1.56,.64,1); }
}
@keyframes readPop {
  0%   { transform: scale(0.7); opacity: 0.5; }
  60%  { transform: scale(1.15); }
  100% { transform: scale(1); opacity: 1; }
}
.chat-msg.out .chat-read {
  color: rgba(255, 255, 255, 0.85);
  &.read { color: #7dd3fc; }
}
.chat-msg.in .chat-read {
  color: var(--chat-text-muted);
  &.read { color: #4fc3f7; }
}
.chat-status {
  font-size: $chat-font;
  margin-left: 2px;
  font-weight: 700;
  &.pending { opacity: 0.6; display: inline-flex; align-items: center; }
  &.failed {
    color: #ff3b30;
    cursor: pointer;
    padding: 0 4px;
    border-radius: 4px;
    background: rgba(255, 59, 48, 0.15);
    font-weight: 900;
    animation: failPulse 1.6s ease-in-out infinite;
  }
}
.chat-msg.out .chat-status.failed {
  color: #ffcc00;
  background: rgba(255, 204, 0, 0.2);
}
@keyframes failPulse { 0%, 100% { opacity: 0.85; } 50% { opacity: 1; } }
.clock-dot {
  display: inline-block;
  width: 8px; height: 8px;
  border-radius: 50%;
  border: 1.5px solid currentColor;
  border-top-color: transparent;
  animation: clockSpin 1s linear infinite;
}
@keyframes clockSpin { to { transform: rotate(360deg); } }

.bubble-reactions {
  position: absolute;
  left: -10px;
  bottom: -10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 3px 5px;
  min-width: 24px;
  height: 24px;
  border-radius: 999px;
  background: var(--chat-menu-bg);
  border: 2px solid var(--chat-bg);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.18);
  z-index: 3;
  box-sizing: border-box;
}
.chat-msg.in .bubble-reactions { left: auto; right: -10px; }
.chat-msg.out .bubble-reactions { left: -10px; right: auto; }
.reaction-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 1px;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  font-family: inherit;
  line-height: 1;
  transition: transform 0.12s;
  &:hover { transform: scale(1.15); }
  &:active { transform: scale(0.9); }
}
.rc-emoji { font-size: 14px; line-height: 1; }
.rc-count {
  font-size: 10px;
  font-weight: 700;
  color: var(--chat-text);
  opacity: 0.85;
  line-height: 1;
  margin-left: 1px;
}

/* Пузырь "печатает" */
.typing-msg {
  max-width: 60px !important;
  margin-bottom: 14px;
}
.typing-bubble {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 10px 14px !important;
  background: var(--chat-bubble-in-bg) !important;
  border-radius: 16px 16px 16px 4px !important;
  animation: typingGrow 0.4s cubic-bezier(.34,1.56,.64,1);
}
@keyframes typingGrow {
  from { transform: scale(0.7); opacity: 0; }
  to   { transform: scale(1); opacity: 1; }
}
.typing-dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  background: var(--chat-text-muted);
  animation: typingPulse 1.2s ease-in-out infinite;
  &:nth-child(2) { animation-delay: 0.15s; }
  &:nth-child(3) { animation-delay: 0.3s; }
}
@keyframes typingPulse {
  0%, 100% { transform: scale(0.7); opacity: 0.4; }
  50%      { transform: scale(1.1); opacity: 1; }
}
.typing-bubble-enter-active { transition: opacity 0.25s, transform 0.3s cubic-bezier(.34,1.56,.64,1); }
.typing-bubble-leave-active { transition: opacity 0.2s, transform 0.2s ease; }
.typing-bubble-enter-from,
.typing-bubble-leave-to { opacity: 0; transform: translateY(8px) scale(0.85); }

/* Сообщение улетает */
.chat-flight-dot {
  position: absolute;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--chat-accent);
  pointer-events: none;
  z-index: 999;
  box-shadow: 0 0 20px var(--chat-accent), 0 0 40px var(--chat-accent);
  transform: translate(-50%, -50%);
  animation: flightAway 0.7s cubic-bezier(.4,0,.2,1) forwards;
}
@keyframes flightAway {
  0%   { transform: translate(-50%, -50%) scale(1); opacity: 1; filter: blur(0); }
  60%  { transform: translate(-50%, -50%) translateY(-60px) translateX(20px) scale(0.6); opacity: 0.9; filter: blur(2px); }
  100% { transform: translate(-50%, -50%) translateY(-120px) translateX(40px) scale(0.2); opacity: 0; filter: blur(8px); }
}
.flight-enter-active,
.flight-leave-active { transition: opacity 0.2s; }
.flight-enter-from,
.flight-leave-to { opacity: 0; }

.scroll-down-btn {
  position: absolute;
  right: 14px;
  bottom: calc(100% + 14px);
  width: 36px; height: 36px;
  min-width: 36px; min-height: 36px;
  aspect-ratio: 1 / 1;
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
  transition: transform 0.18s cubic-bezier(.34,1.56,.64,1);
  &:hover { transform: scale(1.1); }
  &:active { transform: scale(0.92); }
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

.chat-reply-preview,
.chat-edit-preview {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 12px;
  background: var(--chat-header-bg);
  border-top: 0.5px solid var(--chat-border);
  flex-shrink: 0;
}
.crp-line {
  width: 3px; align-self: stretch;
  border-radius: 2px; background: var(--chat-accent);
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
  font-size: calc(#{$chat-font} * var(--chat-font-scale, 1));
  color: var(--chat-text);
  opacity: 0.85;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  margin-top: 1px;
}
.crp-close, .cep-close {
  width: 24px; height: 24px;
  min-width: 24px; min-height: 24px;
  aspect-ratio: 1 / 1;
  border-radius: 50%;
  border: none;
  background: rgba(120, 120, 128, 0.15);
  color: var(--chat-text-muted);
  cursor: pointer;
  font-size: 11px;
  flex-shrink: 0;
  transition: background 0.15s, transform 0.15s;
  &:hover { background: rgba(255, 59, 48, 0.15); color: #ff3b30; }
  &:active { transform: scale(0.9); }
}

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
    animation: imgPop 0.28s cubic-bezier(.34,1.56,.64,1);
  }
}
@keyframes imgPop {
  from { transform: scale(0.85); opacity: 0; }
  to   { transform: scale(1); opacity: 1; }
}
.cip-close {
  position: absolute;
  top: 12px; right: 16px;
  width: 24px; height: 24px;
  min-width: 24px; min-height: 24px;
  aspect-ratio: 1 / 1;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  cursor: pointer;
  font-size: 12px;
  display: flex; align-items: center; justify-content: center;
  transition: transform 0.15s;
  &:active { transform: scale(0.9); }
}

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
  width: 34px; height: 34px;
  min-width: 34px; min-height: 34px;
  aspect-ratio: 1 / 1;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: var(--chat-text-muted);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.15s, color 0.15s, transform 0.15s;
  &:hover { background: var(--chat-menu-hover); color: var(--chat-accent); }
  &:active { transform: scale(0.92); }
  &.active { color: var(--chat-accent); background: var(--chat-menu-hover); }
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
  font-family: var(--chat-font-family, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif);
  font-size: calc(#{$chat-font} * var(--chat-font-scale, 1));
  font-weight: 400;
  line-height: 1.4;
  resize: none;
  outline: none;
  overflow-y: auto;
  transition: border-color 0.15s, box-shadow 0.15s;
  &:focus {
    border-color: var(--chat-accent);
    box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.12);
  }
  &::placeholder { color: var(--chat-text-muted); }
}
.chat-send {
  width: 30px; height: 30px;
  min-width: 30px; min-height: 30px;
  aspect-ratio: 1 / 1;
  border-radius: 50%;
  border: none;
  background: var(--chat-accent);
  color: #ffffff;
  cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  transition: transform 0.15s cubic-bezier(.34,1.56,.64,1), opacity 0.2s;
  &:disabled { opacity: 0.35; cursor: not-allowed; }
  &:not(:disabled):hover { transform: scale(1.08); }
  &:not(:disabled):active { transform: scale(0.9); }
}
.chat-input-btn {
  width: 30px; height: 30px;
  min-width: 30px; min-height: 30px;
  aspect-ratio: 1 / 1;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.chat-input-btn-accept {
  background: #34c759;
  color: #ffffff;
  transition: transform 0.15s;
  &:active { transform: scale(0.9); }
}

.chat-panel-bottom {
  border-top: 0.5px solid var(--chat-border);
  background: var(--chat-header-bg);
  flex-shrink: 0;
  overflow: hidden;
}
.emoji-panel { display: flex; flex-direction: column; max-height: 240px; }
.emoji-cats {
  display: flex; gap: 2px; padding: 4px 8px;
  border-bottom: 0.5px solid var(--chat-border);
  overflow-x: auto; flex-shrink: 0;
  &::-webkit-scrollbar { display: none; }
}
.emoji-cat {
  width: 34px; height: 34px;
  min-width: 34px; min-height: 34px;
  aspect-ratio: 1 / 1;
  border-radius: 8px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.15s, transform 0.15s;
  &:hover { background: var(--chat-menu-hover); transform: scale(1.05); }
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
  width: 100%; height: 36px;
  min-height: 36px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 22px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, transform 0.15s cubic-bezier(.34,1.56,.64,1);
  &:hover { background: var(--chat-menu-hover); transform: scale(1.12); }
  &:active { transform: scale(0.88); }
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
.settings-panel {
  max-height: 420px;
  overflow-y: auto;
  padding: 12px 14px 14px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.settings-section { display: flex; flex-direction: column; gap: 8px; }
.settings-title {
  font-size: $chat-font-sm;
  font-weight: 700;
  color: var(--chat-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.theme-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}
.theme-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  padding: 8px 4px;
  border-radius: 10px;
  border: 1.5px solid var(--chat-border);
  background: var(--chat-input-bg);
  color: var(--chat-text);
  cursor: pointer;
  font-family: inherit;
  font-size: 10px;
  font-weight: 600;
  transition: border-color 0.15s, background 0.15s, color 0.15s, transform 0.15s;
  &:hover { border-color: var(--chat-accent); transform: translateY(-1px); }
  &:active { transform: scale(0.96); }
  &.active {
    border-color: var(--chat-accent);
    background: var(--chat-menu-hover);
    color: var(--chat-accent);
  }
}
.theme-icon { font-size: 16px; line-height: 1; font-weight: 700; }
.theme-label {
  font-size: 9.5px;
  font-weight: 600;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  max-width: 100%;
}
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
  transition: transform 0.15s, border-color 0.15s, box-shadow 0.15s;
  overflow: hidden;
  &:hover { transform: scale(1.06); }
  &:active { transform: scale(0.94); }
  &.active { border-color: var(--chat-accent); box-shadow: 0 0 0 2px rgba(0, 122, 255, 0.25); }
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

.ctx-backdrop { position: fixed; inset: 0; z-index: 9999; background: rgba(0, 0, 0, 0.05); }
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
  min-width: 32px; min-height: 32px;
  aspect-ratio: 1 / 1;
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
  transition: transform 0.15s cubic-bezier(.34,1.56,.64,1), background 0.15s;
  &:hover { transform: scale(1.22); background: var(--chat-menu-hover); }
  &:active { transform: scale(0.9); }
  &.active {
    background: var(--chat-menu-hover);
    box-shadow: inset 0 0 0 1.5px var(--chat-accent);
  }
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
  transition: background 0.15s, color 0.15s, transform 0.12s;
  &:hover { background: var(--chat-menu-hover); color: var(--chat-accent); }
  &:active { transform: scale(0.98); }
  &.danger { color: #ff3b30; &:hover { background: rgba(255, 59, 48, 0.12); color: #ff3b30; } }
}
.ctx-icon { font-size: $chat-font; width: 18px; text-align: center; flex-shrink: 0; }
.ctx-label { flex: 1; }

.fs-overlay {
  position: fixed; inset: 0; z-index: 10000;
  background: rgba(0, 0, 0, 0.92);
  display: flex; align-items: center; justify-content: center;
  padding: 16px; cursor: zoom-out;
}
.fs-overlay img {
  max-width: 100%; max-height: 100%;
  object-fit: contain;
  border-radius: 8px;
  cursor: default;
}
.fs-close {
  position: absolute;
  top: calc(16px + env(safe-area-inset-top, 0));
  right: 16px;
  width: 36px; height: 36px;
  min-width: 36px; min-height: 36px;
  aspect-ratio: 1 / 1;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  font-size: 16px;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}

/* Анимации общего */
.chat-panel-enter-active { transition: opacity 0.28s ease, transform 0.38s cubic-bezier(.34,1.56,.64,1); }
.chat-panel-leave-active { transition: opacity 0.2s ease, transform 0.25s cubic-bezier(.4,0,.6,1); }
.chat-panel-enter-from,
.chat-panel-leave-to { opacity: 0; transform: translateY(24px) scale(0.93); transform-origin: bottom right; }
.fab-pop-enter-active { transition: opacity 0.25s, transform 0.35s cubic-bezier(.34,1.56,.64,1); }
.fab-pop-leave-active { transition: opacity 0.18s, transform 0.22s ease; }
.fab-pop-enter-from,
.fab-pop-leave-to { opacity: 0; transform: scale(0.6); }
.badge-pop-enter-active { transition: opacity 0.2s, transform 0.28s cubic-bezier(.34,1.56,.64,1); }
.badge-pop-leave-active { transition: opacity 0.15s, transform 0.2s ease; }
.badge-pop-enter-from,
.badge-pop-leave-to { opacity: 0; transform: scale(0.4); }
.status-fade-enter-active,
.status-fade-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.status-fade-enter-from { opacity: 0; transform: translateY(-4px); }
.status-fade-leave-to { opacity: 0; transform: translateY(4px); }
.offline-slide-enter-active,
.offline-slide-leave-active { transition: max-height 0.3s ease, opacity 0.25s ease, padding 0.3s ease; overflow: hidden; }
.offline-slide-enter-from,
.offline-slide-leave-to { max-height: 0; opacity: 0; padding-top: 0; padding-bottom: 0; }
.offline-slide-enter-to,
.offline-slide-leave-from { max-height: 40px; opacity: 1; }
.pinned-slide-enter-active,
.pinned-slide-leave-active { transition: max-height 0.32s ease, opacity 0.25s ease; overflow: hidden; }
.pinned-slide-enter-from,
.pinned-slide-leave-to { max-height: 0; opacity: 0; }
.pinned-slide-enter-to,
.pinned-slide-leave-from { max-height: 60px; opacity: 1; }
.msg-in-enter-active { transition: opacity 0.25s ease, transform 0.32s cubic-bezier(.34,1.56,.64,1); }
.msg-in-enter-from { opacity: 0; transform: translateY(10px) scale(0.96); }
.reactions-pop-enter-active { transition: opacity 0.2s, transform 0.28s cubic-bezier(.34,1.56,.64,1); }
.reactions-pop-leave-active { transition: opacity 0.15s, transform 0.15s ease; }
.reactions-pop-enter-from,
.reactions-pop-leave-to { opacity: 0; transform: scale(0.6); }
.status-swap-enter-active,
.status-swap-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.status-swap-enter-from { opacity: 0; transform: scale(0.6); }
.status-swap-leave-to { opacity: 0; transform: scale(0.6); }
.fade-slow-enter-active,
.fade-slow-leave-active { transition: opacity 0.25s ease; }
.fade-slow-enter-from,
.fade-slow-leave-to { opacity: 0; }
.scroll-down-enter-active { transition: opacity 0.22s, transform 0.3s cubic-bezier(.34,1.56,.64,1); }
.scroll-down-leave-active { transition: opacity 0.15s, transform 0.2s ease; }
.scroll-down-enter-from,
.scroll-down-leave-to { opacity: 0; transform: translateY(8px) scale(0.85); }
.slide-up-enter-active { transition: opacity 0.22s, transform 0.3s cubic-bezier(.34,1.56,.64,1); }
.slide-up-leave-active { transition: opacity 0.15s, transform 0.2s ease; }
.slide-up-enter-from,
.slide-up-leave-to { opacity: 0; transform: translateY(12px); }
.panel-slide-enter-active { transition: max-height 0.28s cubic-bezier(.34,1.56,.64,1), opacity 0.22s ease; max-height: 420px; }
.panel-slide-leave-active { transition: max-height 0.22s ease, opacity 0.18s ease; max-height: 0; }
.panel-slide-enter-from,
.panel-slide-leave-to { max-height: 0; opacity: 0; }
.ctx-menu-enter-active { transition: opacity 0.18s ease, transform 0.22s cubic-bezier(.34,1.56,.64,1); }
.ctx-menu-leave-active { transition: opacity 0.14s ease, transform 0.16s ease; }
.ctx-menu-enter-from,
.ctx-menu-leave-to { opacity: 0; transform: scale(0.92); }
.fs-enter-active { transition: opacity 0.24s ease, transform 0.3s cubic-bezier(.34,1.56,.64,1); }
.fs-leave-active { transition: opacity 0.18s ease, transform 0.2s ease; }
.fs-enter-from,
.fs-leave-to { opacity: 0; transform: scale(0.96); }
.send-pop-enter-active { transition: opacity 0.18s, transform 0.25s cubic-bezier(.34,1.56,.64,1); }
.send-pop-leave-active { transition: opacity 0.12s, transform 0.15s ease; }
.send-pop-enter-from,
.send-pop-leave-to { opacity: 0; transform: scale(0.7); }

@media (max-width: 700px) {
  .chat-input-icon, .chat-send, .chat-input-btn,
  .chat-head-action, .chat-back, .pinned-unpin,
  .crp-close, .cep-close, .cip-close, .reaction-btn,
  .emoji-cat, .emoji-cell, .theme-btn, .bg-btn,
  .scroll-down-btn { min-height: 0 !important; min-width: 0 !important; }
  .chat-fab { right: 16px; bottom: calc(84px + env(safe-area-inset-bottom, 0)); width: 52px; height: 52px; }
  .chat-fab.is-expanded { width: 220px; padding: 0 18px 0 14px; }
  .chat-panel {
    right: 0; left: 0; top: 0; bottom: 0;
    width: 100%; max-width: 100%;
    height: 100%; max-height: 100%;
    margin-bottom: 0; border-radius: 0; border: none;
  }
  .chat-head { padding-top: calc(10px + env(safe-area-inset-top, 0)); position: sticky; top: 0; z-index: 10; }
  .chat-pinned, .chat-offline { position: sticky; top: calc(54px + env(safe-area-inset-top, 0)); z-index: 9; }
  .chat-body { padding: 8px 10px; overscroll-behavior: contain; }
  .chat-msg { max-width: 85%; }
  .chat-bubble, .chat-text, .chat-input { font-size: calc(#{$chat-font-lg} * var(--chat-font-scale, 1)); }
  .chat-input-icon { width: 36px; height: 36px; min-width: 36px; min-height: 36px; }
  .chat-send { width: 36px; height: 36px; min-width: 36px; min-height: 36px; }
  .chat-input-btn { width: 36px; height: 36px; min-width: 36px; min-height: 36px; }
  .chat-head-action { width: 32px; height: 32px; min-width: 32px; min-height: 32px; }
  .chat-back { width: 32px; height: 32px; min-width: 32px; min-height: 32px; }
  .ctx-menu { left: 8px !important; right: 8px !important; top: auto !important; bottom: calc(8px + env(safe-area-inset-bottom, 0)); max-width: none; width: auto; border-radius: 18px; }
  .reaction-btn { width: 38px; height: 38px; min-width: 38px; min-height: 38px; font-size: 22px; }
  .reactions-row { justify-content: space-between; padding: 6px 2px 10px; }
  .scroll-down-btn { right: 12px; width: 40px; height: 40px; min-width: 40px; min-height: 40px; }
  .emoji-grid { max-height: 220px; }
  .bg-grid { grid-template-columns: repeat(6, 1fr); }
  .theme-grid { grid-template-columns: repeat(4, 1fr); }
}

@media (prefers-reduced-motion: reduce) {
  .chat-fab.is-expanded,
  .chat-fab.has-unread,
  .chat-fab-pulse,
  .chat-avatar { animation: none !important; }
}
</style>