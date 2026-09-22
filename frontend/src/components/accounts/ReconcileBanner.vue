<script setup>
import { computed } from 'vue';
import { useAccountsStore } from '@/stores/accounts';
import { fmt } from '@/composables/useFormat';

const emit = defineEmits(['reconcile']);

const accounts = useAccountsStore();

const hasDiff = computed(() => accounts.hasAnyDiff);
const users = computed(() => accounts.userDiffs);
</script>

<template>
  <div v-if="hasDiff" class="reconcile-banner">
    <div class="banner-head">
      <span class="icon">⚠️</span>
      <span class="title">Расхождение баланса по пользователям</span>
    </div>

    <div class="banner-body">
      <div
        v-for="u in users"
        :key="u.userName"
        class="user-row"
        :class="u.hasDiff ? 'bad' : 'ok'"
      >
        <span class="avatar">{{ u.userName === 'Сергей' ? '👨' : '👩' }}</span>
        <span class="name">{{ u.userName }}</span>

        <span v-if="!u.hasDiff" class="detail">✅ сходится</span>
        <span v-else class="detail">
          по операциям <strong>{{ fmt(u.expected) }} ₽</strong> ·
          на счетах <strong>{{ fmt(u.actual) }} ₽</strong> ·
          <strong class="diff">
            {{ u.diff > 0 ? '+' : '−' }}{{ fmt(Math.abs(u.diff)) }} ₽
          </strong>
        </span>
      </div>
    </div>

    <div class="banner-actions">
      <button
        v-for="u in users.filter(x => x.hasDiff)"
        :key="u.userName"
        class="reconcile-btn"
        @click="emit('reconcile', u)"
      >
        ⚖️ Сверить {{ u.userName === 'Сергей' ? '👨 Сергей' : '👩 Саша' }}
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.reconcile-banner {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 16px;
  border-radius: 14px;
  border: 1px solid rgba(245, 158, 11, 0.4);
  background:
    linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(239, 68, 68, 0.06)),
    rgba(255, 255, 255, 0.9);
  box-shadow: var(--shadow-md);
}

.banner-head {
  display: flex;
  align-items: center;
  gap: 10px;

  .icon {
    font-size: 20px;
    animation: pulse 2s ease-in-out infinite;
  }
  .title {
    font-size: 12.5px;
    font-weight: 800;
    color: #b45309;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
}

@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50%      { transform: scale(1.15); opacity: 0.7; }
}

.banner-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.user-row {
  display: grid;
  grid-template-columns: auto 80px 1fr;
  gap: 10px;
  align-items: center;
  padding: 8px 12px;
  border-radius: 10px;
  font-size: 12.5px;
  background: rgba(255, 255, 255, 0.7);

  &.ok { border: 1px solid rgba(34, 197, 94, 0.35); }
  &.bad { border: 1px solid rgba(239, 68, 68, 0.4); }
}

.avatar { font-size: 16px; }
.name { font-weight: 700; color: var(--text); }
.detail {
  color: var(--muted);
  line-height: 1.4;

  strong {
    font-family: var(--mono);
    color: var(--text);
    font-weight: 800;
  }

  strong.diff { color: #dc2626; }
}

.banner-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.reconcile-btn {
  padding: 9px 16px;
  border-radius: 10px;
  border: 1px solid rgba(245, 158, 11, 0.5);
  background: linear-gradient(135deg, #f59e0b, #f97316);
  color: #fff;
  font-family: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 8px 20px -8px rgba(245, 158, 11, 0.6);
  transition: transform 0.15s, box-shadow 0.18s;
  white-space: nowrap;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 12px 26px -8px rgba(245, 158, 11, 0.85);
  }
  &:active { transform: scale(0.97); }
}

/* ============================================================
   МОБИЛЬНЫЙ
   ============================================================ */
@media (max-width: 700px) {
  .reconcile-banner {
    padding: 12px 14px;
    border-radius: 12px;
    gap: 8px;
  }

  .banner-head {
    gap: 8px;

    .icon { font-size: 18px; }
    .title { font-size: 11px; letter-spacing: 0.03em; }
  }

  .user-row {
    grid-template-columns: auto 1fr;
    gap: 6px 10px;
    padding: 8px 10px;
    font-size: 12px;
  }

  .avatar { font-size: 15px; }

  .name {
    grid-column: 2;
    font-size: 12px;
  }

  .detail {
    grid-column: 1 / 3;
    font-size: 11.5px;
  }

  .banner-actions {
    gap: 6px;
    flex-direction: column;
  }

  .reconcile-btn {
    width: 100%;
    justify-content: center;
    padding: 10px 12px;
    font-size: 12.5px;
    min-height: 44px;
  }
}
</style>