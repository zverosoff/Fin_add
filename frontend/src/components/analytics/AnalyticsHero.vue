<!-- frontend/src/components/analytics/AnalyticsHero.vue -->
<script setup>
import { computed } from 'vue';
import MascotImage from './MascotImage.vue';
import { fmt } from '@/composables/useFormat';
import { useAnalyticsStore } from '@/stores/analytics';

const analytics = useAnalyticsStore();
const PERCENT = 10;

const metrics = computed(() => analytics.currentMonthMetrics || {});
const heroValue = computed(() => metrics.value.monthSave || 0);
const heroIncome = computed(() => metrics.value.monthIncome || 0);
const monthName = computed(() => metrics.value.monthName || '');

function scrollToGoals() {
  const el = document.querySelector('.card-goals');
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
</script>

<template>
  <section class="hero-card">
    <div class="hero-card__bg" aria-hidden="true">
      <div class="hero-card__glow"></div>
      <div class="hero-card__pattern"></div>
    </div>

    <!-- ✅ Копилка крупнее — 200px, выходит за рамки -->
    <MascotImage
      name="piggy"
      position="hero-left"
      :size="200"
      fallback="🐷"
      alt="Копилка"
    />

    <div class="hero-card__content">
      <div class="hero-card__label">
        💰 МОЖНО ОТКЛАДЫВАТЬ
        <span v-if="monthName" class="hero-card__month">· {{ monthName }}</span>
      </div>
      <div class="hero-card__value">{{ fmt(heroValue) }} ₽</div>
      <div class="hero-card__sub">
        Рекомендовано {{ PERCENT }}% от дохода {{ fmt(heroIncome) }} ₽
      </div>
      <button class="hero-card__btn" type="button" @click="scrollToGoals">
        Управлять →
      </button>
    </div>
  </section>
</template>

<style scoped lang="scss">
.hero-card {
  position: relative;
  border-radius: 24px;
  overflow: visible;
  /* ✅ padding-left 190px — под копилку 200px */
  padding: 22px 24px 22px 190px;
  min-height: 180px;
  isolation: isolate;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.hero-card__bg {
  position: absolute;
  inset: 0;
  border-radius: 24px;
  overflow: hidden;
  z-index: 0;

  background:
    radial-gradient(circle at 80% 0%, rgba(236, 72, 153, 0.35), transparent 55%),
    radial-gradient(circle at 0% 100%, rgba(99, 102, 241, 0.45), transparent 50%),
    linear-gradient(135deg, #4c1d95 0%, #6d28d9 35%, #8b5cf6 70%, #a855f7 100%);
  background-size: 200% 200%;
  animation: heroGradientShift 12s ease-in-out infinite;

  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.1) inset,
    0 1px 0 rgba(255, 255, 255, 0.15) inset,
    0 24px 48px -12px rgba(139, 92, 246, 0.5);
}

@keyframes heroGradientShift {
  0%, 100% { background-position: 0% 50%; }
  50%      { background-position: 100% 50%; }
}

.hero-card__glow {
  position: absolute;
  inset: -40%;
  background: radial-gradient(circle at 70% 50%, rgba(250, 204, 21, 0.15), transparent 60%);
  pointer-events: none;
  mix-blend-mode: screen;
}

.hero-card__pattern {
  position: absolute;
  inset: 0;
  background-image:
    radial-gradient(circle at 20% 80%, rgba(255, 255, 255, 0.06) 1px, transparent 1px),
    radial-gradient(circle at 60% 20%, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
  background-size: 24px 24px, 32px 32px;
  pointer-events: none;
}

.hero-card__content {
  position: relative;
  z-index: 4;
  flex: 1;
  min-width: 0;
  margin-left: auto;
  text-align: right;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
}

.hero-card__label {
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  opacity: 0.9;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.hero-card__month {
  font-weight: 600;
  opacity: 0.7;
  letter-spacing: 0.08em;
}

.hero-card__value {
  font-family: var(--mono);
  font-size: 44px;
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.05;
  color: #facc15;
  text-shadow:
    0 0 24px rgba(250, 204, 21, 0.5),
    0 2px 6px rgba(0, 0, 0, 0.3);
  margin-bottom: 4px;
}

.hero-card__sub {
  font-size: 12.5px;
  opacity: 0.85;
  margin-bottom: 12px;
}

.hero-card__btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 18px;
  border-radius: 999px;
  border: none;
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 800;
  color: #0a0612;
  background: linear-gradient(180deg, #fde047, #facc15);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.5) inset,
    0 8px 24px -6px rgba(250, 204, 21, 0.6);
  cursor: pointer;
  transition: transform 0.15s;
  margin-left: auto;

  &:hover { transform: translateY(-2px); }
  &:active { transform: scale(0.97); }
}

@media (max-width: 700px) {
  .hero-card {
    padding: 18px 16px 18px 160px;
    min-height: 170px;
    border-radius: 20px;
  }
  .hero-card__bg {
    border-radius: 20px;
    animation: none !important;
    background-size: 100% 100% !important;
  }
  .hero-card__value { font-size: 30px; }
  .hero-card__sub { font-size: 11.5px; }
}

@media (prefers-reduced-motion: reduce) {
  .hero-card__bg { animation: none !important; }
}
</style>