<script setup>
import { computed, ref, watch, onMounted } from 'vue';
import { useAnalyticsStore } from '@/stores/analytics';
import { fmt } from '@/composables/useFormat';

const props = defineProps({
  goal: { type: Object, required: true },
});

const emit = defineEmits(['edit', 'delete', 'contribute', 'edit-contrib', 'set-primary']);

const analytics = useAnalyticsStore();

// ✅ PNG-иконки
const ICON_EDIT         = '/img/icons/ui/edit.png';
const ICON_DELETE       = '/img/icons/ui/close.png';
const ICON_PLUS         = '/img/icons/ui/plus.png';
const ICON_STAR_FILLED  = '/img/icons/ui/star-filled.png';
const ICON_STAR_OUTLINE = '/img/icons/ui/star-outline.png';
const ICON_GOAL         = '/img/icons/nav/goal.png';
const AVATAR_MAN        = '/img/icons/mascots/avatar-man.png';
const AVATAR_WOMAN      = '/img/icons/mascots/avatar-woman.png';

const eta = computed(() => {
  if (props.goal.done) return null;
  const monthlySave = Math.max(0, analytics.currentMonthMetrics.monthSave);
  if (monthlySave <= 0) return null;
  const months = Math.ceil(props.goal.left / monthlySave);
  return months;
});

function plural(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 19) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

const etaDisplay = ref(0);
const etaVisible = computed(() => eta.value != null);

watch(eta, (val) => {
  if (val == null) { etaDisplay.value = 0; return; }
  const target = val;
  const duration = 600;
  const from = etaDisplay.value;
  const startTs = performance.now();
  function tick(ts) {
    const t = Math.min(1, (ts - startTs) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    etaDisplay.value = Math.round(from + (target - from) * eased);
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}, { immediate: true });

const etaText = computed(() => {
  if (!etaVisible.value) return '';
  const n = etaDisplay.value;
  if (n <= 0) return '';
  return `≈ ${n} ${plural(n, 'месяц', 'месяца', 'месяцев')}`;
});

const confettiActive = ref(false);
const confettiParticles = ref([]);

function spawnConfetti() {
  const colors = ['#fbbf24', '#f97316', '#22c55e', '#3b82f6', '#ec4899', '#8b5cf6'];
  const particles = [];
  for (let i = 0; i < 60; i++) {
    particles.push({
      id: i,
      angle: Math.random() * 360,
      distance: 60 + Math.random() * 120,
      size: 4 + Math.random() * 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      delay: Math.random() * 0.15,
      duration: 0.8 + Math.random() * 0.6,
    });
  }
  confettiParticles.value = particles;
  confettiActive.value = true;
  setTimeout(() => {
    confettiActive.value = false;
    confettiParticles.value = [];
  }, 1800);
}

onMounted(() => {
  if (props.goal.done) setTimeout(spawnConfetti, 300);
});

watch(() => props.goal.done, (isDone, wasDone) => {
  if (isDone && !wasDone) spawnConfetti();
});

const contributors = computed(() =>
  Object.entries(props.goal.contributions ?? {})
    .filter(([_, v]) => Number(v) > 0)
    .map(([user, value]) => ({
      user,
      value: Number(value),
      avatar: user === 'Сергей' ? AVATAR_MAN : AVATAR_WOMAN,
      cls: user === 'Сергей' ? 'sergey' : 'sasha',
    }))
);

const ownerAvatar = computed(() =>
  props.goal.owner === 'Сергей' ? AVATAR_MAN : AVATAR_WOMAN
);
const ownerCls = computed(() => props.goal.owner === 'Сергей' ? 'sergey' : 'sasha');

function onEditContrib(user) {
  emit('edit-contrib', { goal: props.goal, user });
}
</script>

<template>
  <div class="goal-card" :class="{ done: goal.done, primary: goal.primary }">
    <div v-if="confettiActive" class="goal-confetti" aria-hidden="true">
      <span
        v-for="p in confettiParticles"
        :key="p.id"
        class="confetti-particle"
        :style="{
          '--x': p.distance + 'px',
          '--angle': p.angle + 'deg',
          '--size': p.size + 'px',
          '--color': p.color,
          '--delay': p.delay + 's',
          '--duration': p.duration + 's',
        }"
      />
    </div>

    <div class="goal-head">
      <div class="goal-title-row">
        <img
          v-if="!goal.emoji || goal.emoji === '🎯'"
          :src="ICON_GOAL"
          class="goal-icon-img"
          alt="Цель"
        />
        <span v-else class="goal-emoji">{{ goal.emoji }}</span>

        <span class="goal-name">{{ goal.name }}</span>

        <span v-if="goal.primary" class="goal-primary-badge" title="Основная цель">
          <img :src="ICON_STAR_FILLED" class="badge-star-img" alt="" />
          Основная
        </span>

        <span class="goal-owner" :class="ownerCls">
          <img :src="ownerAvatar" class="goal-owner-avatar" :alt="goal.owner" />
          {{ goal.owner }}
        </span>
      </div>

      <div class="goal-actions">
        <button
          class="act-primary"
          type="button"
          :class="{ active: goal.primary }"
          @click="emit('set-primary', goal)"
          :title="goal.primary ? 'Убрать основную' : 'Сделать основной'"
        >
          <img
            :src="goal.primary ? ICON_STAR_FILLED : ICON_STAR_OUTLINE"
            class="act-icon-img"
            alt=""
          />
        </button>

        <button
          class="act-contribute"
          type="button"
          @click="emit('contribute', goal)"
          title="Внести деньги"
        >
          <img :src="ICON_PLUS" class="act-icon-img act-icon-light" alt="" />
          <span>Внести</span>
        </button>

        <button type="button" @click="emit('edit', goal)" title="Редактировать">
          <img :src="ICON_EDIT" class="act-icon-img" alt="Редактировать" />
        </button>

        <button class="danger" type="button" @click="emit('delete', goal)" title="Удалить">
          <img :src="ICON_DELETE" class="act-icon-img" alt="Удалить" />
        </button>
      </div>
    </div>

    <div class="goal-progress">
      <span class="current">{{ fmt(goal.totalSaved) }} ₽</span>
      <span class="target">из {{ fmt(goal.target) }} ₽</span>
    </div>

    <div class="goal-track">
      <div
        class="goal-fill"
        :class="{ done: goal.done }"
        :style="{ width: goal.pct + '%' }"
      >
        <div class="goal-wave" :class="{ done: goal.done }"></div>
      </div>
    </div>

    <div class="goal-foot">
      <span class="goal-pct" :class="{ done: goal.done }">
        {{ goal.pct.toFixed(1) }}%
      </span>
      <span>
        <template v-if="goal.done">🎉 Цель достигнута!</template>
        <template v-else>
          Осталось {{ fmt(goal.left) }} ₽
          <template v-if="etaText"> · {{ etaText }}</template>
        </template>
      </span>
    </div>

    <div v-if="contributors.length > 0" class="goal-contribs">
      <span
        v-for="c in contributors"
        :key="c.user"
        class="goal-contrib"
        :class="c.cls"
        @click="onEditContrib(c.user)"
        :title="`Изменить взнос ${c.user}`"
      >
        <img :src="c.avatar" class="contrib-avatar" :alt="c.user" />
        <span class="name">{{ c.user }}</span>
        <span class="amount">{{ fmt(c.value) }} ₽</span>
      </span>
    </div>
    <div v-else class="goal-empty-contribs">
      <span class="emoji">😢</span>
      <span class="text">Ещё никто не поделился на мечту…</span>
      <span class="hint">Будь первым!</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.goal-card {
  position: relative;
  padding: 14px 16px;
  background: var(--grad-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition:
    transform 0.15s,
    box-shadow 0.2s,
    border-color 0.2s,
    background 0.3s ease;
  min-width: 0;
  overflow: hidden;

  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
  }

  &.done {
    border-color: rgba(34, 197, 94, 0.4);
    background:
      linear-gradient(135deg, rgba(34, 197, 94, 0.06), transparent 60%),
      var(--grad-card);
  }

  &.primary {
    border-color: rgba(251, 191, 36, 0.5);
    background:
      linear-gradient(135deg, rgba(251, 191, 36, 0.08), rgba(245, 158, 11, 0.03)),
      var(--grad-card);
    box-shadow: 0 6px 20px -10px rgba(245, 158, 11, 0.5);
  }
}

.goal-confetti {
  position: absolute;
  left: 30px;
  top: 50%;
  pointer-events: none;
  z-index: 10;
}

.confetti-particle {
  position: absolute;
  width: var(--size);
  height: var(--size);
  border-radius: 50%;
  background: var(--color);
  animation: confettiBurst var(--duration) cubic-bezier(.22,.61,.36,1) var(--delay) forwards;
  transform: translate(0, 0);
  opacity: 0;
}

@keyframes confettiBurst {
  0% { transform: translate(0, 0) rotate(0deg) scale(0.3); opacity: 1; }
  20% { opacity: 1; }
  100% {
    transform:
      translate(
        calc(cos(var(--angle)) * var(--x)),
        calc(sin(var(--angle)) * var(--x))
      )
      rotate(540deg) scale(1);
    opacity: 0;
  }
}

.goal-head { display: flex; flex-direction: column; gap: 6px; }

.goal-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex-wrap: wrap;
}

/* ✅ PNG-иконка цели — фикс 22×22 */
.goal-icon-img {
  display: block;
  width: 22px;
  height: 22px;
  min-width: 22px;
  max-width: 22px;
  max-height: 22px;
  object-fit: contain;
  flex-shrink: 0;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.15));
}

.goal-emoji { font-size: 22px; line-height: 1; flex-shrink: 0; }

.goal-name {
  flex: 1 1 auto;
  font-size: 14px;
  font-weight: 800;
  color: var(--text);
  line-height: 1.3;
  overflow-wrap: anywhere;
  min-width: 0;
}

.goal-primary-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 999px;
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  color: #78350f;
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  white-space: nowrap;
  flex-shrink: 0;
  box-shadow: 0 4px 10px -3px rgba(245, 158, 11, 0.5);
}

/* ✅ PNG-звезда в бейдже — фикс 12×12 */
.badge-star-img {
  display: block;
  width: 12px;
  height: 12px;
  min-width: 12px;
  max-width: 12px;
  max-height: 12px;
  object-fit: contain;
  flex-shrink: 0;
  filter: brightness(0.6) drop-shadow(0 1px 1px rgba(255, 255, 255, 0.4));
}

.goal-owner {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 10.5px;
  font-weight: 700;
  padding: 2px 9px 2px 3px;
  border-radius: 999px;
  white-space: nowrap;
  flex-shrink: 0;

  &.sergey { color: #2563eb; background: rgba(59, 130, 246, 0.12); }
  &.sasha  { color: #ec4899; background: rgba(236, 72, 153, 0.12); }
}

/* ✅ PNG-аватар владельца — фикс 16×16 */
.goal-owner-avatar {
  display: block;
  width: 16px;
  height: 16px;
  min-width: 16px;
  max-width: 16px;
  max-height: 16px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
}

.goal-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;

  button {
    min-width: 30px;
    height: 30px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--panel-2);
    color: var(--muted);
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 8px;
    gap: 5px;
    transition: all 0.15s;
    font-family: inherit;
    overflow: hidden;

    &:hover {
      color: var(--accent);
      border-color: var(--accent);
      background: rgba(139, 92, 246, 0.1);
      transform: translateY(-1px);
    }
    &.danger:hover {
      color: var(--danger);
      border-color: var(--danger);
      background: rgba(244, 63, 94, 0.1);
    }

    &.act-primary {
      min-width: 30px;
      height: 30px;
      padding: 0;
      &:not(.active):hover { color: #f59e0b; border-color: #f59e0b; background: rgba(245, 158, 11, 0.1); }
      &.active {
        background: linear-gradient(135deg, #fbbf24, #f59e0b);
        border-color: transparent;
        color: #ffffff;
        box-shadow: 0 6px 16px -6px rgba(245, 158, 11, 0.7);
      }
    }

    &.act-contribute {
      background: var(--grad-income);
      border-color: transparent;
      color: #fff;
      font-size: 12px;
      font-weight: 700;
      width: auto;
      padding: 0 12px;
      box-shadow:
        0 1px 0 rgba(255, 255, 255, 0.3) inset,
        0 -2px 0 rgba(0, 0, 0, 0.15) inset,
        0 6px 14px -4px rgba(34, 197, 94, 0.5);
      &:hover { color: #fff; transform: translateY(-1px); box-shadow: 0 8px 18px -4px rgba(34, 197, 94, 0.7); }
    }
  }
}

/* ✅ PNG-иконки внутри кнопок действий — фикс 16×16 */
.act-icon-img {
  display: block;
  width: 16px;
  height: 16px;
  min-width: 16px;
  max-width: 16px;
  max-height: 16px;
  object-fit: contain;
  flex-shrink: 0;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.15));
  transition: filter 0.15s, transform 0.2s cubic-bezier(.34,1.56,.64,1);
}

.act-icon-light {
  filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.4)) brightness(1.2);
}

.goal-actions button:hover .act-icon-img {
  transform: scale(1.12) rotate(-4deg);
}

.goal-progress {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
  .current { font-family: var(--mono); font-size: 16px; font-weight: 800; color: var(--accent); }
  .target  { font-family: var(--mono); font-size: 11.5px; font-weight: 700; color: var(--muted); }
}

.goal-track {
  position: relative;
  height: 10px;
  border-radius: 5px;
  background: rgba(148, 163, 184, 0.15);
  overflow: hidden;
}
.goal-fill {
  position: relative;
  height: 100%;
  border-radius: 5px;
  background: var(--grad-primary);
  transition: width 0.6s cubic-bezier(.22,.61,.36,1);
  box-shadow: 0 0 10px rgba(139, 92, 246, 0.4);
  overflow: hidden;

  &.done {
    background: var(--grad-income);
    box-shadow: 0 0 10px rgba(34, 197, 94, 0.5);
  }
}
.goal-wave {
  position: absolute;
  inset: 0;
  background:
    repeating-linear-gradient(
      120deg,
      transparent 0,
      transparent 12px,
      rgba(255, 255, 255, 0.35) 12px,
      rgba(255, 255, 255, 0.35) 20px,
      transparent 20px,
      transparent 32px
    );
  animation: waveSlide 1.6s linear infinite;
  pointer-events: none;
  &.done { animation-duration: 0.9s; }
}
@keyframes waveSlide {
  0%   { background-position: 0 0; }
  100% { background-position: 64px 0; }
}

.goal-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  color: var(--muted);
  font-weight: 600;
  gap: 8px;
  flex-wrap: wrap;
  .goal-pct {
    font-weight: 800;
    color: var(--accent);
    font-variant-numeric: tabular-nums;
    &.done { color: var(--accent-2, #22c55e); }
  }
}

.goal-contribs {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  padding-top: 8px;
  border-top: 1px dashed var(--border);
}
.goal-contrib {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px 3px 3px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  border: 1px solid var(--border);
  background: var(--panel-2);
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.2s;
  &:hover { transform: translateY(-1px); box-shadow: var(--shadow-sm); }
  .name { color: var(--muted); font-weight: 600; }
  .amount { font-family: var(--mono); font-weight: 800; color: var(--text); }
  &.sergey { background: rgba(59, 130, 246, 0.08); border-color: rgba(59, 130, 246, 0.25); .amount { color: #2563eb; } }
  &.sasha  { background: rgba(236, 72, 153, 0.08); border-color: rgba(236, 72, 153, 0.25); .amount { color: #db2777; } }
}

/* ✅ PNG-аватар в бейдже взноса — фикс 18×18 */
.contrib-avatar {
  display: block;
  width: 18px;
  height: 18px;
  min-width: 18px;
  max-width: 18px;
  max-height: 18px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
}

.goal-empty-contribs {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 8px;
  background: var(--panel-2);
  color: var(--muted);
  font-size: 11px;
  font-style: italic;
  text-align: center;
  border: 1px dashed var(--border);
  .emoji { font-style: normal; }
  .hint { color: var(--accent); font-weight: 600; font-style: normal; }
}

:global(:root[data-app-theme="dark"]) {
  .goal-card.primary {
    border-color: rgba(251, 191, 36, 0.4);
    background:
      linear-gradient(135deg, rgba(251, 191, 36, 0.12), rgba(245, 158, 11, 0.04)),
      linear-gradient(180deg, rgba(30, 16, 48, 0.9) 0%, rgba(20, 9, 31, 0.95) 100%);
    box-shadow:
      0 6px 20px -10px rgba(245, 158, 11, 0.6),
      0 0 0 1px rgba(251, 191, 36, 0.15);
  }

  .goal-card.done {
    border-color: rgba(74, 222, 128, 0.4);
    background:
      linear-gradient(135deg, rgba(34, 197, 94, 0.12), transparent 60%),
      linear-gradient(180deg, rgba(30, 16, 48, 0.9) 0%, rgba(20, 9, 31, 0.95) 100%);
  }

  .goal-fill {
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.3) inset,
      0 0 16px rgba(168, 85, 247, 0.6);
  }
  .goal-fill.done {
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.3) inset,
      0 0 16px rgba(74, 222, 128, 0.6);
  }

  .goal-contrib.sergey .amount {
    color: #60a5fa;
    text-shadow: 0 0 8px rgba(96, 165, 250, 0.4);
  }
  .goal-contrib.sasha .amount {
    color: #f472b6;
    text-shadow: 0 0 8px rgba(244, 114, 182, 0.4);
  }
}

@media (max-width: 700px) {
  .goal-card { padding: 12px 14px; gap: 8px; border-radius: 12px; }
  .goal-title-row { gap: 6px; }
  .goal-icon-img {
    width: 20px;
    height: 20px;
    min-width: 20px;
    max-width: 20px;
    max-height: 20px;
  }
  .goal-emoji { font-size: 20px; }
  .goal-name { font-size: 13px; }
  .goal-primary-badge { font-size: 9px; padding: 2px 6px; }
  .badge-star-img { width: 10px; height: 10px; min-width: 10px; max-width: 10px; max-height: 10px; }
  .goal-owner { font-size: 10px; padding: 2px 7px 2px 2px; }
  .goal-owner-avatar { width: 14px; height: 14px; min-width: 14px; max-width: 14px; max-height: 14px; }
  .goal-actions {
    gap: 4px;
    button { min-width: 28px; height: 28px; font-size: 11px; }
    button.act-primary { min-width: 28px; height: 28px; }
    button.act-contribute { padding: 0 10px; font-size: 11px; height: 28px; }
  }
  .act-icon-img {
    width: 14px;
    height: 14px;
    min-width: 14px;
    max-width: 14px;
    max-height: 14px;
  }
  .goal-progress { .current { font-size: 15px; } .target { font-size: 11px; } }
  .goal-foot { font-size: 11px; }
  .goal-contribs { gap: 5px; padding-top: 6px; }
  .goal-contrib { font-size: 10.5px; padding: 2px 8px 2px 2px; gap: 4px; }
  .contrib-avatar { width: 16px; height: 16px; min-width: 16px; max-width: 16px; max-height: 16px; }
  .goal-empty-contribs { font-size: 10.5px; padding: 5px 8px; }
}

@media (max-width: 380px) {
  .goal-name { font-size: 12.5px; }
  .goal-progress .current { font-size: 14px; }
}

@media (prefers-reduced-motion: reduce) {
  .goal-wave, .confetti-particle, .act-icon-img { animation: none !important; transition: none !important; }
}
</style>