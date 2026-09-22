<script setup>
import { computed } from 'vue';
import { useAuthStore } from '@/stores/auth';
import Modal from '@/components/ui/Modal.vue';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  owner: { type: String, default: '' },
});
const emit = defineEmits(['update:modelValue', 'logout']);

const auth = useAuthStore();

const emoji = computed(() => props.owner === 'Сергей' ? '👨' : '👩');
const isCurrentUser = computed(() => auth.user === props.owner);

function close() {
  emit('update:modelValue', false);
}

function handleLogout() {
  if (!confirm('Выйти из аккаунта?')) return;
  close();
  emit('logout');
}

function handleSwitch() {
  if (isCurrentUser.value) return;
  if (!confirm(`Переключиться на ${props.owner}? Текущая сессия завершится.`)) return;
  close();
  emit('logout');
}
</script>

<template>
  <Modal
    :model-value="modelValue"
    title="👤 Пользователь"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="user-menu">
      <!-- Шапка -->
      <div class="um-head">
        <div class="um-avatar">{{ emoji }}</div>
        <div class="um-info">
          <div class="um-name">{{ owner }}</div>
          <div class="um-role">
            {{ isCurrentUser ? 'Текущий пользователь' : 'Другой пользователь' }}
          </div>
        </div>
      </div>

      <!-- Пункты меню -->
      <div class="um-list">
        <button
          class="um-item"
          type="button"
          :disabled="isCurrentUser"
          @click="handleSwitch"
        >
          <span class="um-icon">🔄</span>
          <span class="um-label">Переключиться на {{ owner }}</span>
          <span v-if="isCurrentUser" class="um-badge">текущий</span>
        </button>

        <button class="um-item" type="button" disabled>
          <span class="um-icon">👤</span>
          <span class="um-label">Профиль</span>
          <span class="um-badge">в разработке</span>
        </button>

        <button class="um-item" type="button" disabled>
          <span class="um-icon">🔑</span>
          <span class="um-label">Сменить PIN</span>
          <span class="um-badge">в разработке</span>
        </button>

        <button class="um-item danger" type="button" @click="handleLogout">
          <span class="um-icon">🚪</span>
          <span class="um-label">Выйти из аккаунта</span>
        </button>
      </div>
    </div>

    <template #footer>
      <button class="btn-cancel" type="button" @click="close">Закрыть</button>
    </template>
  </Modal>
</template>

<style scoped lang="scss">
.user-menu {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.um-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(56, 189, 248, 0.08), rgba(139, 92, 246, 0.06));
  border: 1px solid rgba(56, 189, 248, 0.25);
}

.um-avatar {
  font-size: 32px;
  line-height: 1;
  flex-shrink: 0;
}

.um-info {
  min-width: 0;
  flex: 1;
}

.um-name {
  font-size: 17px;
  font-weight: 800;
  color: var(--text);
}

.um-role {
  font-size: 11.5px;
  color: var(--muted);
  font-weight: 600;
  margin-top: 2px;
}

.um-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.um-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 10px;
  border: none;
  background: transparent;
  color: var(--text);
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s, color 0.15s;
  width: 100%;

  &:not(:disabled):hover {
    background: rgba(56, 189, 248, 0.1);
    color: var(--accent);
  }

  &:not(:disabled):active {
    transform: scale(0.98);
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  &.danger {
    color: #dc2626;

    &:hover {
      background: rgba(239, 68, 68, 0.1);
      color: #b91c1c;
    }
  }
}

.um-icon {
  width: 20px;
  text-align: center;
  font-size: 16px;
  flex-shrink: 0;
}

.um-label {
  flex: 1;
  min-width: 0;
}

.um-badge {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.2);
  color: var(--muted);
  white-space: nowrap;
}

.btn-cancel {
  padding: 10px 20px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: #f1f5f9;
  color: var(--text);
  font-family: inherit;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;

  &:hover { background: #e2e8f0; }
}
</style>