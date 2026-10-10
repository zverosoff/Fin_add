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
</script>

<template>
  <section class="hero-card">
    <!-- ✅ Фон отдельным слоем, чтобы персонаж мог выйти за границы -->
    <div class="hero-card__bg" aria-hidden="true">
      <div class="hero-card__glow"></div>
      <div class="hero-card__pattern"></div>
      <div class="hero-card__rain">
        <span class="hero-particle hero-particle--1"></span>
        <span class="hero-particle hero-particle--2"></span>
        <span class="hero-particle hero-particle--3"></span>
        <span class="hero-particle hero-particle--4"></span>
        <span class="hero-particle hero-particle--5"></span>
        <span class="hero-particle hero-particle--6"></span>
        <span class="hero-particle hero-particle--7"></span>
        <span class="hero-particle hero-particle--8"></span>
      </div>
    </div>

    <!-- ✅ Копилка выходит за блок сверху и снизу -->
    <MascotImage
      name="piggy"
      position="hero-left"
      :size="260"
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
      <button class="hero-card__btn" type="button">Управлять →</button>
    </div>
  </section>
</template>

<style scoped lang="scss">
/* ✅ overflow: visible — копилка выходит за границы */
.hero-card {
  position: relative;
  border-radius: 24px;
  overflow: visible;
  padding: 22px 24px 22px 280px;
  min-height: 220px;
  isolation: isolate;
  color: #ffffff;
  display: flex;
  align-items: center;
}

/* ✅ Фон отдельным слоем, чтобы border-radius работал без overflow: hidden */
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
  animation: heroGradientShift 10s ease-in-out infinite;

  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.1) inset,
    0 1px 0 rgba(255, 255, 255, 0.15) inset,
    0 24px 48px -12px rgba(139, 92, 246, 0.5),
    0 0 80px -20px rgba(139, 92, 246, 0.4);
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

/* ✅ Частицы-дождь */
.hero-card__rain {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.hero-particle {
  position: absolute;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.7);
}

.hero-particle--1 { top: -10%; left: 10%; animation: heroRain1 5s linear infinite; }
.hero-particle--2 { top: -10%; left: 25%; width: 2px; height: 2px; animation: heroRain2 6s linear infinite 0.8s; }
.hero-particle--3 { top: -10%; left: 40%; width: 4px; height: 4px; animation: heroRain3 7s linear infinite 1.5s; }
.hero-particle--4 { top: -10%; left: 55%; animation: heroRain4 5.5s linear infinite 2.2s; }
.hero-particle--5 { top: -10%; left: 70%; width: 2px; height: 2px; animation: heroRain5 6.5s linear infinite 0.5s; }
.hero-particle--6 { top: -10%; left: 85%; width: 3px; height: 3px; animation: heroRain6 8s linear infinite 3s; }
.hero-particle--7 { top: -10%; left: 95%; width: 2px; height: 2px; animation: heroRain7 5.2s linear infinite 1s; }
.hero-particle--8 { top: -10%; left: 5%; animation: heroRain8 6.8s linear infinite 4s; }

@keyframes heroRain1 { 0% { transform: translate(0, 0); opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { transform: translate(-40px, 240px); opacity: 0; } }
@keyframes heroRain2 { 0% { transform: translate(0, 0); opacity: 0; } 10% { opacity: 0.8; } 90% { opacity: 0.8; } 100% { transform: translate(30px, 240px); opacity: 0; } }
@keyframes heroRain3 { 0% { transform: translate(0, 0); opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { transform: translate(-60px, 240px); opacity: 0; } }
@keyframes heroRain4 { 0% { transform: translate(0, 0); opacity: 0; } 10% { opacity: 0.9; } 90% { opacity: 0.9; } 100% { transform: translate(50px, 240px); opacity: 0; } }
@keyframes heroRain5 { 0% { transform: translate(0, 0); opacity: 0; } 10% { opacity: 0.7; } 90% { opacity: 0.7; } 100% { transform: translate(-25px, 240px); opacity: 0; } }
@keyframes heroRain6 { 0% { transform: translate(0, 0); opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { transform: translate(70px, 240px); opacity: 0; } }
@keyframes heroRain7 { 0% { transform: translate(0, 0); opacity: 0; } 10% { opacity: 0.8; } 90% { opacity: 0.8; } 100% { transform: translate(-35px, 240px); opacity: 0; } }
@keyframes heroRain8 { 0% { transform: translate(0, 0); opacity: 0; } 10% { opacity: 0.6; } 90% { opacity: 0.6; } 100% { transform: translate(45px, 240px); opacity: 0; } }

.hero-card__content {
  position: relative;
  z-index: 4;
  flex: 1;
  min-width: 0;
}

.hero-card__label {
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  opacity: 0.9;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.hero-card__month {
  font-weight: 600;
  opacity: 0.7;
  letter-spacing: 0.08em;
}

/* ✅ ЖИРНАЯ КРУПНАЯ СУММА */
.hero-card__value {
  font-family: var(--mono);
  font-size: 48px;
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.05;
  color: #facc15;
  text-shadow:
    0 0 24px rgba(250, 204, 21, 0.5),
    0 2px 6px rgba(0, 0, 0, 0.3);
  margin-bottom: 6px;
}

.hero-card__sub {
  font-size: 12.5px;
  opacity: 0.85;
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
    padding: 18px 16px 18px 190px;
    min-height: 180px;
    border-radius: 20px;
  }
  .hero-card__bg { border-radius: 20px; }
  .hero-card__value { font-size: 32px; }
  .hero-card__sub { font-size: 11.5px; }
  .hero-card__btn { padding: 8px 14px; font-size: 11.5px; }
}
</style>