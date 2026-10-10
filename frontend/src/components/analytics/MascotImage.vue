<!-- frontend/src/components/analytics/MascotImage.vue -->
<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  /** Имя файла без пути: 'finn-hero', 'piggy', 'shield' */
  name: { type: String, required: true },
  /** Позиция: 'left' | 'right' | 'hero-left' | 'hero-right' | 'background' | 'floating' | 'corner' */
  position: { type: String, default: 'left' },
  /** Размер на экране в px (по умолчанию зависит от позиции) */
  size: { type: Number, default: 0 },
  /** Эмодзи-fallback, если PNG не загрузится */
  fallback: { type: String, default: '🪙' },
  /** Alt-текст */
  alt: { type: String, default: '' },
  /** Принудительно отзеркалить */
  flip: { type: Boolean, default: false },
});

const loaded = ref(false);
const failed = ref(false);

const src = computed(() => `/img/mascots/${props.name}.png`);

const defaultSizes = {
  left: 120,
  right: 100,
  'hero-left': 180,
  'hero-right': 180,
  background: 280,
  floating: 80,
  corner: 90,
};

const px = computed(() => props.size || defaultSizes[props.position] || 120);

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
  will-change: transform;
  transform: translateZ(0);
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

/* ============================================================
   ПОЗИЦИИ
   ============================================================ */
.mascot--left {
  left: -20px;
  bottom: -10px;
  animation: mascotFloat 4s ease-in-out infinite;
}

.mascot--right {
  right: -20px;
  bottom: -10px;
  animation: mascotFloat 4s ease-in-out infinite;
}

.mascot--hero-left {
  left: -30px;
  bottom: -20px;
  animation: mascotFloat 5s ease-in-out infinite;
}

.mascot--hero-right {
  right: -30px;
  bottom: -20px;
  animation: mascotFloat 5s ease-in-out infinite;
}

.mascot--background {
  right: -40px;
  bottom: -30px;
  opacity: 0.35;
  z-index: 0;
  animation: mascotFloat 6s ease-in-out infinite;
  filter: blur(0.5px);
}

.mascot--floating {
  right: 12px;
  top: 12px;
  animation: mascotFloatSmall 3s ease-in-out infinite;
}

.mascot--corner {
  right: -10px;
  top: -10px;
  animation: mascotPeek 5s ease-in-out infinite;
}

@keyframes mascotFloat {
  0%, 100% { transform: translateY(0) rotate(-2deg); }
  50%      { transform: translateY(-6px) rotate(2deg); }
}

@keyframes mascotFloatSmall {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50%      { transform: translateY(-4px) rotate(-3deg); }
}

@keyframes mascotPeek {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  50%      { transform: translate(-4px, 4px) rotate(-4deg); }
}

@media (prefers-reduced-motion: reduce) {
  .mascot { animation: none !important; }
}
</style>