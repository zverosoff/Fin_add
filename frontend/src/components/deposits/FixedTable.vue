<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { api } from '@/api/client';
import { useToast } from '@/composables/useToast';
import { notifySaved, notifyError } from '@/composables/useDataStatus';
import { fmt } from '@/composables/useFormat';

const toast = useToast();

const accountStart = ref(0);
const rate = ref(0);
const incomes = ref([]);
const expenses = ref([]);

onMounted(loadFromServer);

async function loadFromServer() {
  try {
    const { data } = await api.get('/state');
    accountStart.value = Number(data.accountStart) || 0;
    rate.value = Number(data.rate) || 0;
    incomes.value = Array.isArray(data.incomes) ? data.incomes : [];
    expenses.value = Array.isArray(data.expenses) ? data.expenses : [];
    ensureLockedIncome();
  } catch (e) {
    notifyError(e.message);
  }
}

function ensureLockedIncome() {
  const idx = incomes.value.findIndex(x => x.id === 'depositIncome');
  if (idx === -1) {
    incomes.value.unshift({
      id: 'depositIncome',
      name: 'Вклад',
      value: 0,
      auto: true,
    });
  } else if (idx !== 0) {
    const [item] = incomes.value.splice(idx, 1);
    incomes.value.unshift(item);
  }
}

let saveTimer = null;
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(saveToServer, 1000);
}

async function saveToServer() {
  try {
    await api.post('/state', {
      accountStart: accountStart.value,
      rate: rate.value,
      incomes: incomes.value,
      expenses: expenses.value,
    });
    notifySaved();
  } catch (e) {
    notifyError(e.message);
  }
}

const incomeYearCredit = computed(() => accountStart.value * rate.value / 100);
const incomeMonthCredit = computed(() => incomeYearCredit.value / 12);

function syncDeposit() {
  const deposit = incomes.value.find(x => x.id === 'depositIncome');
  if (deposit) {
    deposit.value = incomeMonthCredit.value;
    deposit.auto = true;
  }
}

watch([accountStart, rate], () => {
  syncDeposit();
  scheduleSave();
});

const totalIncome = computed(() =>
  incomes.value.reduce((s, x) => s + (Number(x.value) || 0), 0)
);
const totalExpense = computed(() =>
  expenses.value.reduce((s, x) => s + (Number(x.value) || 0), 0)
);
const netIncome = computed(() => totalIncome.value - totalExpense.value);

function addIncome() {
  incomes.value.push({ id: 'row_' + Date.now(), name: 'Новый доход', value: 0 });
  scheduleSave();
}

function addExpense() {
  expenses.value.push({ id: 'row_' + Date.now(), name: 'Новый расход', value: 0 });
  scheduleSave();
}

function removeIncome(idx) {
  if (incomes.value[idx]?.id === 'depositIncome') return;
  incomes.value.splice(idx, 1);
  scheduleSave();
}

function removeExpense(idx) {
  expenses.value.splice(idx, 1);
  scheduleSave();
}

function isLocked(item) {
  return item && item.id === 'depositIncome';
}

function isSasha(name) {
  return name && /саш/i.test(name);
}

const byUser = computed(() => {
  let sergI = 0, sergE = 0, sashaI = 0, sashaE = 0;
  for (const it of incomes.value) {
    const v = Number(it.value) || 0;
    if (isSasha(it.name)) sashaI += v;
    else sergI += v;
  }
  for (const it of expenses.value) {
    const v = Number(it.value) || 0;
    if (isSasha(it.name)) sashaE += v;
    else sergE += v;
  }
  return {
    sergey: { income: sergI, expense: sergE, balance: sergI - sergE },
    sasha:  { income: sashaI, expense: sashaE, balance: sashaI - sashaE },
  };
});
</script>

<template>
  <div class="fixed-wrap">

    <!-- ============================================================
         КАРТА-ШАПКА: доход в месяц + итог
         ============================================================ -->
    <div class="summary-card">
      <div class="sc-top">
        <div class="sc-main">
          <div class="sc-label">Доход в месяц</div>
          <div class="sc-amount">{{ fmt(incomeMonthCredit) }} ₽</div>
          <div class="sc-sub">При ставке {{ rate.toFixed(1) }}% на {{ fmt(accountStart) }} ₽</div>
        </div>
        <div class="sc-graph">
          <div class="sc-graph-value">+{{ fmt(netIncome) }} ₽</div>
          <div class="sc-graph-label">Итого в месяц</div>
        </div>
      </div>

      <div class="sc-bottom">
        <div class="sc-cell">
          <div class="sc-cell-label">📈 Доходы</div>
          <div class="sc-cell-value income">+{{ fmt(totalIncome) }} ₽</div>
        </div>
        <div class="sc-divider"></div>
        <div class="sc-cell">
          <div class="sc-cell-label">📉 Расходы</div>
          <div class="sc-cell-value expense">−{{ fmt(totalExpense) }} ₽</div>
        </div>
      </div>
    </div>

    <!-- ============================================================
         ТАБЛИЦА ПРОЦЕНТОВ
         ============================================================ -->
    <div class="card">
      <h2 class="card-title">💎 Таблица прибыли от процента</h2>

      <div class="percent-grid">
        <div class="percent-field">
          <label>На счету</label>
          <input
            v-model.number="accountStart"
            type="number"
            step="0.01"
            inputmode="decimal"
          />
          <span class="percent-suffix">₽</span>
        </div>

        <div class="percent-field">
          <label>Текущий процент</label>
          <input
            v-model.number="rate"
            type="number"
            step="0.1"
            inputmode="decimal"
          />
          <span class="percent-suffix">%</span>
        </div>
      </div>

      <div class="percent-results">
        <div class="percent-result">
          <div class="pr-label">Доход в год</div>
          <div class="pr-value">{{ fmt(incomeYearCredit) }} ₽</div>
        </div>
        <div class="percent-result accent">
          <div class="pr-label">Доход в месяц</div>
          <div class="pr-value">{{ fmt(incomeMonthCredit) }} ₽</div>
        </div>
      </div>
    </div>

    <!-- ============================================================
         ДОХОДЫ И РАСХОДЫ
         ============================================================ -->
    <div class="card">
      <div class="card-head">
        <h2 class="card-title">📊 Доходы и расходы</h2>
        <div class="card-actions">
          <button class="btn-add-mini income" @click="addIncome" type="button">
            + доход
          </button>
          <button class="btn-add-mini expense" @click="addExpense" type="button">
            + расход
          </button>
        </div>
      </div>

      <div class="dt-grid">
        <!-- Доходы -->
        <div class="dt-col">
          <div class="dt-col-head">
            <span class="dt-col-icon income">📈</span>
            <span class="dt-col-title">Доходы</span>
          </div>
          <div class="dt-col-body">
            <div
              v-for="(item, idx) in incomes"
              :key="item.id"
              class="dt-row"
              :class="{ locked: isLocked(item) }"
            >
              <input
                v-model="item.name"
                type="text"
                class="dt-name"
                :readonly="isLocked(item)"
                :disabled="isLocked(item)"
                @input="scheduleSave"
              />
              <input
                v-model.number="item.value"
                type="number"
                class="dt-value"
                :readonly="isLocked(item)"
                :disabled="isLocked(item)"
                @input="scheduleSave"
              />
              <button
                v-if="!isLocked(item)"
                class="dt-del"
                @click="removeIncome(idx)"
                type="button"
                aria-label="Удалить"
              >✕</button>
              <span v-else class="dt-lock" title="Автоматически из вклада">🔒</span>
            </div>
            <div v-if="incomes.length === 0" class="dt-empty">
              Нет доходов — добавьте кнопкой «+ доход»
            </div>
          </div>
          <div class="dt-col-total income">
            Итого: <strong>+{{ fmt(totalIncome) }} ₽</strong>
          </div>
        </div>

        <!-- Расходы -->
        <div class="dt-col">
          <div class="dt-col-head">
            <span class="dt-col-icon expense">📉</span>
            <span class="dt-col-title">Расходы</span>
          </div>
          <div class="dt-col-body">
            <div
              v-for="(item, idx) in expenses"
              :key="item.id"
              class="dt-row"
            >
              <input
                v-model="item.name"
                type="text"
                class="dt-name"
                @input="scheduleSave"
              />
              <input
                v-model.number="item.value"
                type="number"
                class="dt-value"
                @input="scheduleSave"
              />
              <button
                class="dt-del"
                @click="removeExpense(idx)"
                type="button"
                aria-label="Удалить"
              >✕</button>
            </div>
            <div v-if="expenses.length === 0" class="dt-empty">
              Нет расходов — добавьте кнопкой «+ расход»
            </div>
          </div>
          <div class="dt-col-total expense">
            Итого: <strong>−{{ fmt(totalExpense) }} ₽</strong>
          </div>
        </div>
      </div>

      <div class="grand-total" :class="netIncome >= 0 ? 'positive' : 'negative'">
        <span class="gt-label">Разница (доходы − расходы)</span>
        <span class="gt-value">
          {{ netIncome >= 0 ? '+' : '−' }}{{ fmt(Math.abs(netIncome)) }} ₽
        </span>
      </div>
    </div>

    <!-- ============================================================
         ОТЧЁТ ПО ПОЛЬЗОВАТЕЛЯМ
         ============================================================ -->
    <div class="user-report">
      <h3 class="report-title">👥 Отчёт по пользователям</h3>

      <div class="user-report-grid">
        <!-- Сергей -->
        <div class="user-card sergey">
          <div class="uc-head">
            <div class="uc-avatar">👨</div>
            <div class="uc-info">
              <div class="uc-name">Сергей</div>
              <div class="uc-tag" :class="byUser.sergey.balance >= 0 ? 'positive' : 'negative'">
                {{ byUser.sergey.balance >= 0 ? 'Профицит' : 'Дефицит' }}
              </div>
            </div>
          </div>

          <div class="uc-rows">
            <div class="uc-row">
              <span class="k">📈 Доходы</span>
              <span class="v income">+{{ fmt(byUser.sergey.income) }} ₽</span>
            </div>
            <div class="uc-row">
              <span class="k">📉 Расходы</span>
              <span class="v expense">−{{ fmt(byUser.sergey.expense) }} ₽</span>
            </div>
          </div>

          <div class="uc-total" :class="byUser.sergey.balance >= 0 ? 'positive' : 'negative'">
            <span class="uc-total-label">Итого</span>
            <span class="uc-total-value">
              {{ byUser.sergey.balance >= 0 ? '+' : '−' }}{{ fmt(Math.abs(byUser.sergey.balance)) }} ₽
            </span>
          </div>
        </div>

        <!-- Саша -->
        <div class="user-card sasha">
          <div class="uc-head">
            <div class="uc-avatar">👩</div>
            <div class="uc-info">
              <div class="uc-name">Саша</div>
              <div class="uc-tag" :class="byUser.sasha.balance >= 0 ? 'positive' : 'negative'">
                {{ byUser.sasha.balance >= 0 ? 'Профицит' : 'Дефицит' }}
              </div>
            </div>
          </div>

          <div class="uc-rows">
            <div class="uc-row">
              <span class="k">📈 Доходы</span>
              <span class="v income">+{{ fmt(byUser.sasha.income) }} ₽</span>
            </div>
            <div class="uc-row">
              <span class="k">📉 Расходы</span>
              <span class="v expense">−{{ fmt(byUser.sasha.expense) }} ₽</span>
            </div>
          </div>

          <div class="uc-total" :class="byUser.sasha.balance >= 0 ? 'positive' : 'negative'">
            <span class="uc-total-label">Итого</span>
            <span class="uc-total-value">
              {{ byUser.sasha.balance >= 0 ? '+' : '−' }}{{ fmt(Math.abs(byUser.sasha.balance)) }} ₽
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.fixed-wrap {
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
  min-width: 0;
}

/* ============================================================
   КАРТА-ШАПКА
   ============================================================ */
.summary-card {
  border-radius: 22px;
  overflow: hidden;
  background:
    radial-gradient(circle at 15% 0%, rgba(255, 255, 255, 0.18), transparent 55%),
    radial-gradient(circle at 95% 100%, rgba(255, 255, 255, 0.14), transparent 60%),
    linear-gradient(135deg, #06b6d4 0%, #3b82f6 45%, #7c3aed 100%);
  color: #fff;
  box-shadow:
    0 20px 40px -18px rgba(59, 130, 246, 0.6),
    0 10px 20px -10px rgba(124, 58, 237, 0.4);
}

.sc-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 14px;
  padding: 22px 22px 18px;
}

.sc-main { min-width: 0; flex: 1; }

.sc-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  opacity: 0.75;
}

.sc-amount {
  font-size: 34px;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.1;
  margin: 4px 0 6px;
  font-family: var(--mono);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sc-sub {
  font-size: 12px;
  font-weight: 600;
  opacity: 0.85;
  line-height: 1.35;
}

.sc-graph {
  text-align: right;
  flex-shrink: 0;
}

.sc-graph-value {
  font-size: 20px;
  font-weight: 800;
  font-family: var(--mono);
  letter-spacing: -0.02em;
}

.sc-graph-label {
  font-size: 10.5px;
  font-weight: 600;
  opacity: 0.75;
  margin-top: 2px;
}

.sc-bottom {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 12px;
  padding: 14px 22px 18px;
  background: rgba(0, 0, 0, 0.15);
  backdrop-filter: blur(10px);
}

.sc-cell { min-width: 0; }
.sc-cell:last-child { text-align: right; }

.sc-cell-label {
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.75;
}

.sc-cell-value {
  font-size: 17px;
  font-weight: 800;
  font-family: var(--mono);
  letter-spacing: -0.02em;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  &.income { color: #86efac; }
  &.expense { color: #fca5a5; }
}

.sc-divider {
  width: 1px;
  height: 32px;
  background: rgba(255, 255, 255, 0.25);
}

/* ============================================================
   КАРТОЧКИ
   ============================================================ */
.card {
  padding: 18px 20px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid var(--border);
  border-radius: 18px;
  box-shadow: var(--shadow-md);
  min-width: 0;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}

.card-title {
  font-size: 12px;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 700;
  margin: 0;
}

.card-head .card-title { margin-bottom: 0; }

.card-actions {
  display: flex;
  gap: 6px;
}

.btn-add-mini {
  padding: 5px 12px;
  border-radius: 999px;
  border: 1px solid transparent;
  font-family: inherit;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;

  &.income {
    background: rgba(34, 197, 94, 0.12);
    border-color: rgba(34, 197, 94, 0.35);
    color: #16a34a;

    &:hover {
      background: rgba(34, 197, 94, 0.22);
      transform: translateY(-1px);
    }
  }

  &.expense {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.32);
    color: #dc2626;

    &:hover {
      background: rgba(239, 68, 68, 0.2);
      transform: translateY(-1px);
    }
  }
}

/* ============================================================
   ТАБЛИЦА ПРОЦЕНТОВ
   ============================================================ */
.percent-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 14px;
}

.percent-field {
  position: relative;
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

  input {
    padding: 12px 40px 12px 14px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: #ffffff;
    color: var(--text);
    font-family: var(--mono);
    font-size: 16px;
    font-weight: 700;
    outline: none;
    width: 100%;
    transition: border-color 0.15s, box-shadow 0.15s;

    &:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.15);
    }
  }

  .percent-suffix {
    position: absolute;
    right: 14px;
    bottom: 14px;
    font-family: var(--mono);
    font-size: 14px;
    font-weight: 700;
    color: var(--muted);
    pointer-events: none;
  }
}

.percent-results {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.percent-result {
  padding: 14px 16px;
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(56, 189, 248, 0.08), rgba(139, 92, 246, 0.05));
  border: 1px solid rgba(56, 189, 248, 0.2);

  &.accent {
    background: linear-gradient(135deg, #3b82f6, #7c3aed);
    border-color: transparent;
    color: #fff;
    box-shadow: 0 8px 20px -8px rgba(59, 130, 246, 0.6);

    .pr-label { color: rgba(255, 255, 255, 0.85); }
    .pr-value { color: #fff; }
  }
}

.pr-label {
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
}

.pr-value {
  font-family: var(--mono);
  font-size: 20px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--text);
  margin-top: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ============================================================
   ДОХОДЫ И РАСХОДЫ
   ============================================================ */
.dt-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.dt-col {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.dt-col-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 800;

  &.income-bg {
    background: rgba(34, 197, 94, 0.1);
  }

  .dt-col-icon.income { color: #16a34a; }
}

.dt-col-head {
  background: rgba(148, 163, 184, 0.08);
}

.dt-col-icon { font-size: 14px; }
.dt-col-title {
  font-size: 12px;
  font-weight: 800;
  color: var(--text);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.dt-col-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.dt-row {
  display: grid;
  grid-template-columns: 1fr 90px auto;
  gap: 5px;
  align-items: center;

  &.locked .dt-name,
  &.locked .dt-value {
    background: rgba(148, 163, 184, 0.08);
    color: var(--muted);
    cursor: not-allowed;
    border-style: dashed;
  }
}

.dt-name,
.dt-value {
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-family: inherit;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--text);
  outline: none;
  min-width: 0;
  width: 100%;
  background: #ffffff;
  transition: border-color 0.15s, box-shadow 0.15s;

  &:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.15);
  }
}

.dt-value {
  text-align: right;
  font-family: var(--mono);
  font-weight: 700;
  font-size: 11.5px;
}

.dt-del,
.dt-lock {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  font-size: 11px;
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

.dt-lock {
  border: none;
  font-size: 12px;
  cursor: default;
  background: transparent;

  &:hover {
    border: none;
    color: var(--muted);
    background: transparent;
  }
}

.dt-empty {
  padding: 14px;
  text-align: center;
  font-size: 12px;
  color: var(--muted);
  background: rgba(148, 163, 184, 0.06);
  border-radius: 10px;
  border: 1px dashed var(--border);
}

.dt-col-total {
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 12.5px;
  font-weight: 700;
  text-align: right;
  margin-top: 4px;

  strong {
    font-family: var(--mono);
    font-size: 15px;
    font-weight: 800;
    margin-left: 6px;
  }

  &.income {
    background: rgba(34, 197, 94, 0.1);
    border: 1px solid rgba(34, 197, 94, 0.25);
    color: #15803d;

    strong { color: #15803d; }
  }

  &.expense {
    background: rgba(239, 68, 68, 0.08);
    border: 1px solid rgba(239, 68, 68, 0.25);
    color: #dc2626;

    strong { color: #b91c1c; }
  }
}

/* Итоговая разница */
.grand-total {
  margin-top: 16px;
  padding: 14px 18px;
  border-radius: 14px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  font-weight: 700;

  &.positive {
    background: linear-gradient(135deg, rgba(34, 197, 94, 0.12), rgba(34, 197, 94, 0.06));
    border: 1px solid rgba(34, 197, 94, 0.3);

    .gt-value { color: #16a34a; }
  }

  &.negative {
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(239, 68, 68, 0.06));
    border: 1px solid rgba(239, 68, 68, 0.3);

    .gt-value { color: #dc2626; }
  }
}

.gt-label {
  font-size: 12.5px;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.gt-value {
  font-family: var(--mono);
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.02em;
}

/* ============================================================
   ОТЧЁТ ПО ПОЛЬЗОВАТЕЛЯМ
   ============================================================ */
.user-report {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.report-title {
  font-size: 12px;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 700;
  margin: 0;
  padding: 0 4px;
}

.user-report-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.user-card {
  padding: 16px 18px;
  border-radius: 18px;
  border: 1px solid var(--border);
  background: #ffffff;
  display: flex;
  flex-direction: column;
  gap: 12px;

  &.sergey {
    background:
      radial-gradient(circle at 15% 0%, rgba(59, 130, 246, 0.08), transparent 60%),
      #ffffff;
    border-color: rgba(59, 130, 246, 0.2);
  }

  &.sasha {
    background:
      radial-gradient(circle at 15% 0%, rgba(236, 72, 153, 0.08), transparent 60%),
      #ffffff;
    border-color: rgba(236, 72, 153, 0.2);
  }
}

.uc-head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.uc-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  flex-shrink: 0;

  .sergey & {
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(139, 92, 246, 0.15));
    border: 1.5px solid rgba(59, 130, 246, 0.35);
  }

  .sasha & {
    background: linear-gradient(135deg, rgba(236, 72, 153, 0.2), rgba(245, 158, 11, 0.15));
    border: 1.5px solid rgba(236, 72, 153, 0.35);
  }
}

.uc-info { min-width: 0; flex: 1; }

.uc-name {
  font-size: 15px;
  font-weight: 800;
  color: var(--text);
}

.uc-tag {
  display: inline-block;
  margin-top: 2px;
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;

  &.positive {
    background: rgba(34, 197, 94, 0.15);
    color: #16a34a;
  }
  &.negative {
    background: rgba(239, 68, 68, 0.12);
    color: #dc2626;
  }
}

.uc-rows {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.uc-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  border-radius: 10px;
  background: rgba(148, 163, 184, 0.06);
  font-size: 12.5px;

  .k { color: var(--muted); font-weight: 600; }

  .v {
    font-family: var(--mono);
    font-weight: 800;

    &.income { color: #16a34a; }
    &.expense { color: #dc2626; }
  }
}

.uc-total {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  border-radius: 12px;

  &.positive {
    background: linear-gradient(135deg, rgba(34, 197, 94, 0.12), rgba(34, 197, 94, 0.06));
    .uc-total-value { color: #16a34a; }
  }

  &.negative {
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(239, 68, 68, 0.06));
    .uc-total-value { color: #dc2626; }
  }
}

.uc-total-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.uc-total-value {
  font-family: var(--mono);
  font-size: 18px;
  font-weight: 800;
  letter-spacing: -0.02em;
}

/* ============================================================
   МОБИЛЬНЫЙ
   ============================================================ */
@media (max-width: 700px) {
  .sc-top { padding: 18px 18px 14px; gap: 10px; }
  .sc-amount { font-size: 28px; }
  .sc-sub { font-size: 11px; }
  .sc-graph-value { font-size: 16px; }
  .sc-graph-label { font-size: 9.5px; }
  .sc-bottom { padding: 12px 18px 14px; gap: 8px; }
  .sc-cell-value { font-size: 15px; }

  .card { padding: 14px 16px; border-radius: 16px; }

  .percent-grid { grid-template-columns: 1fr; gap: 10px; }
  .percent-results { grid-template-columns: 1fr 1fr; gap: 10px; }
  .pr-value { font-size: 17px; }

  .dt-grid { grid-template-columns: 1fr; gap: 14px; }
  .dt-row { grid-template-columns: 1fr 90px auto; }

  .user-report-grid { grid-template-columns: 1fr; }
  .uc-total-value { font-size: 16px; }
  .gt-value { font-size: 18px; }
}

@media (max-width: 400px) {
  .dt-row { grid-template-columns: 1fr 80px auto; }
  .sc-amount { font-size: 24px; }
}
</style>