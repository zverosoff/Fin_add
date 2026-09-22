<script setup>
import { computed, ref } from 'vue';
import { useAccountsStore } from '@/stores/accounts';
import { fmt, bankLogo } from '@/composables/useFormat';

const emit = defineEmits(['reconcile']);

const accounts = useAccountsStore();

function fmtFull(n) {
  const v = Number(n) || 0;
  return v.toLocaleString('ru-RU', { maximumFractionDigits: 0 });
}

function diffText(diff) {
  if (!diff.hasDiff) return '✅ сходится';
  const sign = diff.diff > 0 ? '+' : '−';
  const abs = Math.abs(diff.diff);
  return `⚠️ ${sign}${fmtFull(abs)} ₽`;
}

function diffClass(diff) {
  if (!diff.hasDiff) return 'ok';
  return diff.diff > 0 ? 'pos' : 'neg';
}

function onReconcile(acc) {
  emit('reconcile', acc);
}
</script>

<template>
  <div class="accounts-block">
    <header class="accounts-header">
      <h3>💳 Наши счета</h3>
      <div class="acc-total-line">{{ fmtFull(accounts.total) }} ₽</div>
    </header>

    <div class="accounts-groups">
      <div v-for="(list, owner) in accounts.byOwner" :key="owner" class="owner-group">
        <div class="owner-title">
          <span class="avatar">{{ owner === 'Сергей' ? '👨' : '👩' }}</span>
          {{ owner }}
        </div>

        <div class="accounts-grid">
          <div
            v-for="acc in list"
            :key="acc.id"
            class="account-card"
            :class="acc.id.startsWith('sber') ? 'sber' : 'tbank'"
          >
            <div class="acc-head">
              <img
                v-if="bankLogo(acc.id)"
                :src="bankLogo(acc.id)"
                :alt="acc.name"
                class="account-logo-img"
                loading="lazy"
              />
              <span v-else class="account-logo-fallback">
                {{ acc.id.startsWith('sber') ? 'С' : 'Т' }}
              </span>
              <span class="account-name-text">{{ acc.name }}</span>
            </div>

            <div class="acc-balance">
              <span class="label">Текущий:</span>
              <span class="value">{{ fmtFull(acc.value) }} ₽</span>
            </div>

            <div
              class="acc-diff"
              :class="diffClass(accounts.diffByAccount[acc.id])"
            >
              {{ diffText(accounts.diffByAccount[acc.id]) }}
            </div>

            <button
              class="acc-reconcile-btn"
              @click="onReconcile(acc)"
              type="button"
            >
              ⚖️ Сверить
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.accounts-block {
  padding: 16px 18px;
  background:
    linear-gradient(180deg, rgba(56, 189, 248, 0.06), transparent 60%),
    rgba(255, 255, 255, 0.9);
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: var(--shadow-md);
}

.accounts-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 12px;

  h3 {
    font-size: 12px;
    color: var(--accent);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: 0;
    font-weight: 700;
  }
}

.acc-total-line {
  padding: 5px 12px;
  border-radius: 999px;
  background: linear-gradient(135deg, rgba(56, 189, 248, 0.14), rgba(139, 92, 246, 0.1));
  border: 1px solid rgba(56, 189, 248, 0.28);
  font-family: var(--mono);
  font-size: 13px;
  font-weight: 800;
  color: var(--accent);
  white-space: nowrap;

  &::before {
    content: "💰 ";
    font-size: 12px;
  }
}

.owner-group {
  margin-bottom: 12px;

  &:last-child { margin-bottom: 0; }
}

.owner-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 700;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 8px;
}

.accounts-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}

.account-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: #ffffff;
  position: relative;
  overflow: hidden;
  transition: transform 0.18s, box-shadow 0.18s;

  &:hover {
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }
}

.acc-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.account-logo-img {
  width: 28px;
  height: 28px;
  object-fit: contain;
  border-radius: 6px;
  background: #ffffff;
  padding: 2px;
  box-sizing: border-box;
  flex-shrink: 0;
}

.account-logo-fallback {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 800;
  color: #fff;
  background: #21a038;
  flex-shrink: 0;
}

.account-name-text {
  font-weight: 700;
  font-size: 13px;
  color: var(--text);
}

.acc-balance {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 13px;

  .label { color: var(--muted); font-weight: 500; }
  .value {
    font-family: var(--mono);
    font-weight: 800;
    font-size: 15px;
    color: var(--text);
    letter-spacing: -0.02em;
  }
}

.acc-diff {
  font-size: 11.5px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 8px;
  width: fit-content;

  &.ok {
    background: rgba(34, 197, 94, 0.12);
    color: #16a34a;
  }
  &.pos {
    background: rgba(34, 197, 94, 0.12);
    color: #16a34a;
  }
  &.neg {
    background: rgba(239, 68, 68, 0.12);
    color: #dc2626;
  }
}

.acc-reconcile-btn {
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: #f8fafc;
  color: var(--text);
  font-family: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    border-color: var(--accent);
    color: var(--accent);
    background: rgba(56, 189, 248, 0.08);
  }
  &:active { transform: scale(0.97); }
}
</style>