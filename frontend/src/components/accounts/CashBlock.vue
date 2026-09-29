<script setup>
import { computed, ref } from 'vue';
import { useAccountsStore } from '@/stores/accounts';
import { fmt } from '@/composables/useFormat';
import CashModal from '@/components/transactions/CashModal.vue';

const accounts = useAccountsStore();

const cashModalOpen = ref(false);
const cashModalOwner = ref('');
const cashModalMode = ref('add');

const totalBalance = computed(() => accounts.totalCash);
const totalSavings = computed(() => accounts.totalCashSavings);
const totalAll = computed(() => accounts.totalCashAll);

const owners = computed(() => {
  return ['Сергей', 'Саша'].map(owner => ({
    owner,
    emoji: owner === 'Сергей' ? '👨' : '👩',
    balance: accounts.getCash(owner),
    savings: accounts.getCashSavings(owner),
  }));
});

function openModal(owner = '', mode = 'add') {
  cashModalOwner.value = owner;
  cashModalMode.value = mode;
  cashModalOpen.value = true;
}
</script>

<template>
  <section class="cash-block">
    <!-- Купюра -->
    <div class="cash-note">
      <div class="cn-pattern"></div>
      <div class="cn-watermark">₽</div>

      <div class="cn-top">
        <div class="cn-nominal">
          <span class="cn-icon">💵</span>
          <span class="cn-label">НАЛИЧНЫЕ</span>
        </div>
        <div class="cn-total">
          <div class="cn-total-value">{{ fmt(totalAll) }} ₽</div>
          <div class="cn-total-label">всего на руках</div>
        </div>
      </div>

      <div class="cn-middle">
        <div class="cn-part">
          <div class="cn-part-icon">👛</div>
          <div class="cn-part-info">
            <div class="cn-part-value">{{ fmt(totalBalance) }} ₽</div>
            <div class="cn-part-label">в кошельке</div>
          </div>
        </div>
        <div class="cn-part">
          <div class="cn-part-icon">🏦</div>
          <div class="cn-part-info">
            <div class="cn-part-value">{{ fmt(totalSavings) }} ₽</div>
            <div class="cn-part-label">в копилке</div>
          </div>
        </div>
      </div>

      <div class="cn-actions">
        <button
          class="cn-act cn-act-primary"
          type="button"
          @click="openModal('', 'add')"
        >
          <span class="cn-act-icon">＋</span>
          <span>Добавить</span>
        </button>
        <button
          class="cn-act"
          type="button"
          @click="openModal('', 'savings-to')"
        >
          <span class="cn-act-icon">🏦</span>
          <span>В копилку</span>
        </button>
        <button
          class="cn-act"
          type="button"
          @click="openModal('', 'set')"
        >
          <span class="cn-act-icon">⚖️</span>
          <span>Сверка</span>
        </button>
      </div>
    </div>

    <!-- ✅ Отрывной билет по пользователям -->
    <div class="cash-stub">
      <div class="cs-perf"></div>

      <div class="cs-perforation" aria-hidden="true">
        <span v-for="n in 12" :key="n" class="cs-dot"></span>
      </div>

      <div class="cs-owners">
        <div
          v-for="o in owners"
          :key="o.owner"
          class="cs-owner"
        >
          <div class="cs-owner-top">
            <span class="cs-owner-avatar">{{ o.emoji }}</span>
            <span class="cs-owner-name">{{ o.owner }}</span>
          </div>
          <div class="cs-owner-balance">
            {{ fmt(o.balance) }} ₽
          </div>
        </div>
      </div>
    </div>

    <CashModal
      v-model="cashModalOpen"
      :owner="cashModalOwner"
      :initial-mode="cashModalMode"
    />
  </section>
</template>

<style scoped lang="scss">
.cash-block {
  display: flex;
  flex-direction: column;
  gap: 0;
}

/* ============================================================
   КУПЮРА
   ============================================================ */
.cash-note {
  position: relative;
  border-radius: 18px 18px 0 0;
  padding: 18px 20px 16px;
  overflow: hidden;

  background:
    radial-gradient(circle at 10% 20%, rgba(255, 255, 255, 0.35), transparent 40%),
    radial-gradient(circle at 90% 80%, rgba(255, 255, 255, 0.25), transparent 45%),
    linear-gradient(135deg, #059669 0%, #10b981 40%, #34d399 70%, #059669 100%);
  background-size: 100% 100%, 100% 100%, 300% 300%;
  animation: cashShift 14s ease-in-out infinite;

  color: #ffffff;
  box-shadow:
    0 20px 40px -18px rgba(16, 185, 129, 0.6),
    0 10px 20px -10px rgba(5, 150, 105, 0.4),
    inset 0 0 0 1px rgba(255, 255, 255, 0.15);
}

@keyframes cashShift {
  0%   { background-position: 0% 0%, 100% 100%, 0% 50%; }
  50%  { background-position: 0% 0%, 100% 100%, 100% 50%; }
  100% { background-position: 0% 0%, 100% 100%, 0% 50%; }
}

.cash-note::before {
  content: '';
  position: absolute;
  inset: 6px 6px 6px 6px;
  border-radius: 14px 14px 4px 4px;
  border: 1.5px dashed rgba(255, 255, 255, 0.35);
  border-bottom: none;
  pointer-events: none;
}

.cn-watermark {
  position: absolute;
  right: -10px;
  bottom: -30px;
  font-size: 140px;
  font-weight: 900;
  color: rgba(255, 255, 255, 0.08);
  line-height: 1;
  pointer-events: none;
  user-select: none;
  font-family: var(--mono);
}

.cn-pattern {
  position: absolute;
  inset: 0;
  background-image:
    repeating-linear-gradient(45deg,
      rgba(255, 255, 255, 0.04) 0 2px,
      transparent 2px 8px);
  pointer-events: none;
}

.cn-top {
  position: relative;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 14px;
}

.cn-nominal {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 5px 14px 5px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.4);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.cn-icon { font-size: 16px; }

.cn-label {
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.cn-total { text-align: right; }

.cn-total-value {
  font-family: var(--mono);
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.1;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.cn-total-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  opacity: 0.85;
  margin-top: 2px;
}

.cn-middle {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding: 10px 0 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
}

.cn-part {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border-radius: 10px;
}

.cn-part-icon { font-size: 20px; flex-shrink: 0; }

.cn-part-info { min-width: 0; }

.cn-part-value {
  font-family: var(--mono);
  font-size: 15px;
  font-weight: 800;
  letter-spacing: -0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cn-part-label {
  font-size: 9.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.85;
  margin-top: 1px;
}

.cn-actions {
  position: relative;
  display: grid;
  grid-template-columns: 1.3fr 1fr 1fr;
  gap: 6px;
  margin-top: 12px;
}

.cn-act {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 8px 6px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.35);
  background: rgba(255, 255, 255, 0.15);
  color: #ffffff;
  font-family: inherit;
  font-size: 11.5px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);

  &:hover {
    background: rgba(255, 255, 255, 0.3);
    transform: translateY(-1px);
    box-shadow: 0 6px 16px -6px rgba(0, 0, 0, 0.35);
  }
  &:active { transform: scale(0.96); }

  &.cn-act-primary {
    background: rgba(255, 255, 255, 0.95);
    color: #047857;
    border-color: transparent;
    font-weight: 800;

    &:hover {
      background: #ffffff;
      color: #065f46;
    }
  }
}

.cn-act-icon {
  font-size: 13px;
  line-height: 1;
}

/* ============================================================
   ✅ ОТРЫВНОЙ БИЛЕТ
   ============================================================ */
.cash-stub {
  position: relative;
  margin-top: -1px;

  background:
    radial-gradient(circle at 10% 100%, rgba(16, 185, 129, 0.06), transparent 40%),
    linear-gradient(180deg, #ecfdf5 0%, #f0fdf4 100%);
  border: 1px solid rgba(5, 150, 105, 0.25);
  border-top: none;
  border-radius: 0 0 16px 16px;
  padding: 14px 14px 14px;

  box-shadow:
    0 10px 30px -18px rgba(16, 185, 129, 0.45),
    0 4px 12px -8px rgba(5, 150, 105, 0.2);
}

/* Перфорация сверху — как оторванный край */
.cs-perforation {
  position: absolute;
  top: -1px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  padding: 0 6px;
  pointer-events: none;
  z-index: 2;
}

.cs-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--bg, #eef2f8);
  transform: translateY(-50%);
  box-shadow: inset 0 -1px 0 rgba(5, 150, 105, 0.2);
}

/* Вертикальная перфорация по центру — разделение двух билетов */
.cs-perf {
  position: absolute;
  left: 50%;
  top: 12px;
  bottom: 12px;
  width: 0;
  border-left: 2px dashed rgba(5, 150, 105, 0.3);
  transform: translateX(-1px);
  pointer-events: none;
}

/* Контейнер двух билетов */
.cs-owners {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding-left: 0;
}

/* Билет одного пользователя */
.cs-owner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 8px;
  border-radius: 12px;
  background: #ffffff;
  border: 1px solid rgba(5, 150, 105, 0.15);
  box-shadow:
    0 2px 6px -2px rgba(5, 150, 105, 0.15),
    inset 0 -1px 0 rgba(5, 150, 105, 0.05);
  text-align: center;
  user-select: none;
  cursor: default;
}

.cs-owner-top {
  display: flex;
  align-items: center;
  gap: 6px;
}

.cs-owner-avatar {
  font-size: 16px;
  line-height: 1;
}

.cs-owner-name {
  font-size: 12px;
  font-weight: 800;
  color: #065f46;
  letter-spacing: 0.01em;
}

.cs-owner-balance {
  font-family: var(--mono);
  font-size: 17px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: #047857;
  line-height: 1.1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

/* ============================================================
   МОБИЛЬНЫЙ
   ============================================================ */
@media (max-width: 700px) {
  .cash-note {
    padding: 14px 16px 12px;
    border-radius: 16px 16px 0 0;
  }

  .cn-total-value { font-size: 22px; }
  .cn-total-label { font-size: 9px; }
  .cn-label { font-size: 9.5px; letter-spacing: 0.1em; }
  .cn-icon { font-size: 14px; }

  .cn-middle { padding: 8px 0 10px; }
  .cn-part-icon { font-size: 17px; }
  .cn-part-value { font-size: 13.5px; }
  .cn-part-label { font-size: 8.5px; }

  .cn-actions { gap: 5px; margin-top: 10px; }
  .cn-act {
    padding: 7px 4px;
    font-size: 10.5px;
    gap: 4px;
  }
  .cn-act-icon { font-size: 12px; }

  .cn-watermark { font-size: 110px; bottom: -24px; right: -8px; }

  /* Отрывной билет */
  .cash-stub {
    padding: 12px 12px 12px;
    border-radius: 0 0 14px 14px;
  }

  .cs-dot { width: 8px; height: 8px; }

  .cs-owners { gap: 6px; }

  .cs-owner {
    padding: 8px 6px;
    gap: 4px;
    border-radius: 10px;
  }

  .cs-owner-avatar { font-size: 14px; }
  .cs-owner-name { font-size: 11px; }
  .cs-owner-balance { font-size: 15px; }
}

@media (max-width: 380px) {
  .cn-total-value { font-size: 19px; }
  .cn-act { font-size: 10px; }

  .cs-owner { padding: 7px 4px; }
  .cs-owner-avatar { font-size: 13px; }
  .cs-owner-name { font-size: 10.5px; }
  .cs-owner-balance { font-size: 13px; }
}
</style>