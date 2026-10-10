<!-- frontend/src/components/analytics/MascotImage.vue -->
<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  name: { type: String, required: true },
  position: { type: String, default: 'left' },
  size: { type: Number, default: 0 },
  fallback: { type: String, default: '🪙' },
  alt: { type: String, default: '' },
  flip: { type: Boolean, default: false },
});

const loaded = ref(false);
const failed = ref(false);

const src = computed(() => `/img/mascots/${props.name}.png`);

const defaultSizes = {
  left: 150,
  right: 150,
  'hero-left': 260,
  'hero-right': 260,
  background: 280,
  floating: 100,
  corner: 130,
  static: 180,
  'goals-corner': 140,
};

const px = computed(() => props.size || defaultSizes[props.position] || 150);

/**
 * ✅ Смещение = половина размера
 * Персонаж стоит на границе: половина внутри, половина снаружи.
 */
const offset = computed(() => Math.round(px.value / 2));

const shouldFlip = computed(() => {
  if (props.flip) return true;
  return props.position === 'right';
});

function onLoad() { loaded.value = true; failed.value = false; }
function onError() { failed.value = true; loaded.value = false; }
</script>

<template>
  <div
    class="mascot"
    :class="[`mascot--${position}`, { 'is-loaded': loaded, 'is-failed': failed }]"
    :style="{
      '--mascot-size': px + 'px',
      '--mascot-offset': offset + 'px',
      '--mascot-flip': shouldFlip ? -1 : 1,
    }"
    aria-hidden="true"
  >
    <img
      v-if="!failed"
      :src="src"
      :alt="alt"
      class="mascot__img"
      loading="lazy"
      decoding="async"
      @load="onLoad"
      @error="onError"
    />
    <span v-else class="mascot__fallback">{{ fallback }}</span>
  </div>
</template>

<style scoped lang="scss">
.mascot {
  position: absolute;
  pointer-events: none;
  z-index: 3;
  width: var(--mascot-size);
  height: var(--mascot-size);
  display: flex;
  align-items: center;
  justify-content: center;
}

.mascot__img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  filter: drop-shadow(0 12px 24px rgba(0, 0, 0, 0.45));
  transform: scaleX(var(--mascot-flip));
  transform-origin: center center;
  opacity: 0;
  transition: opacity 0.4s ease;
}

.mascot.is-loaded .mascot__img { opacity: 1; }

.mascot__fallback {
  font-size: calc(var(--mascot-size) * 0.7);
  line-height: 1;
  filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.4));
  transform: scaleX(var(--mascot-flip));
  user-select: none;
}

/* ✅ LEFT/RIGHT — половина в блоке, половина снаружи */
.mascot--left {
  left: calc(var(--mascot-offset) * -1);
  top: 50%;
  transform: translateY(-50%);
}

.mascot--right {
  right: calc(var(--mascot-offset) * -1);
  top: 50%;
  transform: translateY(-50%);
}

/* ✅ HERO — копилка слева, на половину */
.mascot--hero-left {
  left: calc(var(--mascot-offset) * -1);
  top: 50%;
  transform: translateY(-50%);
}

.mascot--hero-right {
  right: calc(var(--mascot-offset) * -1);
  top: 50%;
  transform: translateY(-50%);
}

.mascot--background { right: -40px; bottom: -30px; opacity: 0.35; z-index: 0; }
.mascot--floating { right: 8px;   top: 8px; }
.mascot--corner   { right: -20px; top: -20px; }
.mascot--static   { position: relative; left: auto; right: auto; top: auto; bottom: auto; }

/* ✅ Звезда целей */
.mascot--goals-corner {
  right: -20px;
  top: -20px;
}

/* ✅ МОБИЛЬНЫЙ — меньше размеры, копилка/калькулятор слева */
@media (max-width: 700px) {
  .mascot--left {
    left: -60px;
    top: 50%;
    transform: translateY(-50%);
  }

  .mascot--right {
    right: -60px;
    top: 50%;
    transform: translateY(-50%);
  }

  .mascot--hero-left {
    left: -100px;
    top: 50%;
    transform: translateY(-50%);
  }

  .mascot--goals-corner {
    right: -15px;
    top: -15px;
    width: 100px !important;
    height: 100px !important;
  }
}
</style>