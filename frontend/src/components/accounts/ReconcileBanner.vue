<script setup>
import { computed } from 'vue';
import { useAccountsStore } from '@/stores/accounts';
import { fmt, AVATAR_MAN, AVATAR_WOMAN } from '@/composables/useFormat';

const emit = defineEmits(['reconcile']);

const accounts = useAccountsStore();

const ICON_WARNING = '/img/icons/ui/warning.png';
const ICON_BALANCE = '/img/icons/ui/balance.png';

const hasDiff = computed(() => accounts.hasAnyDiff);
const users = computed(() => accounts.userDiffs);

function userAvatar(userName) {
  return userName === 'Сергей' ? AVATAR_MAN : AVATAR_WOMAN;
}
</script>

<template>
  <div v-if="hasDiff" class="reconcile-banner">
    <div class="banner-head">
      <img :src="ICON_WARNING" class="banner-icon-img" alt="Внимание" />
      <span class="title">Расхождение баланса по пользователям</span>
    </div>

    <div class="banner-body">
      <div
        v-for="u in users"
        :key="u.userName"
        class="user-row"
        :class="u.hasDiff ? 'bad' : 'ok'"
      >
        <img :src="userAvatar(u.userName)" class="row-avatar" :alt="u.userName" />
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
        <img :src="ICON_BALANCE" class="btn-icon-img" alt="" />
        <span>Сверить {{ u.userName }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.reconcile-banner {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px 18px;
  border-radius: 18px;

  border: 1px solid rgba(245, 158, 11, 0.4);

  background:
    radial-gradient(circle at 0% 0%, rgba(245, 158, 11, 0.12), transparent 60%),
    radial-gradient(circle at 100% 100%, rgba(239, 68, 68, 0.06), transparent 60%),
    linear-gradient(180deg, #ffffff, #fffbeb);

  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.95) inset,
    0 -1px 0 rgba(245, 158, 11, 0.08) inset,
    0 2px 6px rgba(15, 23, 42, 0.05),
    0 8px 20px -6px rgba(245, 158, 11, 0.2),
    0 20px 40px -16px rgba(239, 68, 68, 0.15);

  transition: transform 0.3s ease, box-shadow 0.3s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.95) inset,
      0 -1px 0 rgba(245, 158, 11, 0.08) inset,
      0 4px 10px rgba(15, 23, 42, 0.06),
      0 14px 32px -8px rgba(245, 158, 11, 0.3),
      0 28px 60px -20px rgba(239, 68, 68, 0.2);
  }
}

.banner-head {
  display: flex;
  align-items: center;
  gap: 10px;

  .title {
    font-size: 12.5px;
    font-weight: 800;
    color: #b45309;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
}

/* ✅ PNG-иконка предупреждения — фикс 22×22 */
.banner-icon-img {
  display: block;
  width: 22px;
  height: 22px;
  min-width: 22px;
  max-width: 22px;
  max-height: 22px;
  object-fit: contain;
  flex-shrink: 0;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
  animation: pulseIcon 2s ease-in-out infinite;
}

@keyframes pulseIcon {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.12); }
}

.banner-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.user-row {
  display: grid;
  grid-template-columns: auto 1fr 1fr;
  gap: 10px;
  align-items: center;
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 12.5px;

  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.95) inset,
    0 -1px 0 rgba(148, 163, 184, 0.06) inset,
    0 2px 4px rgba(15, 23, 42, 0.04);

  &.ok {
    background: linear-gradient(180deg, rgba(220, 252, 231, 0.6), rgba(187, 247, 208, 0.3));
    border: 1px solid rgba(34, 197, 94, 0.3);
  }
  &.bad {
    background: linear-gradient(180deg, rgba(254, 226, 226, 0.6), rgba(254, 202, 202, 0.3));
    border: 1px solid rgba(239, 68, 68, 0.35);
  }
}

/* ✅ PNG-аватар в строке — фикс 24×24 */
.row-avatar {
  display: block;
  width: 24px;
  height: 24px;
  min-width: 24px;
  max-width: 24px;
  max-height: 24px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  border: 1.5px solid rgba(255, 255, 255, 0.7);
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
}

.name {
  font-weight: 800;
  color: var(--text);
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.9);
}

.detail {
  color: var(--muted);
  line-height: 1.4;

  strong {
    font-family: var(--mono);
    color: var(--text);
    font-weight: 800;
    text-shadow: 0 1px 0 rgba(255, 255, 255, 0.9);
  }

  strong.diff { color: #dc2626; }
}

.banner-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.reconcile-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 18px;
  border-radius: 12px;
  border: 1px solid rgba(245, 158, 11, 0.5);

  background: linear-gradient(180deg, #fbbf24, #f59e0b);
  color: #ffffff;
  font-family: inherit;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;

  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.4) inset,
    0 -2px 0 rgba(180, 83, 9, 0.3) inset,
    0 4px 8px rgba(245, 158, 11, 0.35),
    0 8px 20px -4px rgba(245, 158, 11, 0.5);

  transition: transform 0.18s cubic-bezier(.34,1.56,.64,1), box-shadow 0.25s ease;

  &:hover {
    transform: translateY(-2px);
    background: linear-gradient(180deg, #fcd34d, #fbbf24);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.45) inset,
      0 -2px 0 rgba(180, 83, 9, 0.3) inset,
      0 6px 14px rgba(245, 158, 11, 0.45),
      0 14px 32px -6px rgba(245, 158, 11, 0.6);

    .btn-icon-img { transform: scale(1.1) rotate(-4deg); }
  }
  &:active {
    transform: translateY(0) scale(0.97);
  }
}

/* ✅ PNG-иконка весов в кнопке — фикс 18×18 */
.btn-icon-img {
  display: block;
  width: 18px;
  height: 18px;
  min-width: 18px;
  max-width: 18px;
  max-height: 18px;
  object-fit: contain;
  flex-shrink: 0;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.25));
  transition: transform 0.2s cubic-bezier(.34,1.56,.64,1);
}

@media (max-width: 700px) {
  .reconcile-banner {
    padding: 14px 16px;
    border-radius: 16px;
    gap: 8px;
  }

  .banner-head {
    gap: 8px;
    .banner-icon-img {
      width: 20px;
      height: 20px;
      min-width: 20px;
      max-width: 20px;
      max-height: 20px;
    }
    .title { font-size: 11px; letter-spacing: 0.03em; }
  }

  .user-row {
    grid-template-columns: auto 1fr;
    gap: 6px 10px;
    padding: 10px 12px;
    font-size: 12px;
  }

  .row-avatar {
    width: 22px;
    height: 22px;
    min-width: 22px;
    max-width: 22px;
    max-height: 22px;
  }

  .name { grid-column: 2; font-size: 12px; }
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
    padding: 11px 14px;
    font-size: 12.5px;
    min-height: 44px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .reconcile-banner,
  .reconcile-btn,
  .banner-icon-img,
  .btn-icon-img {
    transition: none !important;
    transform: none !important;
    animation: none !important;
  }
}
</style>