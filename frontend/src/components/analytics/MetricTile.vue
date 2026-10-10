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
  min-height: 140px;
  color: #ffffff;
  overflow: visible;
  isolation: isolate;
  transition: transform 0.2s;
  padding: 14px 16px;
  box-sizing: border-box;

  &:hover { transform: translateY(-2px); }
}

.tile__bg {
  position: absolute;
  inset: 0;
  border-radius: 18px;
  overflow: hidden;
  z-index: 0;

  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.1) inset,
    0 1px 0 rgba(255, 255, 255, 0.18) inset,
    0 12px 28px -10px var(--tile-glow),
    0 4px 10px -4px rgba(0, 0, 0, 0.25);
}

.tile__shine {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.15) 0%, transparent 40%);
  pointer-events: none;
  z-index: 1;
}

/* ============================================================
   ✅ КОНТЕНТ — базовая структура
   ============================================================ */
.tile__content {
  position: relative;
  z-index: 4;
  display: flex;
  flex-direction: column;
  justify-content: center;   /* ✅ по вертикали — ЦЕНТР */
  gap: 4px;
  height: 100%;
  min-height: 112px;
  box-sizing: border-box;
}

/* ============================================================
   ✅ ВЫРАВНИВАНИЕ — ПК
   ============================================================ */

/* Свободно (кошелёк слева) — ТЕКСТ СПРАВА */
.tile--mascot-left .tile__content {
  padding-left: 110px;
  padding-right: 0;
  text-align: right;
  align-items: flex-end;        /* ← все дети прижаты к правому краю */
}
.tile--mascot-left .tile__label {
  justify-content: flex-end;    /* ← метка справа */
}

/* Подушка (щит справа) — ТЕКСТ СЛЕВА */
.tile--mascot-right .tile__content {
  padding-right: 110px;
  padding-left: 0;
  text-align: left;
  align-items: flex-start;      /* ← все дети прижаты к левому краю */
}
.tile--mascot-right .tile__label {
  justify-content: flex-start;  /* ← метка слева */
}

.tile--mascot-floating .tile__content,
.tile--mascot-corner .tile__content {
  padding-right: 80px;
  text-align: right;
  align-items: flex-end;
}

/* ============================================================
   ✅ Элементы
   ============================================================ */
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
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.1;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
}

.tile__unit {
  font-size: 0.65em;
  font-weight: 700;
  opacity: 0.9;
}

.tile__sub {
  font-size: 11px;
  opacity: 0.9;
  font-weight: 600;
}

/* ============================================================
   ✅ МОБИЛЬНЫЙ
   ============================================================ */
@media (max-width: 700px) {
  .tile { padding: 14px 16px; border-radius: 14px; min-height: 120px; }
  .tile__bg { border-radius: 14px; }
  .tile__value { font-size: 22px; }
  .tile__label { font-size: 10px; }
  .tile__sub { font-size: 10px; }
  .tile__content { min-height: 92px; }

  /* Свободно (LEFT) — текст СПРАВА */
  .tile--mascot-left .tile__content {
    padding-left: 100px;
    padding-right: 0;
    text-align: right;
    align-items: flex-end;
  }
  .tile--mascot-left .tile__label {
    justify-content: flex-end;
  }

  /* Подушка (RIGHT) — текст СЛЕВА */
  .tile--mascot-right .tile__content {
    padding-right: 100px;
    padding-left: 0;
    text-align: left;
    align-items: flex-start;
  }
  .tile--mascot-right .tile__label {
    justify-content: flex-start;
  }

  /* ✅ Калькулятор (tile-calc) — персонаж ВЛЕВО, текст СПРАВА */
  .tile-calc :deep(.mascot--right) {
    left: -15px !important;
    right: auto !important;
  }
  .tile-calc .tile__content {
    padding-left: 100px !important;
    padding-right: 0 !important;
    text-align: right !important;
    align-items: flex-end !important;
  }
  .tile-calc .tile__label {
    justify-content: flex-end !important;
  }
}
</style>