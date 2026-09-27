<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { useMessagesStore } from '@/stores/messages';
import { useAuthStore } from '@/stores/auth';
import { useToast } from '@/composables/useToast';
import {
  getPermission,
  requestPermission,
  updateBadge,
} from '@/composables/usePushNotifications';

const messages = useMessagesStore();
const auth = useAuthStore();
const toast = useToast();

const open = ref(false);
const text = ref('');
const sending = ref(false);
const scrollEl = ref(null);
const inputEl = ref(null);

// Контекстное меню
const menu = ref({ open: false, x: 0, y: 0, message: null });

// Режим редактирования
const editing = ref(null);
const editText = ref('');

// Режим ответа
const replyTo = ref(null);

const me = computed(() => auth.user || 'Сергей');
const peer = computed(() => messages.myPeer());
const peerEmoji = computed(() => peer.value === 'Сергей' ? '👨' : '👩');
const peerOnline = computed(() => messages.isOnline(peer.value));

const history = computed(() => messages.messagesWith(peer.value));
const pinned = computed(() => messages.pinnedWith(peer.value));
const pinnedLatest = computed(() =>
  [...pinned.value].sort((a, b) => new Date(b.pinnedAt) - new Date(a.pinnedAt))[0]
);
const totalUnread = computed(() => messages.totalUnread);

// ============================================================
// Presence — «был(а) недавно»
// ============================================================
const peerStatusText = computed(() => {
  if (peerOnline.value) return 'в сети';
  const last = messages.lastSeen(peer.value);
  if (!last) return 'был(а) недавно';
  return fmtLastSeen(last);
});

function fmtLastSeen(iso) {
  if (!iso) return 'был(а) недавно';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 60)   return 'был(а) только что';
  if (diffMin < 60)   return `был(а) ${diffMin} мин назад`;
  if (diffHours < 24) return `был(а) ${diffHours} ч назад`;

  if (diffDays === 1) return 'был(а) вчера';
  if (diffDays < 7)   return `был(а) ${diffDays} дн назад`;

  return 'был(а) ' + d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
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
    scrollToBottom();
    setTimeout(() => inputEl.value?.focus(), 150);
    try {
      await messages.markAllRead(peer.value);
      await updateBadge(messages.totalUnread);
    } catch (e) { /* ignore */ }
  } else {
    document.body.dataset.chatOpen = 'false';
    closeMenu();
  }
}

async function ensureHistory() {
  if (!messages.loaded) {
    try { await messages.loadConversations(); } catch (e) {}
  }
  try { await messages.loadHistory(peer.value); } catch (e) {}
}

function close() {
  if (open.value) toggle();
}

// ============================================================
// Отправка
// ============================================================
async function send() {
  const clean = text.value.trim();
  if (!clean || sending.value) return;

  sending.value = true;
  try {
    await messages.send(peer.value, clean, replyTo.value?.id || null);
    text.value = '';
    replyTo.value = null;
    await nextTick();
    scrollToBottom();
  } catch (e) {
    toast.error('Не отправилось: ' + e.message);
  } finally {
    sending.value = false;
  }
}

function onKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    send();
  }
  if (e.key === 'Escape') {
    if (editing.value) {
      editing.value = null;
    } else if (replyTo.value) {
      replyTo.value = null;
    } else {
      close();
    }
  }
}

// ============================================================
// Редактирование
// ============================================================
function startEdit(msg) {
  editing.value = msg;
  editText.value = msg.text;
  replyTo.value = null;
  closeMenu();
  nextTick(() => inputEl.value?.focus());
}

async function saveEdit() {
  const clean = editText.value.trim();
  if (!clean || clean === editing.value.text) {
    editing.value = null;
    return;
  }

  try {
    await messages.edit(editing.value.id, clean);
    toast.success('✏️ Сообщение изменено');
    editing.value = null;
    editText.value = '';
  } catch (e) {
    toast.error('Ошибка: ' + e.message);
  }
}

function cancelEdit() {
  editing.value = null;
  editText.value = '';
}

// ============================================================
// Удаление
// ============================================================
async function removeMsg(msg) {
  closeMenu();
  if (!confirm('Удалить сообщение?')) return;
  try {
    await messages.remove(msg.id);
    toast.info('🗑 Сообщение удалено');
  } catch (e) {
    toast.error('Ошибка: ' + e.message);
  }
}

// ============================================================
// Пиннед
// ============================================================
async function togglePin(msg) {
  closeMenu();
  try {
    const res = await messages.togglePin(msg.id);
    toast.info(res.pinned ? '📌 Закреплено' : '📌 Откреплено');
  } catch (e) {
    toast.error('Ошибка: ' + e.message);
  }
}

// ============================================================
// Ответ
// ============================================================
function startReply(msg) {
  replyTo.value = msg;
  editing.value = null;
  closeMenu();
  nextTick(() => inputEl.value?.focus());
}

function cancelReply() {
  replyTo.value = null;
}

// ============================================================
// Контекстное меню
// ============================================================
let longPressTimer = null;
let longPressStart = null;
let longPressTriggered = false;

function openMenu(e, msg) {
  if (e.cancelable) e.preventDefault();
  e.stopPropagation();

  let x = e.clientX || 0;
  let y = e.clientY || 0;

  if (e.touches && e.touches[0]) {
    x = e.touches[0].clientX;
    y = e.touches[0].clientY;
  } else if (e.changedTouches && e.changedTouches[0]) {
    x = e.changedTouches[0].clientX;
    y = e.changedTouches[0].clientY;
  }

  // Держим внутри окна
  const menuW = 200;
  const menuH = 220;
  x = Math.min(x, window.innerWidth - menuW - 8);
  y = Math.min(y, window.innerHeight - menuH - 8);
  x = Math.max(8, x);
  y = Math.max(8, y);

  menu.value = { open: true, x, y, message: msg };

  if (navigator.vibrate) navigator.vibrate(15);
}

function closeMenu() {
  menu.value.open = false;
  menu.value.message = null;
}

const menuIsMine = computed(() =>
  menu.value.message?.from === me.value
);

// ============================================================
// Long-press для мобильного
// ============================================================
function onTouchStart(e, msg) {
  if (window.innerWidth > 700) return;
  if (e.touches.length !== 1) return;

  longPressTriggered = false;
  longPressStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };

  if (longPressTimer) clearTimeout(longPressTimer);
  longPressTimer = setTimeout(() => {
    longPressTimer = null;
    longPressTriggered = true;

    const fakeEvent = {
      clientX: longPressStart.x,
      clientY: longPressStart.y,
      cancelable: false,
      preventDefault: () => {},
      stopPropagation: () => {},
    };
    openMenu(fakeEvent, msg);
  }, 450);
}

function onTouchMove(e) {
  if (!longPressTimer || !longPressStart) return;
  if (e.touches.length !== 1) return;

  const dx = Math.abs(e.touches[0].clientX - longPressStart.x);
  const dy = Math.abs(e.touches[0].clientY - longPressStart.y);
  if (dx > 10 || dy > 10) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
    longPressStart = null;
  }
}

function onTouchEnd(e) {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
  if (longPressTriggered) {
    // Блокируем последующий click/touchend — не даём закрыть меню
    if (e && e.cancelable) e.preventDefault();
    e && e.stopPropagation();
    setTimeout(() => { longPressTriggered = false; }, 350);
  }
  longPressStart = null;
}

// ============================================================
// Скролл
// ============================================================
function scrollToBottom() {
  if (scrollEl.value) {
    scrollEl.value.scrollTop = scrollEl.value.scrollHeight;
  }
}

function scrollToMessage(id) {
  const el = scrollEl.value?.querySelector(`[data-msg-id="${id}"]`);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('highlight');
    setTimeout(() => el.classList.remove('highlight'), 1200);
  }
}

watch(history, () => {
  if (open.value) nextTick(() => scrollToBottom());
});

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
// PWA / Presence heartbeat
// ============================================================
let heartbeatTimer = null;

async function askNotifications() {
  const cur = getPermission();
  if (cur === 'default') {
    const res = await requestPermission();
    if (res === 'granted') toast.success('🔔 Уведомления включены');
  }
}

onMounted(async () => {
  try {
    await messages.loadPresence();
    await messages.loadUnread();
    await updateBadge(messages.totalUnread);
  } catch (e) { /* ignore */ }

  messages.heartbeat();
  heartbeatTimer = setInterval(() => {
    if (document.visibilityState === 'visible') {
      messages.heartbeat();
    }
  }, 30 * 1000);

  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('beforeunload', onBeforeUnload);
});

function onVisibilityChange() {
  if (document.visibilityState === 'visible') {
    messages.heartbeat();
  }
}

function onBeforeUnload() {
  messages.heartbeat();
}

onUnmounted(() => {
  document.body.dataset.chatOpen = 'false';
  document.removeEventListener('visibilitychange', onVisibilityChange);
  window.removeEventListener('beforeunload', onBeforeUnload);
  if (heartbeatTimer) clearInterval(heartbeatTimer);
});

watch(totalUnread, (n) => updateBadge(n));
watch(open, (v) => { if (v) askNotifications(); });
</script>

<template>
  <!-- Плавающая кнопка -->
  <button
    class="chat-fab"
    :class="{ open, 'has-unread': totalUnread > 0 }"
    type="button"
    @click="toggle"
  >
    <span class="chat-fab-icon">
      <svg v-if="!open" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
        <path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
      </svg>
      <svg v-else viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
        <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
      </svg>
    </span>

    <span v-if="totalUnread > 0 && !open" class="chat-fab-badge">
      {{ totalUnread > 99 ? '99+' : totalUnread }}
    </span>
  </button>

  <!-- Панель чата -->
  <Transition name="chat-panel">
    <div v-if="open" class="chat-panel" @click.stop>
      <!-- Header в стиле Telegram iOS -->
      <div class="chat-head">
        <button class="chat-back" @click="close" aria-label="Назад">
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
            <div class="chat-user-status" :class="{ online: peerOnline }">
              {{ peerStatusText }}
            </div>
          </div>
        </div>

        <button class="chat-head-action" @click="close" title="Закрыть">
          <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
            <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </div>

      <!-- Pinned bar -->
      <div v-if="pinnedLatest" class="chat-pinned" @click="scrollToMessage(pinnedLatest.id)">
        <div class="pinned-icon">📌</div>
        <div class="pinned-body">
          <div class="pinned-label">Закреплённое сообщение</div>
          <div class="pinned-text">{{ pinnedLatest.text }}</div>
        </div>
        <button class="pinned-unpin" @click.stop="togglePin(pinnedLatest)" title="Открепить">
          <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
            <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </div>

      <!-- Сообщения -->
      <div ref="scrollEl" class="chat-body">
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
            >
              {{ fmtDay(m.createdAt) }}
            </div>

            <div
              class="chat-msg"
              :class="m.from === me ? 'out' : 'in'"
              :data-msg-id="m.id"
              @contextmenu="openMenu($event, m)"
              @touchstart="onTouchStart($event, m)"
              @touchmove="onTouchMove"
              @touchend="onTouchEnd"
              @touchcancel="onTouchEnd"
            >
              <div class="chat-bubble" :class="{ 'is-pinned': m.pinnedAt }">
                <div v-if="m.pinnedAt" class="bubble-pin">📌</div>

                <div v-if="m.replyTo" class="bubble-reply" @click.stop="scrollToMessage(m.replyTo)">
                  <div class="br-line"></div>
                  <div class="br-text">↩️ ответ</div>
                </div>

                <div class="chat-text">{{ m.text }}</div>

                <div class="chat-meta">
                  <span v-if="m.editedAt" class="chat-edited">изм.</span>
                  <span class="chat-time">{{ fmtTime(m.createdAt) }}</span>
                  <span
                    v-if="m.from === me"
                    class="chat-read"
                    :class="{ read: !!m.readAt }"
                  >
                    {{ m.readAt ? '✓✓' : '✓' }}
                  </span>
                </div>
              </div>
            </div>
          </template>
        </template>
      </div>

      <!-- Reply preview -->
      <div v-if="replyTo" class="chat-reply-preview">
        <div class="crp-line"></div>
        <div class="crp-body">
          <div class="crp-label">Ответ на сообщение</div>
          <div class="crp-text">{{ replyTo.text }}</div>
        </div>
        <button class="crp-close" @click="cancelReply">✕</button>
      </div>

      <!-- Edit preview -->
      <div v-if="editing" class="chat-edit-preview">
        <div class="cep-icon">✏️</div>
        <div class="cep-body">
          <div class="cep-label">Редактирование</div>
          <div class="cep-text">{{ editing.text }}</div>
        </div>
        <button class="cep-close" @click="cancelEdit">✕</button>
      </div>

      <!-- Ввод -->
      <div class="chat-input-row">
        <template v-if="editing">
          <button class="chat-input-btn chat-input-btn-accept" @click="saveEdit" title="Сохранить">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="18" height="18">
              <polyline points="20 6 9 17 4 12" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <input
            ref="inputEl"
            v-model="editText"
            class="chat-input"
            type="text"
            @keydown="onKeydown"
            placeholder="Редактировать…"
          />
        </template>

        <template v-else>
          <textarea
            ref="inputEl"
            v-model="text"
            class="chat-input"
            placeholder="Сообщение"
            rows="1"
            @keydown="onKeydown"
          />
          <button
            class="chat-send"
            :disabled="!text.trim() || sending"
            @click="send"
            title="Отправить"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
              <path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        </template>
      </div>
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
        @touchstart.self="closeMenu"
      >
        <div
          class="ctx-menu"
          :style="{ left: menu.x + 'px', top: menu.y + 'px' }"
          @click.stop
          @touchstart.stop
          @touchend.stop
        >
          <button class="ctx-item" @click="startReply(menu.message)">
            <span class="ctx-icon">↩️</span>
            <span class="ctx-label">Ответить</span>
          </button>

          <button class="ctx-item" @click="togglePin(menu.message)">
            <span class="ctx-icon">📌</span>
            <span class="ctx-label">
              {{ menu.message?.pinnedAt ? 'Открепить' : 'Закрепить' }}
            </span>
          </button>

          <button
            v-if="menuIsMine"
            class="ctx-item"
            @click="startEdit(menu.message)"
          >
            <span class="ctx-icon">✏️</span>
            <span class="ctx-label">Редактировать</span>
          </button>

          <button
            class="ctx-item danger"
            @click="removeMsg(menu.message)"
          >
            <span class="ctx-icon">🗑</span>
            <span class="ctx-label">Удалить</span>
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
/* Плавающая кнопка */
.chat-fab {
  position: fixed;
  right: 20px;
  bottom: calc(90px + env(safe-area-inset-bottom, 0));
  z-index: 950;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: 3px solid #ffffff;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  color: #ffffff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow:
    0 10px 28px -8px rgba(99, 102, 241, 0.6),
    0 4px 12px -4px rgba(15, 23, 42, 0.15);
  transition: transform 0.2s cubic-bezier(.34,1.56,.64,1);

  &:hover { transform: scale(1.08); }
  &:active { transform: scale(0.94); }

  &.open {
    background: linear-gradient(135deg, #ef4444, #dc2626);
    box-shadow: 0 10px 28px -8px rgba(239, 68, 68, 0.6);
  }

  &.has-unread:not(.open) {
    animation: fabPulse 1.6s ease-in-out infinite;
  }
}

@keyframes fabPulse {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.06); }
}

.chat-fab-icon { display: flex; }

.chat-fab-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  border-radius: 999px;
  background: linear-gradient(135deg, #ef4444, #dc2626);
  color: #ffffff;
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 800;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow:
    0 4px 12px -2px rgba(239, 68, 68, 0.7),
    0 0 0 3px #ffffff;
  animation: badgePop 0.3s cubic-bezier(.34,1.56,.64,1);
}

@keyframes badgePop {
  from { transform: scale(0); }
  to   { transform: scale(1); }
}

/* Панель чата */
.chat-panel {
  position: fixed;
  right: 20px;
  bottom: calc(90px + env(safe-area-inset-bottom, 0));
  z-index: 940;
  width: 400px;
  max-width: calc(100vw - 32px);
  height: 580px;
  max-height: calc(100vh - 200px);

  background: #f2f2f7;
  border-radius: 20px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  box-shadow:
    0 30px 70px -20px rgba(15, 23, 42, 0.3),
    0 10px 30px -10px rgba(15, 23, 42, 0.15);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  margin-bottom: 72px;
}

/* HEADER в стиле Telegram iOS */
.chat-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 12px;
  background: rgba(249, 250, 251, 0.92);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border-bottom: 0.5px solid rgba(60, 60, 67, 0.15);
  flex-shrink: 0;
  position: relative;
  z-index: 5;
}

.chat-back {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: #007aff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.15s;

  &:hover { background: rgba(0, 122, 255, 0.1); }
  &:active { background: rgba(0, 122, 255, 0.18); }
}

.chat-head-main {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  cursor: pointer;
  user-select: none;
}

.chat-avatar {
  position: relative;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(139, 92, 246, 0.2));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;

  &.online::after {
    content: '';
    position: absolute;
    right: 0;
    bottom: 0;
    width: 11px;
    height: 11px;
    border-radius: 50%;
    background: #22c55e;
    border: 2px solid #ffffff;
  }
}

.chat-user-info { min-width: 0; flex: 1; }

.chat-user-name {
  font-size: 15px;
  font-weight: 600;
  color: #000;
  line-height: 1.2;
  letter-spacing: -0.01em;
}

.chat-user-status {
  font-size: 12px;
  color: #8e8e93;
  font-weight: 400;
  margin-top: 1px;

  &.online { color: #22c55e; }
}

.chat-head-action {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: #007aff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.15s;

  &:hover { background: rgba(0, 122, 255, 0.1); }
}

/* PINNED BAR */
.chat-pinned {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  background: rgba(249, 250, 251, 0.95);
  backdrop-filter: blur(20px);
  border-bottom: 0.5px solid rgba(60, 60, 67, 0.15);
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s;

  &:hover { background: rgba(240, 240, 245, 0.95); }
}

.pinned-icon {
  font-size: 14px;
  flex-shrink: 0;
  color: #007aff;
}

.pinned-body {
  flex: 1;
  min-width: 0;
  border-left: 3px solid #007aff;
  padding-left: 10px;
}

.pinned-label {
  font-size: 11px;
  font-weight: 600;
  color: #007aff;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.pinned-text {
  font-size: 13px;
  color: #3c3c43;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 1px;
}

.pinned-unpin {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background: rgba(120, 120, 128, 0.1);
  color: #8e8e93;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.15s;

  &:hover {
    background: rgba(255, 59, 48, 0.15);
    color: #ff3b30;
  }
}

/* BODY */
.chat-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px 14px 8px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  background:
    linear-gradient(180deg, rgba(242, 242, 247, 0.6), rgba(242, 242, 247, 0.9)),
    #f2f2f7;
  scroll-behavior: smooth;
}

.chat-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px 20px;
  color: #8e8e93;
  text-align: center;
}

.chat-empty-icon { font-size: 44px; opacity: 0.5; }
.chat-empty-text { font-size: 13.5px; font-weight: 500; }
.chat-empty-hint { font-size: 12px; opacity: 0.75; }

.chat-day {
  align-self: center;
  padding: 3px 12px;
  margin: 8px 0 4px;
  border-radius: 999px;
  background: rgba(120, 120, 128, 0.15);
  color: #6c6c70;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.chat-msg {
  display: flex;
  max-width: 78%;
  -webkit-user-select: none;
  user-select: none;

  &.in {
    align-self: flex-start;

    .chat-bubble {
      background: #ffffff;
      color: #000;
      border-radius: 18px 18px 18px 4px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
    }

    .chat-meta { color: #8e8e93; }
  }

  &.out {
    align-self: flex-end;

    .chat-bubble {
      background: #007aff;
      color: #ffffff;
      border-radius: 18px 18px 4px 18px;
      box-shadow: 0 1px 2px rgba(0, 122, 255, 0.3);
    }

    .chat-meta { color: rgba(255, 255, 255, 0.85); }
  }

  &.highlight .chat-bubble {
    animation: msgHighlight 1.2s ease-out;
  }
}

@keyframes msgHighlight {
  0%, 100% { box-shadow: 0 0 0 0 rgba(255, 149, 0, 0); }
  30%      { box-shadow: 0 0 0 4px rgba(255, 149, 0, 0.5); }
}

.chat-bubble {
  position: relative;
  padding: 7px 12px 6px;
  max-width: 100%;
  word-wrap: break-word;
  overflow-wrap: anywhere;
  font-size: 15px;
  line-height: 1.35;
  cursor: default;

  &.is-pinned {
    padding-top: 16px;
  }
}

.bubble-pin {
  position: absolute;
  top: 3px;
  right: 8px;
  font-size: 10px;
  opacity: 0.75;
}

.chat-text { white-space: pre-wrap; }

.bubble-reply {
  display: flex;
  align-items: stretch;
  gap: 6px;
  margin: -2px 0 4px;
  padding: 3px 6px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.05);
  cursor: pointer;
  font-size: 12px;
  max-width: 100%;

  .chat-msg.out & {
    background: rgba(255, 255, 255, 0.15);
  }
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
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  font-size: 11px;
  font-weight: 500;
  margin-top: 2px;
  line-height: 1;
}

.chat-edited {
  font-style: italic;
  opacity: 0.85;
  font-size: 10px;
}

.chat-time {
  font-family: -apple-system, "SF Pro Text", var(--mono);
  opacity: 0.9;
  font-size: 11px;
}

.chat-read {
  font-size: 12px;
  opacity: 0.7;
  margin-left: 2px;

  &.read { opacity: 1; }
}

/* REPLY / EDIT PREVIEW */
.chat-reply-preview,
.chat-edit-preview {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  background: rgba(249, 250, 251, 0.95);
  backdrop-filter: blur(20px);
  border-top: 0.5px solid rgba(60, 60, 67, 0.15);
  flex-shrink: 0;
}

.crp-line {
  width: 3px;
  align-self: stretch;
  border-radius: 2px;
  background: #007aff;
  flex-shrink: 0;
}

.crp-body, .cep-body {
  flex: 1;
  min-width: 0;
}

.crp-label, .cep-label {
  font-size: 11px;
  font-weight: 600;
  color: #007aff;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.cep-icon { font-size: 16px; flex-shrink: 0; }

.crp-text, .cep-text {
  font-size: 13px;
  color: #3c3c43;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 1px;
}

.crp-close, .cep-close {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: none;
  background: rgba(120, 120, 128, 0.12);
  color: #8e8e93;
  cursor: pointer;
  font-size: 12px;
  flex-shrink: 0;
  transition: background 0.15s;

  &:hover {
    background: rgba(255, 59, 48, 0.15);
    color: #ff3b30;
  }
}

/* INPUT */
.chat-input-row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 8px 10px;
  padding-bottom: calc(8px + env(safe-area-inset-bottom, 0));
  background: rgba(249, 250, 251, 0.95);
  backdrop-filter: blur(20px);
  border-top: 0.5px solid rgba(60, 60, 67, 0.15);
  flex-shrink: 0;
}

.chat-input {
  flex: 1;
  min-height: 34px;
  max-height: 120px;
  padding: 8px 14px;
  border-radius: 18px;
  border: 0.5px solid rgba(60, 60, 67, 0.2);
  background: #ffffff;
  color: #000;
  font-family: -apple-system, "SF Pro Text", inherit;
  font-size: 15px;
  line-height: 1.3;
  resize: none;
  outline: none;
  transition: border-color 0.15s;

  &:focus {
    border-color: #007aff;
  }

  &::placeholder {
    color: #8e8e93;
    font-weight: 400;
  }
}

.chat-send {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: none;
  background: #007aff;
  color: #ffffff;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: opacity 0.2s, transform 0.15s;

  &:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  &:not(:disabled):hover {
    background: #0066cc;
    transform: scale(1.05);
  }

  &:not(:disabled):active { transform: scale(0.94); }
}

.chat-input-btn {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: transform 0.15s, background 0.15s;
}

.chat-input-btn-accept {
  background: #34c759;
  color: #ffffff;

  &:hover {
    background: #2eb14e;
    transform: scale(1.05);
  }
}

/* Анимация панели */
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

/* КОНТЕКСТНОЕ МЕНЮ */
.ctx-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.05);
}

.ctx-menu {
  position: absolute;
  min-width: 180px;
  padding: 6px;
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border-radius: 14px;
  box-shadow:
    0 12px 40px -8px rgba(15, 23, 42, 0.3),
    0 4px 12px -4px rgba(15, 23, 42, 0.15);
  border: 0.5px solid rgba(60, 60, 67, 0.15);
  overflow: hidden;
}

.ctx-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  background: transparent;
  color: #000;
  font-family: -apple-system, "SF Pro Text", inherit;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border-radius: 8px;
  text-align: left;
  transition: background 0.12s;

  &:hover {
    background: rgba(0, 122, 255, 0.1);
    color: #007aff;
  }

  &.danger {
    color: #ff3b30;

    &:hover {
      background: rgba(255, 59, 48, 0.1);
    }
  }
}

.ctx-icon {
  font-size: 15px;
  width: 20px;
  text-align: center;
  flex-shrink: 0;
}

.ctx-label { flex: 1; }

.ctx-menu-enter-active,
.ctx-menu-leave-active {
  transition: opacity 0.15s ease, transform 0.18s cubic-bezier(.34,1.56,.64,1);
}

.ctx-menu-enter-from,
.ctx-menu-leave-to {
  opacity: 0;
  transform: scale(0.9);
}

/* МОБИЛЬНЫЙ — полноэкранный */
@media (max-width: 700px) {
  .chat-fab {
    right: 16px;
    bottom: calc(84px + env(safe-area-inset-bottom, 0));
    width: 52px;
    height: 52px;
  }

  .chat-panel {
    right: 0;
    left: 0;
    bottom: 0;
    top: 0;
    width: 100%;
    max-width: 100%;
    height: 100%;
    max-height: 100%;
    margin-bottom: 0;
    border-radius: 0;
    border: none;
  }

  .chat-head {
    padding-top: calc(10px + env(safe-area-inset-top, 0));
  }

  .chat-body {
    padding: 10px 12px;
  }

  .chat-msg {
    max-width: 82%;
  }

  .chat-bubble {
    font-size: 15.5px;
  }

  .chat-input-row {
    padding-bottom: calc(10px + env(safe-area-inset-bottom, 0));
  }
}
</style>