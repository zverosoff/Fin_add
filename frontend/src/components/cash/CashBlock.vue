<script setup>
import { computed, ref, watch } from 'vue';
import { useCashStore } from '@/stores/cash';
import { useAuthStore } from '@/stores/auth';
import { useToast } from '@/composables/useToast';
import { fmt } from '@/composables/useFormat';
import Modal from '@/components/ui/Modal.vue';

const cash = useCashStore();
const auth = useAuthStore();
const toast = useToast();

// Состояние модалок
const depositOpen = ref(false);
const withdrawOpen = ref(false);

// Формы
const depositForm = ref({ user: '', amount: '', note: '' });
const withdrawForm = ref({ user: '', amount: '', note: '' });

watch(depositOpen, (open) => {
  if (open) {
    depositForm.value = {
      user: auth.user || 'Сергей',
      amount: '',
      note: '',
    };
  }
});

watch(withdrawOpen, (open) => {
  if (open) {
    withdrawForm.value = {
      user: auth.user || 'Сергей',
      amount: '',
      note: '',
    };
  }
});

// Разбивка по пользователям
const contributors = computed(() =>
  Object.entries(cash.contributions || {})
    .filter(([_, v]) => Number(v) > 0)
    .map(([user, value]) => ({
      user,
      value: Number(value),
      emoji: user === 'Сергей' ? '👨' : '👩',
      cls: user === 'Сергей' ? 'sergey' : 'sasha',
    }))
);

// История
const history = computed(() => (cash.history || []).slice(0, 10));

async function submitDeposit() {
  const { user, amount, note } = depositForm.value;
  const num = parseFloat(amount);

  if (!user) return toast.error('Выберите пользователя');
  if (!isFinite(num) || num <= 0) return toast.error('Введите сумму больше 0');

  try {
    await cash.deposit(user, num, note);
    toast.success(`💰 ${user} внёс ${fmt(num)} ₽`);
    depositOpen.value = false;
  } catch (e) {
    toast.error('Ошибка: ' + e.message);
  }
}

async function submitWithdraw() {
  const { user, amount, note } = withdrawForm.value;
  const num = parseFloat(amount);

  if (!user) return toast.error('Выберите пользователя');
  if (!isFinite(num) || num <= 0) return toast.error('Введите сумму больше 0');

  const available = Number(cash.contributions?.[user]) || 0;
  if (num > available) {
    return toast.error(`У ${user} только ${fmt(available)} ₽`);
  }

  try {
    await cash.withdraw(user, num, note);
    toast.success(`💸 ${user} изъял ${fmt(num)} ₽`);
    withdrawOpen.value = false;
  } catch (e) {
    toast.error('Ошибка: ' + e.message);
  }
}

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
</script>

<template>
  <div class="cash-card">
    <!-- Шапка -->
    <div class="cash-head">
      <span class="cash-emoji">💵</span>
      <span class="cash-title">Наличные</span>
      <span class="cash-total">{{ fmt(cash.total) }} ₽</span>
    </div>

    <!-- Итог -->
    <div class="cash-progress">
      <span class="cash-current">{{ fmt(cash.total) }} ₽</span>
      <span class="cash-hint">на руках</span>
    </div>

    <!-- Кнопки -->
    <div class="cash-actions">
      <button
        class="cash-btn income"
        type="button"
        @click="depositOpen = true"
      >
        + Внести
      </button>
      <button
        class="cash-btn expense"
        type="button"
        :disabled="cash.total <= 0"
        @click="withdrawOpen = true"
      >
        − Изъять
      </button>
    </div>

    <!-- Разбивка по пользователям -->
    <div v-if="contributors.length > 0" class="cash-contribs">
      <span
        v-for="c in contributors"
        :key="c.user"
        class="cash-contrib"
        :class="c.cls"
      >
        <span class="avatar">{{ c.emoji }}</span>
        <span class="name">{{ c.user }}</span>
        <span class="amount">{{ fmt(c.value) }} ₽</span>
      </span>
    </div>
    <div v-else class="cash-empty">
      <span class="emoji">🪙</span>
      <span class="text">Наличных пока нет</span>
    </div>

    <!-- История -->
    <div v-if="history.length > 0" class="cash-history">
      <div class="cash-history-title">🕓 Последние операции</div>
      <div
        v-for="(h, i) in history"
        :key="i"
        class="cash-history-row"
        :class="h.type"
      >
        <span class="ch-type">{{ h.type === 'deposit' ? '📥' : '📤' }}</span>
        <span class="ch-user">{{ h.user }}</span>
        <span class="ch-amount">
          {{ h.type === 'deposit' ? '+' : '−' }}{{ fmt(h.amount) }} ₽
        </span>
        <span class="ch-time">{{ formatTime(h.date) }}</span>
      </div>
    </div>

    <!-- ============================================================
         МОДАЛКА: ВНЕСТИ
         ============================================================ -->
    <Modal
      v-model="depositOpen"
      title="💰 Внести наличные"
    >
      <div class="cash-form">
        <div class="cf-field">
          <label>👤 Кто вносит</label>
          <select v-model="depositForm.user">
            <option value="Сергей">👨 Сергей</option>
            <option value="Саша">👩 Саша</option>
          </select>
        </div>

        <div class="cf-field">
          <label>💵 Сумма, ₽</label>
          <input
            v-model="depositForm.amount"
            type="number"
            step="100"
            min="0"
            inputmode="decimal"
            placeholder="1000"
          />
        </div>

        <div class="cf-field">
          <label>📝 Комментарий (опционально)</label>
          <input
            v-model="depositForm.note"
            type="text"
            placeholder="Например, снял с карты"
          />
        </div>
      </div>

      <template #footer>
        <button class="cf-btn cancel" @click="depositOpen = false">Отмена</button>
        <button class="cf-btn save" @click="submitDeposit">💰 Внести</button>
      </template>
    </Modal>

    <!-- ============================================================
         МОДАЛКА: ИЗЪЯТЬ
         ============================================================ -->
    <Modal
      v-model="withdrawOpen"
      title="💸 Изъять наличные"
    >
      <div class="cash-form">
        <div class="cf-field">
          <label>👤 Кто забирает</label>
          <select v-model="withdrawForm.user">
            <option value="Сергей">👨 Сергей</option>
            <option value="Саша">👩 Саша</option>
          </select>
        </div>

        <div class="cf-field">
          <label>💵 Сумма, ₽</label>
          <input
            v-model="withdrawForm.amount"
            type="number"
            step="100"
            min="0"
            inputmode="decimal"
            placeholder="500"
          />
        </div>

        <div class="cf-field">
          <label>📝 Комментарий (опционально)</label>
          <input
            v-model="withdrawForm.note"
            type="text"
            placeholder="Например, потратил на продукты"
          />
        </div>

        <div class="cf-hint">
          У {{ withdrawForm.user }} сейчас:
          <strong>{{ fmt(cash.contributions?.[withdrawForm.user] || 0) }} ₽</strong>
        </div>
      </div>

      <template #footer>
        <button class="cf-btn cancel" @click="withdrawOpen = false">Отмена</button>
        <button class="cf-btn save danger" @click="submitWithdraw">💸 Изъять</button>
      </template>
    </Modal>
  </div>
</template>

<style scoped lang="scss">
.cash-card {
  padding: 14px 16px;
  background: #ffffff;
  border: 1px solid var(--border);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: transform 0.15s, box-shadow 0.2s;
  min-width: 0;

  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
  }
}

.cash-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cash-emoji {
  font-size: 22px;
  line-height: 1;
  flex-shrink: 0;
}

.cash-title {
  flex: 1;
  font-size: 14px;
  font-weight: 800;
  color: var(--text);
}

.cash-total {
  font-family: var(--mono);
  font-size: 13px;
  font-weight: 800;
  color: #16a34a;
  white-space: nowrap;
  flex-shrink: 0;
  padding: 3px 10px;
  border-radius: 999px;
  background: rgba(34, 197, 94, 0.12);
}

.cash-progress {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.cash-current {
  font-family: var(--mono);
  font-size: 20px;
  font-weight: 800;
  color: #16a34a;
  letter-spacing: -0.02em;
}

.cash-hint {
  font-size: 11px;
  color: var(--muted);
  font-weight: 600;
}

.cash-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.cash-btn {
  flex: 1;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: transparent;
  font-family: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;

  &.income {
    color: #16a34a;
    border-color: rgba(34, 197, 94, 0.3);
    background: rgba(34, 197, 94, 0.06);

    &:hover {
      background: rgba(34, 197, 94, 0.15);
      transform: translateY(-1px);
    }
  }

  &.expense {
    color: #dc2626;
    border-color: rgba(239, 68, 68, 0.3);
    background: rgba(239, 68, 68, 0.04);

    &:hover:not(:disabled) {
      background: rgba(239, 68, 68, 0.12);
      transform: translateY(-1px);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
}

.cash-contribs {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  padding-top: 8px;
  border-top: 1px dashed var(--border);
}

.cash-contrib {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 9px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  border: 1px solid var(--border);
  background: rgba(148, 163, 184, 0.1);

  .name { color: var(--muted); font-weight: 600; }
  .amount {
    font-family: var(--mono);
    font-weight: 800;
    color: var(--text);
  }

  &.sergey {
    background: rgba(59, 130, 246, 0.08);
    border-color: rgba(59, 130, 246, 0.25);
    .amount { color: #2563eb; }
  }
  &.sasha {
    background: rgba(236, 72, 153, 0.08);
    border-color: rgba(236, 72, 153, 0.25);
    .amount { color: #db2777; }
  }
}

.cash-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(148, 163, 184, 0.08);
  color: var(--muted);
  font-size: 11.5px;
  font-style: italic;

  .emoji { font-style: normal; }
}

.cash-history {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-top: 8px;
  border-top: 1px dashed var(--border);
}

.cash-history-title {
  font-size: 10.5px;
  font-weight: 700;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 4px;
}

.cash-history-row {
  display: grid;
  grid-template-columns: auto 1fr auto auto;
  gap: 8px;
  align-items: center;
  padding: 5px 8px;
  border-radius: 6px;
  background: rgba(148, 163, 184, 0.06);
  font-size: 11.5px;

  &.deposit .ch-amount { color: #16a34a; }
  &.withdraw .ch-amount { color: #dc2626; }
}

.ch-type { font-size: 13px; }
.ch-user { font-weight: 700; color: var(--text); }

.ch-amount {
  font-family: var(--mono);
  font-weight: 800;
}

.ch-time {
  font-size: 10px;
  color: var(--muted);
  font-family: var(--mono);
  white-space: nowrap;
}

/* Форма в модалке */
.cash-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.cf-field {
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
    background: #ffffff;
    color: var(--text);
    font-family: inherit;
    font-size: 14px;
    outline: none;
    width: 100%;

    &:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.15);
    }
  }
}

.cf-hint {
  font-size: 12px;
  color: var(--muted);
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(148, 163, 184, 0.08);
  text-align: center;

  strong {
    font-family: var(--mono);
    color: var(--text);
    font-weight: 800;
  }
}

.cf-btn {
  padding: 10px 20px;
  border-radius: 10px;
  font-family: inherit;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  border: 1px solid transparent;

  &.cancel {
    background: #f1f5f9;
    color: var(--text);
    border-color: var(--border);
  }

  &.save {
    background: linear-gradient(135deg, #22c55e, #16a34a);
    color: #fff;
    box-shadow: 0 10px 24px -10px rgba(34, 197, 94, 0.7);

    &.danger {
      background: linear-gradient(135deg, #ef4444, #dc2626);
      box-shadow: 0 10px 24px -10px rgba(239, 68, 68, 0.7);
    }
  }
}

/* Мобильный */
@media (max-width: 700px) {
  .cash-card { padding: 12px 14px; gap: 8px; border-radius: 12px; }
  .cash-emoji { font-size: 20px; }
  .cash-title { font-size: 13px; }
  .cash-total { font-size: 12px; padding: 2px 8px; }
  .cash-current { font-size: 18px; }
  .cash-btn { padding: 7px 10px; font-size: 11.5px; }
  .cash-contribs { gap: 5px; padding-top: 6px; }
  .cash-contrib { font-size: 10.5px; padding: 3px 8px; gap: 4px; }
  .cash-history-row { font-size: 11px; padding: 4px 6px; gap: 6px; }
  .ch-time { font-size: 9.5px; }
}
</style>