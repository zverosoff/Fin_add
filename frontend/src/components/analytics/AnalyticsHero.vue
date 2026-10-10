<!-- frontend/src/components/analytics/AnalyticsHero.vue -->
<script setup>
import { computed } from 'vue';
import MascotImage from './MascotImage.vue';
import { fmt } from '@/composables/useFormat';
import { useAnalyticsStore } from '@/stores/analytics';

const analytics = useAnalyticsStore();

const PERCENT = 10;

// ✅ Только реальные данные из стора, без демо-подмены
const heroValue = computed(() => {
  const v = analytics.savingsRecommended;
  return (typeof v === 'number' && v > 0) ? v : 0;
});

const heroIncome = computed(() => {
  const v = analytics.monthIncome
    ?? analytics.currentMonthSummary?.income
    ?? 0;
  return v;
});
</script>

<template>
  <section class="hero-card">
    <div class="hero-card__glow" aria-hidden="true"></div>
    <div class="hero-card__pattern" aria-hidden="true"></div>

    <MascotImage
      name="piggy"
      position="hero-left"
      :size="180"
      fallback="🐷"
      alt="Копилка"
    />

    <div class="hero-card__content">
      <div class="hero-card__label">💰 МОЖНО ОТКЛАДЫВАТЬ</div>
      <div class="hero-card__value">{{ fmt(heroValue) }} ₽</div>
      <div class="hero-card__sub">
        Рекомендовано {{ PERCENT }}% от дохода {{ fmt(heroIncome) }} ₽
      </div>
      <button class="hero-card__btn" type="button">
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
  padding: 22px 24px 22px 200px;
  min-height: 160px;
  isolation: isolate;

  background:
    radial-gradient(circle at 80% 0%, rgba(236, 72, 153, 0.35), transparent 55%),
    radial-gradient(circle at 0% 100%, rgba(99, 102, 241, 0.45), transparent 50%),
    linear-gradient(135deg, #4c1d95 0%, #6d28d9 50%, #8b5cf6 100%);

  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.1) inset,
    0 1px 0 rgba(255, 255, 255, 0.15) inset,
    0 24px 48px -12px rgba(139, 92, 246, 0.5),
    0 0 80px -20px rgba(139, 92, 246, 0.4);

  color: #ffffff;
  display: flex;
  align-items: center;
}

.hero-card__glow {
  position: absolute;
  inset: -40%;
  background: radial-gradient(circle at 70% 50%, rgba(250, 204, 21, 0.15), transparent 60%);
  pointer-events: none;
  z-index: 0;
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
  z-index: 0;
}

.hero-card__content {
  position: relative;
  z-index: 3;
  flex: 1;
  min-width: 0;
}

.hero-card__label {
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  opacity: 0.85;
  margin-bottom: 8px;
}

.hero-card__value {
  font-family: var(--mono);
  font-size: 40px;
  font-weight: 300;
  letter-spacing: -0.03em;
  line-height: 1.05;
  color: #facc15;
  text-shadow: 0 0 24px rgba(250, 204, 21, 0.5);
  margin-bottom: 6px;
}

.hero-card__sub {
  font-size: 12.5px;
  opacity: 0.8;
  margin-bottom: 14px;
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
  transition: transform 0.15s, box-shadow 0.2s;

  &:hover {
    transform: translateY(-2px);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.5) inset,
      0 12px 28px -6px rgba(250, 204, 21, 0.8);
  }
  &:active { transform: scale(0.97); }
}

@media (max-width: 700px) {
  .hero-card {
    padding: 18px 16px 18px 150px;
    min-height: 140px;
    border-radius: 20px;
  }
  .hero-card__value { font-size: 30px; }
  .hero-card__sub { font-size: 11.5px; }
  .hero-card__btn { padding: 8px 14px; font-size: 11.5px; }
}

@media (max-width: 380px) {
  .hero-card { padding-left: 130px; }
  .hero-card__value { font-size: 24px; }
}

@media (prefers-reduced-motion: reduce) {
  .hero-card__btn { transition: none; }
}
</style>