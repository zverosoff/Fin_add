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
  left: 130,
  right: 130,
  'hero-left': 220,
  'hero-right': 220,
  background: 280,
  floating: 90,
  corner: 110,
};

const px = computed(() => props.size || defaultSizes[props.position] || 130);

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
  z-index: 2;
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

/* Позиции — без анимаций */
.mascot--left     { left: -18px;  bottom: -12px; }
.mascot--right    { right: -18px; bottom: -12px; }
.mascot--hero-left  { left: -24px;  bottom: -18px; }
.mascot--hero-right { right: -24px; bottom: -18px; }
.mascot--background { right: -40px; bottom: -30px; opacity: 0.35; z-index: 0; }
.mascot--floating { right: 8px;   top: 8px; }
.mascot--corner   { right: -20px; top: -20px; }
</style>