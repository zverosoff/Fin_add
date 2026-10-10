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

// ✅ PNG-иконки
const ICON_USER     = '/img/icons/ui/user.png';
const ICON_SWITCH   = '/img/icons/ui/switch.png';
const ICON_KEY      = '/img/icons/ui/key.png';
const ICON_LOGOUT   = '/img/icons/ui/logout.png';
const AVATAR_MAN    = '/img/icons/mascots/avatar-man.png';
const AVATAR_WOMAN  = '/img/icons/mascots/avatar-woman.png';

const avatar = computed(() =>
  props.owner === 'Сергей' ? AVATAR_MAN : AVATAR_WOMAN
);
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
    <template #header>
      <div class="modal-head-custom">
        <img :src="ICON_USER" class="mhc-icon" alt="Пользователь" />
        <h3 class="mhc-title">Пользователь</h3>
      </div>
    </template>

    <div class="user-menu">
      <div class="um-head">
        <img :src="avatar" class="um-avatar-img" :alt="owner" />
        <div class="um-info">
          <div class="um-name">{{ owner }}</div>
          <div class="um-role">
            {{ isCurrentUser ? 'Текущий пользователь' : 'Другой пользователь' }}
          </div>
        </div>
      </div>

      <div class="um-list">
        <button
          class="um-item"
          type="button"
          :disabled="isCurrentUser"
          @click="handleSwitch"
        >
          <img :src="ICON_SWITCH" class="um-icon-img" alt="" />
          <span class="um-label">Переключиться на {{ owner }}</span>
          <span v-if="isCurrentUser" class="um-badge">текущий</span>
        </button>

        <button class="um-item" type="button" disabled>
          <img :src="ICON_USER" class="um-icon-img" alt="" />
          <span class="um-label">Профиль</span>
          <span class="um-badge">в разработке</span>
        </button>

        <button class="um-item" type="button" disabled>
          <img :src="ICON_KEY" class="um-icon-img" alt="" />
          <span class="um-label">Сменить PIN</span>
          <span class="um-badge">в разработке</span>
        </button>

        <button class="um-item danger" type="button" @click="handleLogout">
          <img :src="ICON_LOGOUT" class="um-icon-img" alt="" />
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
/* ✅ Кастомный заголовок */
.modal-head-custom {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.mhc-icon {
  display: block;
  width: 26px;
  height: 26px;
  min-width: 26px;
  max-width: 26px;
  max-height: 26px;
  object-fit: contain;
  flex-shrink: 0;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
}

.mhc-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

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

/* ✅ PNG-аватар — фикс 44×44 */
.um-avatar-img {
  display: block;
  width: 44px;
  height: 44px;
  min-width: 44px;
  max-width: 44px;
  max-height: 44px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  border: 2px solid rgba(139, 92, 246, 0.4);
  background: #fff;
  box-shadow: 0 4px 10px -2px rgba(99, 102, 241, 0.35);
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

/* ✅ PNG-иконка внутри пункта — фикс 20×20 */
.um-icon-img {
  display: block;
  width: 20px;
  height: 20px;
  min-width: 20px;
  max-width: 20px;
  max-height: 20px;
  object-fit: contain;
  flex-shrink: 0;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.15));
  transition: filter 0.15s;
}

.um-item:not(:disabled):hover .um-icon-img {
  filter: drop-shadow(0 0 6px rgba(56, 189, 248, 0.5)) brightness(1.15);
}

.um-item.danger:hover .um-icon-img {
  filter: drop-shadow(0 0 6px rgba(239, 68, 68, 0.6)) brightness(1.15);
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

@media (max-width: 700px) {
  .um-head { padding: 12px 14px; }

  .um-avatar-img {
    width: 38px;
    height: 38px;
    min-width: 38px;
    max-width: 38px;
    max-height: 38px;
  }

  .um-name { font-size: 15px; }

  .um-item {
    padding: 12px 12px;
    font-size: 13.5px;
    gap: 10px;
  }

  .um-icon-img {
    width: 18px;
    height: 18px;
    min-width: 18px;
    max-width: 18px;
    max-height: 18px;
  }

  .um-badge { font-size: 9px; padding: 2px 6px; }

  .mhc-icon {
    width: 22px;
    height: 22px;
    min-width: 22px;
    max-width: 22px;
    max-height: 22px;
  }
  .mhc-title { font-size: 15px; }
}
</style>