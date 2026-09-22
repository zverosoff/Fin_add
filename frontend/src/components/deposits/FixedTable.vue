<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { api } from '@/api/client';
import { useToast } from '@/composables/useToast';
import { notifySaved, notifyError } from '@/composables/useDataStatus';
import { fmt } from '@/composables/useFormat';

const toast = useToast();

// ── Локальные данные (из state, прилетят через WS) ──
const accountStart = ref(0);
const rate = ref(0);
const incomes = ref([]);
const expenses = ref([]);

// ── Загрузка ──
onMounted(loadFromServer);

async function loadFromServer() {
  try {
    const { data } = await api.get('/state');
    accountStart.value = Number(data.accountStart) || 0;
    rate.value = Number(data.rate) || 0;
    incomes.value = Array.isArray(data.incomes) ? data.incomes : [];
    expenses.value = Array.isArray(data.expenses) ? data.expenses : [];

    // Гарантируем «Вклад»
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

// ── Автосохранение ──
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

// ── Пересчёт вклада ──
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

// ── Итоги ──
const totalIncome = computed(() =>
  incomes.value.reduce((s, x) => s + (Number(x.value) || 0), 0)
);
const totalExpense = computed(() =>
  expenses.value.reduce((s, x) => s + (Number(x.value) || 0), 0)
);
const netIncome = computed(() => totalIncome.value - totalExpense.value);

// ── Добавление / удаление ──
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

function onNameChange() { scheduleSave(); }
function onValueChange() { scheduleSave(); }

// ── Отчёт по пользователям ──
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

function isLocked(item) {
  return item && item.id === 'depositIncome';
}
</script>

<template>
  <div class="fixed-wrap">
    <!-- Таблица процентов -->
    <div class="card">
      <h2>Таблица прибыли от процента</h2>
      <table>
        <tbody>
          <tr>
            <td class="label">На счету</td>
            <td class="value">
              <input v-model.number="accountStart" type="number" step="0.01" />
            </td>
          </tr>
          <tr>
            <td class="label">Текущий процент</td>
            <td class="value">
              <input v-model.number="rate" type="number" step="0.1" />
            </td>
          </tr>
          <tr class="highlight">
            <td class="label">Доход в год</td>
            <td class="value">{{ fmt(incomeYearCredit) }} ₽</td>
          </tr>
          <tr>
            <td class="label">Доход в месяц</td>
            <td class="value">{{ fmt(incomeMonthCredit) }} ₽</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Таблица доходов и расходов -->
    <div class="card">
      <h2>
        Доходы и расходы
        <button class="btn-add-mini" @click="addIncome" type="button">+ доход</button>
        <button class="btn-add-mini" @click="addExpense" type="button">+ расход</button>
      </h2>

      <div class="dt-grid">
        <!-- Доходы -->
        <div class="dt-col income-col">
          <div class="dt-col-title">📈 Доходы</div>
          <div
            v-for="(item, idx) in incomes"
            :key="item.id"
            class="dt-row"
          >
            <input
              v-model="item.name"
              type="text"
              class="dt-name"
              :readonly="isLocked(item)"
              @input="onNameChange"
            />
            <input
              v-model.number="item.value"
              type="number"
              class="dt-value"
              :readonly="isLocked(item)"
              @input="onValueChange"
            />
            <button
              v-if="!isLocked(item)"
              class="btn-del-mini"
              @click="removeIncome(idx)"
              type="button"
            >✕</button>
          </div>
          <div class="dt-total">Итого доходов: <strong>{{ fmt(totalIncome) }} ₽</strong></div>
        </div>

        <!-- Расходы -->
        <div class="dt-col expense-col">
          <div class="dt-col-title">📉 Расходы</div>
          <div
            v-for="(item, idx) in expenses"
            :key="item.id"
            class="dt-row"
          >
            <input
              v-model="item.name"
              type="text"
              class="dt-name"
              @input="onNameChange"
            />
            <input
              v-model.number="item.value"
              type="number"
              class="dt-value"
              @input="onValueChange"
            />
            <button
              class="btn-del-mini"
              @click="removeExpense(idx)"
              type="button"
            >✕</button>
          </div>
          <div class="dt-total">Итого расходов: <strong>{{ fmt(totalExpense) }} ₽</strong></div>
        </div>
      </div>

      <div class="grand-total" :class="netIncome >= 0 ? 'positive' : 'negative'">
        <span>Итого разница (доходы − расходы):</span>
        <strong>{{ fmt(netIncome) }} ₽</strong>
      </div>
    </div>

    <!-- Отчёт по пользователям -->
    <div class="user-report">
      <h3>Краткий отчёт по пользователям</h3>

      <div class="user-report-grid">
        <div class="user-report-card sergey">
          <div class="ur-head">
            <span class="ur-avatar">👨</span>
            <span class="ur-name">Сергей</span>
          </div>
          <div class="ur-rows">
            <div class="ur-row">
              <span class="k">📈 Доходы</span>
              <span class="v income">+{{ fmt(byUser.sergey.income) }} ₽</span>
            </div>
            <div class="ur-row">
              <span class="k">📉 Расходы</span>
              <span class="v expense">−{{ fmt(byUser.sergey.expense) }} ₽</span>
            </div>
            <div class="ur-row total">
              <span class="k">💰 Итого</span>
              <span class="v" :class="byUser.sergey.balance >= 0 ? 'positive' : 'negative'">
                {{ fmt(byUser.sergey.balance) }} ₽
              </span>
            </div>
          </div>
        </div>

        <div class="user-report-card sasha">
          <div class="ur-head">
            <span class="ur-avatar">👩</span>
            <span class="ur-name">Саша</span>
          </div>
          <div class="ur-rows">
            <div class="ur-row">
              <span class="k">📈 Доходы</span>
              <span class="v income">+{{ fmt(byUser.sasha.income) }} ₽</span>
            </div>
            <div class="ur-row">
              <span class="k">📉 Расходы</span>
              <span class="v expense">−{{ fmt(byUser.sasha.expense) }} ₽</span>
            </div>
            <div class="ur-row total">
              <span class="k">💰 Итого</span>
              <span class="v" :class="byUser.sasha.balance >= 0 ? 'positive' : 'negative'">
                {{ fmt(byUser.sasha.balance) }} ₽
              </span>
            </div>
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
}

.card {
  padding: 20px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: var(--shadow-md);

  h2 {
    font-size: 12px;
    color: var(--accent);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: 0 0 14px;
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
}

table {
  width: 100%;
  border-collapse: collapse;
}

td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
  font-size: 14px;

  &.label {
    color: var(--muted);
    font-weight: 500;
  }

  &.value {
    text-align: right;
    font-family: var(--mono);
    font-weight: 700;

    input {
      width: 140px;
      padding: 6px 10px;
      border: 1px solid var(--border);
      border-radius: 8px;
      text-align: right;
      font-family: var(--mono);
      font-size: 14px;
      outline: none;

      &:focus { border-color: var(--accent); }
    }
  }
}

tr.highlight td {
  background: rgba(56, 189, 248, 0.08);

  &.label { color: var(--accent); font-weight: 700; }
  &.value { color: var(--accent); font-size: 16px; }
}

.btn-add-mini {
  padding: 5px 12px;
  border-radius: 999px;
  border: 1px solid var(--accent);
  background: rgba(56, 189, 248, 0.1);
  color: var(--accent);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  margin-left: auto;

  &:hover { background: var(--accent); color: #fff; }
}

.dt-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.dt-col-title {
  font-size: 12px;
  font-weight: 800;
  margin-bottom: 8px;

  .income-col & { color: #16a34a; }
  .expense-col & { color: #dc2626; }
}

.dt-row {
  display: grid;
  grid-template-columns: 1fr 120px auto;
  gap: 6px;
  align-items: center;
  margin-bottom: 6px;
}

.dt-name,
.dt-value {
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-family: inherit;
  font-size: 13px;
  outline: none;

  &:focus { border-color: var(--accent); }
}

.dt-value {
  text-align: right;
  font-family: var(--mono);
  font-weight: 700;
}

.btn-del-mini {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  font-size: 12px;

  &:hover {
    border-color: var(--danger);
    color: var(--danger);
    background: rgba(239, 68, 68, 0.08);
  }
}

.dt-total {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed var(--border);
  font-size: 13px;
  color: var(--muted);
  text-align: right;

  strong {
    font-family: var(--mono);
    font-size: 15px;
    color: var(--text);
  }
}

.grand-total {
  margin-top: 16px;
  padding: 12px 16px;
  border-radius: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
  font-weight: 700;

  &.positive {
    background: rgba(34, 197, 94, 0.1);
    border: 1px solid rgba(34, 197, 94, 0.3);
    color: #16a34a;

    strong { color: #15803d; }
  }

  &.negative {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #dc2626;

    strong { color: #b91c1c; }
  }

  strong {
    font-family: var(--mono);
    font-size: 18px;
  }
}

/* Отчёт по пользователям */
.user-report {
  display: flex;
  flex-direction: column;
  gap: 12px;

  h3 {
    font-size: 12px;
    color: var(--accent);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 700;
    margin: 0;
  }
}

.user-report-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.user-report-card {
  padding: 14px 16px;
  border-radius: 14px;
  border: 1px solid var(--border);
  background: #ffffff;

  &.sergey {
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.06), transparent 60%), #ffffff;
  }

  &.sasha {
    background: linear-gradient(135deg, rgba(236, 72, 153, 0.06), transparent 60%), #ffffff;
  }
}

.ur-head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 800;
  font-size: 15px;
  margin-bottom: 10px;
}

.ur-avatar { font-size: 20px; }

.ur-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
  font-size: 13px;

  .k { color: var(--muted); }
  .v {
    font-family: var(--mono);
    font-weight: 700;

    &.income { color: #16a34a; }
    &.expense { color: #dc2626; }
    &.positive { color: #16a34a; }
    &.negative { color: #dc2626; }
  }

  &.total {
    border-top: 1px dashed var(--border);
    margin-top: 4px;
    padding-top: 8px;

    .k { color: var(--text); font-weight: 700; }
  }
}

/* ============================================================
   МОБИЛЬНЫЙ
   ============================================================ */
@media (max-width: 700px) {
  .card { padding: 14px; }

  .dt-grid {
    grid-template-columns: 1fr;
    gap: 14px;
  }

  .dt-row {
    grid-template-columns: 1fr 100px auto;
  }

  .user-report-grid {
    grid-template-columns: 1fr;
  }

  .grand-total {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }
}
</style>