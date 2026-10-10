<!-- frontend/src/components/analytics/MetricTile.vue -->
<script setup>
import { computed } from 'vue';
import MascotImage from './MascotImage.vue';
import { fmt } from '@/composables/useFormat';

const props = defineProps({
  label: { type: String, required: true },
  value: { type: [Number, String], required: true },
  unit: { type: String, default: '₽' },
  sub: { type: String, default: '' },
  color: { type: String, default: 'violet' },
  mascot: { type: String, default: '' },
  mascotPos: { type: String, default: 'floating' },
  emoji: { type: String, default: '📊' },
  mascotSize: { type: Number, default: 0 },
});

const gradients = {
  emerald: 'linear-gradient(135deg, #059669 0%, #10b981 50%, #34d399 100%)',
  amber:   'linear-gradient(135deg, #d97706 0%, #f59e0b 50%, #fbbf24 100%)',
  rose:    'linear-gradient(135deg, #e11d48 0%, #f43f5e 50%, #fb7185 100%)',
  violet:  'linear-gradient(135deg, #7c3aed 0%, #a855f7 50%, #c084fc 100%)',
  cyan:    'linear-gradient(135deg, #0891b2 0%, #06b6d4 50%, #22d3ee 100%)',
  indigo:  'linear-gradient(135deg, #4f46e5 0%, #6366f1 50%, #818cf8 100%)',
};

const glowColors = {
  emerald: 'rgba(16, 185, 129, 0.5)',
  amber:   'rgba(245, 158, 11, 0.5)',
  rose:    'rgba(244, 63, 94, 0.5)',
  violet:  'rgba(168, 85, 247, 0.5)',
  cyan:    'rgba(6, 182, 212, 0.5)',
  indigo:  'rgba(99, 102, 241, 0.5)',
};

const gradient = computed(() => gradients[props.color] || gradients.violet);
const glow = computed(() => glowColors[props.color] || glowColors.violet);

const formatted = computed(() => {
  if (typeof props.value === 'string') return props.value;
  return fmt(props.value);
});

const hasMascot = computed(() => !!props.mascot);
</script>

<template>
  <div
    class="tile"
    :class="[`tile--mascot-${mascotPos}`]"
    :style="{ '--tile-glow': glow }"
  >
    <div class="tile__bg" :style="{ background: gradient }" aria-hidden="true">
      <div class="tile__shine"></div>

      <!-- ✅ БОЛЬШЕ ФОНОВЫХ ЭЛЕМЕНТОВ -->
      <span class="tile__orb tile__orb--1"></span>
      <span class="tile__orb tile__orb--2"></span>
      <span class="tile__orb tile__orb--3"></span>

      <!-- ✅ ЧАСТИЦЫ-ДОЖДЬ в разные стороны -->
      <span class="tile__particle tile__particle--1"></span>
      <span class="tile__particle tile__particle--2"></span>
      <span class="tile__particle tile__particle--3"></span>
      <span class="tile__particle tile__particle--4"></span>
      <span class="tile__particle tile__particle--5"></span>
      <span class="tile__particle tile__particle--6"></span>
    </div>

    <MascotImage
      v-if="hasMascot"
      :name="mascot"
      :position="mascotPos"
      :size="mascotSize"
      :fallback="emoji"
      :alt="label"
    />

    <div class="tile__content">
      <div class="tile__label">
        <span class="tile__emoji">{{ emoji }}</span>
        <span>{{ label }}</span>
      </div>
      <div class="tile__value">
        {{ formatted }}<span v-if="unit" class="tile__unit"> {{ unit }}</span>
      </div>
      <div v-if="sub" class="tile__sub">{{ sub }}</div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.tile {
  position: relative;
  border-radius: 18px;
  padding: 16px;
  min-height: 140px;
  color: #ffffff;
  overflow: visible;
  isolation: isolate;
  transition: transform 0.2s cubic-bezier(.34,1.56,.64,1);

  &:hover { transform: translateY(-3px); }
}

.tile__bg {
  position: absolute;
  inset: 0;
  border-radius: 18px;
  overflow: hidden;
  z-index: 0;

  /* ✅ АНИМАЦИЯ ГРАДИЕНТА */
  background-size: 200% 200% !important;
  animation: tileGradientShift 8s ease-in-out infinite;

  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.1) inset,
    0 1px 0 rgba(255, 255, 255, 0.18) inset,
    0 12px 28px -10px var(--tile-glow),
    0 4px 10px -4px rgba(0, 0, 0, 0.25);
}

@keyframes tileGradientShift {
  0%, 100% { background-position: 0% 50%; }
  50%      { background-position: 100% 50%; }
}

.tile__shine {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.15) 0%, transparent 40%);
  pointer-events: none;
  z-index: 1;
}

/* ✅ ORB-ы */
.tile__orb {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
  filter: blur(20px);
  z-index: 0;
}

.tile__orb--1 {
  width: 90px; height: 90px;
  background: rgba(255, 255, 255, 0.4);
  top: -30px; right: -20px;
  animation: tileOrbFloat1 8s ease-in-out infinite;
}

.tile__orb--2 {
  width: 70px; height: 70px;
  background: rgba(255, 255, 255, 0.2);
  bottom: -25px; left: 30%;
  animation: tileOrbFloat2 10s ease-in-out infinite;
}

.tile__orb--3 {
  width: 50px; height: 50px;
  background: rgba(255, 255, 255, 0.15);
  top: 40%; left: 5%;
  animation: tileOrbFloat1 12s ease-in-out infinite reverse;
}

@keyframes tileOrbFloat1 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50%      { transform: translate(-15px, 20px) scale(1.15); }
}

@keyframes tileOrbFloat2 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50%      { transform: translate(20px, -15px) scale(1.1); }
}

/* ✅ ЧАСТИЦЫ-ДОЖДЬ — движутся в разные стороны */
.tile__particle {
  position: absolute;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.85);
  pointer-events: none;
  z-index: 0;
}

.tile__particle--1 {
  top: -10%; left: 15%;
  animation: tileRain1 4s linear infinite;
}

.tile__particle--2 {
  top: -10%; left: 35%;
  width: 2px; height: 2px;
  animation: tileRain2 5s linear infinite 1s;
}

.tile__particle--3 {
  top: -10%; left: 55%;
  width: 4px; height: 4px;
  animation: tileRain3 6s linear infinite 0.5s;
}

.tile__particle--4 {
  top: -10%; left: 75%;
  width: 2px; height: 2px;
  animation: tileRain4 4.5s linear infinite 2s;
}

.tile__particle--5 {
  top: -10%; left: 90%;
  animation: tileRain5 5.5s linear infinite 1.5s;
}

.tile__particle--6 {
  top: -10%; left: 25%;
  width: 3px; height: 3px;
  animation: tileRain6 7s linear infinite 3s;
}

/* Дождь в разные стороны */
@keyframes tileRain1 {
  0%   { transform: translate(0, 0); opacity: 0; }
  10%  { opacity: 1; }
  90%  { opacity: 1; }
  100% { transform: translate(-30px, 160px); opacity: 0; }
}

@keyframes tileRain2 {
  0%   { transform: translate(0, 0); opacity: 0; }
  10%  { opacity: 0.8; }
  90%  { opacity: 0.8; }
  100% { transform: translate(20px, 160px); opacity: 0; }
}

@keyframes tileRain3 {
  0%   { transform: translate(0, 0); opacity: 0; }
  10%  { opacity: 1; }
  90%  { opacity: 1; }
  100% { transform: translate(-45px, 160px); opacity: 0; }
}

@keyframes tileRain4 {
  0%   { transform: translate(0, 0); opacity: 0; }
  10%  { opacity: 0.7; }
  90%  { opacity: 0.7; }
  100% { transform: translate(35px, 160px); opacity: 0; }
}

@keyframes tileRain5 {
  0%   { transform: translate(0, 0); opacity: 0; }
  10%  { opacity: 1; }
  90%  { opacity: 1; }
  100% { transform: translate(-20px, 160px); opacity: 0; }
}

@keyframes tileRain6 {
  0%   { transform: translate(0, 0); opacity: 0; }
  10%  { opacity: 0.9; }
  90%  { opacity: 0.9; }
  100% { transform: translate(50px, 160px); opacity: 0; }
}

.tile__content {
  position: relative;
  z-index: 3;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tile--mascot-left .tile__content   { padding-left: 130px; }
.tile--mascot-right .tile__content  { padding-right: 130px; }
.tile--mascot-floating .tile__content,
.tile--mascot-corner .tile__content { padding-right: 90px; }

.tile__label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  opacity: 0.95;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.tile__emoji { font-size: 13px; line-height: 1; }

.tile__value {
  font-family: var(--mono);
  font-size: 26px;
  font-weight: 300;
  letter-spacing: -0.02em;
  line-height: 1.1;
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}

.tile__unit {
  font-size: 0.7em;
  font-weight: 500;
  opacity: 0.85;
}

.tile__sub {
  font-size: 11px;
  opacity: 0.9;
  font-weight: 600;
}

@media (max-width: 700px) {
  .tile { padding: 14px; border-radius: 14px; min-height: 130px; }
  .tile__bg { border-radius: 14px; }
  .tile__value { font-size: 20px; }
  .tile__label { font-size: 10px; }
  .tile__sub { font-size: 10px; }
  .tile--mascot-left .tile__content   { padding-left: 100px; }
  .tile--mascot-right .tile__content  { padding-right: 100px; }
  .tile--mascot-floating .tile__content,
  .tile--mascot-corner .tile__content { padding-right: 70px; }
}
</style>