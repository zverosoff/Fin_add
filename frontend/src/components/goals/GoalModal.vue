<script setup>
import { ref, watch } from 'vue';
import { useGoalsStore } from '@/stores/goals';
import { useAuthStore } from '@/stores/auth';
import { useToast } from '@/composables/useToast';
import Modal from '@/components/ui/Modal.vue';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  goal: { type: Object, default: null },
});
const emit = defineEmits(['update:modelValue', 'saved']);

const goalsStore = useGoalsStore();
const auth = useAuthStore();
const toast = useToast();

const form = ref({
  name: '',
  target: '',
  owner: 'Сергей',
  emoji: '🎯',
});

const error = ref('');
const saving = ref(false);

const EMOJIS = [
  '🎯', '✈️', '🏖️', '🏔️', '🗺️', '🏝️', '🚢', '🌍',
  '🚗', '🏍️', '🚲', '🚙', '🏠', '🏡', '🏢', '🛋️',
  '🔧', '💻', '📱', '⌚', '🎮', '📺', '🎧', '📷',
  '🎓', '📚', '💼', '💰', '💎', '💍', '🏦', '🎁',
  '👶', '💒', '🎂', '🏋️', '⚽', '🩺', '🎸', '🎨',
  '📸', '🎬', '🐶', '🐱', '⭐', '❤️', '🌈',
];

watch(() => [props.modelValue, props.goal], ([open, g]) => {
  if (!open) return;

  if (g) {
    form.value = {
      name: g.name,
      target: String(g.target),
      owner: g.owner || 'Сергей',
      emoji: g.emoji || '🎯',
    };
  } else {
    form.value = {
      name: '',
      target: '',
      owner: auth.user || 'Сергей',
      emoji: '🎯',
    };
  }
  error.value = '';
}, { immediate: true });

async function save() {
  error.value = '';

  const name = form.value.name.trim();
  const target = parseFloat(form.value.target);

  if (!name || name.length < 2) {
    error.value = 'Введите название (минимум 2 символа)';
    return;
  }
  if (!isFinite(target) || target <= 0) {
    error.value = 'Введите сумму цели больше 0';
    return;
  }

  saving.value = true;
  try {
    if (props.goal) {
      await goalsStore.update(props.goal.id, {
        name,
        target,
        owner: form.value.owner,
        emoji: form.value.emoji,
      });
      toast.success('✏️ Цель обновлена');
    } else {
      await goalsStore.add({
        name,
        target,
        owner: form.value.owner,
        emoji: form.value.emoji,
      });
      toast.success('🎯 Цель добавлена');
    }
    emit('update:modelValue', false);
    emit('saved');
  } catch (e) {
    error.value = e.response?.data?.error || e.message || 'Ошибка';
  } finally {
    saving.value = false;
  }
}

function close() {
  emit('update:modelValue', false);
}
</script>

<template>
  <Modal
    :model-value="modelValue"
    :title="goal ? '✏️ Редактировать цель' : '➕ Новая цель'"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="form">
      <div class="field">
        <label>🎯 Название</label>
        <input
          v-model="form.name"
          type="text"
          placeholder="Например, Отпуск в Турции"
          autocomplete="off"
        />
      </div>

      <div class="field">
        <label>💰 Цель, ₽</label>
        <input
          v-model="form.target"
          type="number"
          step="1000"
          min="0"
          inputmode="decimal"
          placeholder="100000"
        />
      </div>

      <div class="field">
        <label>👤 Владелец цели</label>
        <select v-model="form.owner">
          <option value="Сергей">👨 Сергей</option>
          <option value="Саша">👩 Саша</option>
        </select>
      </div>

      <div class="field">
        <label>🎨 Иконка</label>
        <div class="emoji-picker">
          <button
            v-for="e in EMOJIS"
            :key="e"
            type="button"
            :class="{ active: form.emoji === e }"
            @click="form.emoji = e"
          >{{ e }}</button>
        </div>
      </div>

      <div v-if="error" class="error-msg">{{ error }}</div>
    </div>

    <template #footer>
      <button class="btn-cancel" @click="close">Отмена</button>
      <button class="btn-save" :disabled="saving" @click="save">
        {{ saving ? 'Сохранение…' : '💾 Сохранить' }}
      </button>
    </template>
  </Modal>
</template>

<style scoped lang="scss">
.form { display: flex; flex-direction: column; gap: 12px; }

.field {
  display: flex;
  flex-direction: column;
  gap: 5px;

  label {
    font-size: 11px;
    font-weight: 700;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  input, select {
    padding: 9px 12px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--panel-2);
    color: var(--text);
    font-family: inherit;
    font-size: 14px;
    outline: none;
    width: 100%;
    transition: border-color 0.15s, box-shadow 0.15s, background 0.3s ease;

    &:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.15);
    }
    &::placeholder { color: var(--muted); opacity: 0.6; }
  }
}

.emoji-picker {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
  max-height: 180px;
  overflow-y: auto;
  padding: 4px;
  border-radius: 10px;
  background: var(--panel-2);
  border: 1px solid var(--border);

  button {
    width: 38px;
    height: 38px;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: var(--panel-solid);
    font-size: 18px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: all 0.15s;

    &:hover {
      border-color: var(--accent);
      transform: scale(1.08);
    }
    &.active {
      background: var(--grad-primary);
      border-color: transparent;
      transform: scale(1.06);
      box-shadow: 0 4px 12px -4px rgba(139, 92, 246, 0.6);
    }
  }
}

.error-msg {
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(244, 63, 94, 0.1);
  border: 1px solid rgba(244, 63, 94, 0.3);
  color: var(--danger);
  font-size: 12.5px;
  font-weight: 600;
}

.btn-cancel, .btn-save {
  padding: 10px 20px;
  border-radius: 10px;
  font-family: inherit;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  border: 1px solid transparent;
}

.btn-cancel {
  background: var(--panel-2);
  color: var(--text);
  border-color: var(--border);
  transition: all 0.15s;
  &:hover { border-color: var(--border-strong); }
}

.btn-save {
  background: var(--grad-primary);
  color: #fff;
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.3) inset,
    0 -2px 0 rgba(0, 0, 0, 0.15) inset,
    0 6px 18px -6px rgba(139, 92, 246, 0.7);
  transition: all 0.15s;

  &:disabled { opacity: 0.5; cursor: wait; }
  &:not(:disabled):hover {
    transform: translateY(-1px);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.3) inset,
      0 -2px 0 rgba(0, 0, 0, 0.15) inset,
      0 10px 24px -6px rgba(139, 92, 246, 0.9);
  }
}
</style>