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
import { fmt } from '@/composables/useFormat';

const messages = useMessagesStore();
const auth = useAuthStore();
const toast = useToast();

const open = ref(false);
const text = ref('');
const sending = ref(false);
const scrollEl = ref(null);
const inputEl = ref(null);

const me = computed(() => auth.user || 'Сергей');
const peer = computed(() => messages.myPeer());
const peerEmoji = computed(() => peer.value === 'Сергей' ? '👨' : '👩');
const peerOnline = computed(() => messages.isOnline(peer.value));

const history = computed(() => messages.messagesWith(peer.value));
const totalUnread = computed(() => messages.totalUnread);

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
    // Мгновенно помечаем всё прочитанным
    try {
      await messages.markAllRead(peer.value);
      await updateBadge(messages.totalUnread);
    } catch (e) {
      console.warn('[chat] markAllRead:', e);
    }
  } else {
    document.body.dataset.chatOpen = 'false';
  }
}

async function ensureHistory() {
  if (!messages.loaded) {
    try {
      await messages.loadConversations();
    } catch (e) {
      console.warn('[chat] loadConversations:', e);
    }
  }
  try {
    await messages.loadHistory(peer.value);
  } catch (e) {
    console.warn('[chat] loadHistory:', e);
  }
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
    await messages.send(peer.value, clean);
    text.value = '';
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
    close();
  }
}

// ============================================================
// Скролл
// ============================================================
function scrollToBottom() {
  if (scrollEl.value) {
    scrollEl.value.scrollTop = scrollEl.value.scrollHeight;
  }
}

watch(history, () => {
  if (open.value) {
    nextTick(() => scrollToBottom());
  }
});

// ============================================================
// Время
// ============================================================
function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
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
// PWA — запрос разрешения при первом открытии
// ============================================================
async function askNotifications() {
  const cur = getPermission();
  if (cur === 'default') {
    const res = await requestPermission();
    if (res === 'granted') {
      toast.success('🔔 Уведомления включены');
    } else if (res === 'denied') {
      toast.info('Уведомления отключены в браузере');
    }
  }
}

onMounted(async () => {
  // Пытаемся загрузить unread при старте
  try {
    await messages.loadUnread();
    await updateBadge(messages.totalUnread);
  } catch (e) {
    console.warn('[chat] loadUnread:', e);
  }
});

onUnmounted(() => {
  document.body.dataset.chatOpen = 'false';
});

watch(totalUnread, (n) => {
  updateBadge(n);
});

// Показываем разрешение при первом открытии чата
watch(open, (v) => {
  if (v) askNotifications();
});
</script>

<template>
  <!-- Плавающая кнопка -->
  <button
    class="chat-fab"
    :class="{ open, 'has-unread': totalUnread > 0 }"
    type="button"
    @click="toggle"
    :aria-label="open ? 'Закрыть чат' : 'Открыть чат'"
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
      <!-- Заголовок -->
      <div class="chat-head">
        <div class="chat-head-user">
          <div class="chat-avatar" :class="{ online: peerOnline }">
            {{ peerEmoji }}
          </div>
          <div class="chat-user-info">
            <div class="chat-user-name">{{ peer }}</div>
            <div class="chat-user-status" :class="{ online: peerOnline }">
              <span class="status-dot"></span>
              {{ peerOnline ? 'в сети' : 'офлайн' }}
            </div>
          </div>
        </div>
        <button class="chat-close" @click="close" title="Закрыть">✕</button>
      </div>

      <!-- Сообщения -->
      <div ref="scrollEl" class="chat-body">
        <div v-if="history.length === 0" class="chat-empty">
          <div class="chat-empty-icon">💬</div>
          <div class="chat-empty-text">
            Пока нет сообщений с {{ peer }}
          </div>
          <div class="chat-empty-hint">
            Напиши первым!
          </div>
        </div>

        <template v-else>
          <template v-for="(m, i) in history" :key="m.id">
            <!-- Разделитель дня -->
            <div
              v-if="i === 0 || !isSameDay(history[i - 1].createdAt, m.createdAt)"
              class="chat-day"
            >
              {{ fmtDay(m.createdAt) }}
            </div>

            <!-- Сообщение -->
            <div
              class="chat-msg"
              :class="m.from === me ? 'out' : 'in'"
            >
              <div class="chat-bubble">
                <div class="chat-text">{{ m.text }}</div>
                <div class="chat-meta">
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

      <!-- Ввод -->
      <div class="chat-input-row">
        <textarea
          ref="inputEl"
          v-model="text"
          class="chat-input"
          placeholder="Написать сообщение…"
          rows="1"
          @keydown="onKeydown"
        />
        <button
          class="chat-send"
          :disabled="!text.trim() || sending"
          @click="send"
          :title="'Отправить'"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
            <path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped lang="scss">
/* ============================================================
   Плавающая кнопка
   ============================================================ */
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
  transition: transform 0.2s cubic-bezier(.34,1.56,.64,1), background 0.25s;

  &:hover {
    transform: scale(1.08);
    box-shadow:
      0 14px 34px -8px rgba(99, 102, 241, 0.8),
      0 4px 12px -4px rgba(15, 23, 42, 0.15);
  }

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

.chat-fab-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

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

/* ============================================================
   Панель чата
   ============================================================ */
.chat-panel {
  position: fixed;
  right: 20px;
  bottom: calc(90px + env(safe-area-inset-bottom, 0));
  z-index: 940;
  width: 380px;
  max-width: calc(100vw - 32px);
  height: 520px;
  max-height: calc(100vh - 200px);

  background: #ffffff;
  border-radius: 20px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  box-shadow:
    0 30px 70px -20px rgba(15, 23, 42, 0.3),
    0 10px 30px -10px rgba(15, 23, 42, 0.15),
    0 2px 8px -2px rgba(15, 23, 42, 0.06);

  display: flex;
  flex-direction: column;
  overflow: hidden;
  margin-bottom: 72px;   /* над FAB */
}

/* Заголовок */
.chat-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 16px;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.06), rgba(139, 92, 246, 0.05));
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.chat-head-user {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.chat-avatar {
  position: relative;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(139, 92, 246, 0.15));
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
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #22c55e;
    border: 2px solid #ffffff;
    box-shadow: 0 0 0 1px rgba(34, 197, 94, 0.4);
  }
}

.chat-user-info {
  min-width: 0;
}

.chat-user-name {
  font-size: 14px;
  font-weight: 800;
  color: var(--text);
  line-height: 1.2;
}

.chat-user-status {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--muted);
  font-weight: 600;
  margin-top: 2px;

  &.online { color: #16a34a; }
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #cbd5e1;

  .chat-user-status.online & { background: #22c55e; }
}

.chat-close {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: #f8fafc;
  color: var(--muted);
  cursor: pointer;
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.15s;

  &:hover {
    border-color: var(--danger);
    color: var(--danger);
    background: rgba(239, 68, 68, 0.08);
  }
}

/* Сообщения */
.chat-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  background:
    radial-gradient(circle at 10% 0%, rgba(59, 130, 246, 0.04), transparent 50%),
    radial-gradient(circle at 90% 100%, rgba(139, 92, 246, 0.04), transparent 50%),
    #fafbff;
}

.chat-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px 20px;
  color: var(--muted);
  text-align: center;
}

.chat-empty-icon { font-size: 42px; opacity: 0.5; }
.chat-empty-text { font-size: 13px; font-weight: 600; }
.chat-empty-hint { font-size: 11.5px; opacity: 0.8; }

.chat-day {
  align-self: center;
  padding: 3px 12px;
  margin: 8px 0 4px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.15);
  color: var(--muted);
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.chat-msg {
  display: flex;
  max-width: 80%;

  &.in {
    align-self: flex-start;

    .chat-bubble {
      background: #ffffff;
      color: var(--text);
      border: 1px solid var(--border);
      border-bottom-left-radius: 4px;
    }

    .chat-meta { color: var(--muted); }
  }

  &.out {
    align-self: flex-end;
    flex-direction: row-reverse;

    .chat-bubble {
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      color: #ffffff;
      border-bottom-right-radius: 4px;
      box-shadow: 0 6px 16px -8px rgba(99, 102, 241, 0.6);
    }

    .chat-meta { color: rgba(255, 255, 255, 0.85); }
  }
}

.chat-bubble {
  padding: 8px 12px 6px;
  border-radius: 16px;
  max-width: 100%;
  word-wrap: break-word;
  overflow-wrap: anywhere;
  font-size: 13.5px;
  line-height: 1.4;
}

.chat-text {
  white-space: pre-wrap;
}

.chat-meta {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  font-size: 10px;
  font-weight: 600;
  margin-top: 2px;
}

.chat-time {
  font-family: var(--mono);
  opacity: 0.9;
}

.chat-read {
  font-size: 11px;
  opacity: 0.7;

  &.read { opacity: 1; }
}

/* Ввод */
.chat-input-row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 10px 12px;
  background: #ffffff;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}

.chat-input {
  flex: 1;
  min-height: 38px;
  max-height: 120px;
  padding: 10px 14px;
  border-radius: 20px;
  border: 1px solid var(--border);
  background: #f8fafc;
  color: var(--text);
  font-family: inherit;
  font-size: 13.5px;
  line-height: 1.4;
  resize: none;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;

  &:focus {
    border-color: #8b5cf6;
    background: #ffffff;
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.15);
  }

  &::placeholder {
    color: var(--muted);
    font-weight: 500;
  }
}

.chat-send {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  color: #ffffff;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 6px 16px -6px rgba(99, 102, 241, 0.7);
  transition: transform 0.15s, box-shadow 0.2s, opacity 0.2s;

  &:disabled {
    opacity: 0.35;
    cursor: not-allowed;
    box-shadow: none;
  }

  &:not(:disabled):hover {
    transform: scale(1.06);
    box-shadow: 0 8px 20px -6px rgba(99, 102, 241, 0.9);
  }

  &:not(:disabled):active { transform: scale(0.94); }
}

/* Анимация панели */
.chat-panel-enter-active,
.chat-panel-leave-active {
  transition:
    opacity 0.22s ease,
    transform 0.28s cubic-bezier(.34,1.56,.64,1);
}

.chat-panel-enter-from,
.chat-panel-leave-to {
  opacity: 0;
  transform: translateY(20px) scale(0.94);
  transform-origin: bottom right;
}

/* ============================================================
   МОБИЛЬНЫЙ — чат раскрывается на весь экран
   ============================================================ */
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
    padding: 12px 14px;
    padding-top: calc(12px + env(safe-area-inset-top, 0));
  }

  .chat-body {
    padding: 10px 12px;
    padding-bottom: 12px;
  }

  .chat-input-row {
    padding: 10px 12px;
    padding-bottom: calc(10px + env(safe-area-inset-bottom, 0));
  }

  .chat-msg { max-width: 85%; }
  .chat-bubble { font-size: 14px; }
}
</style>