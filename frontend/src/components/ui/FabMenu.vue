<script setup>
import { ref } from 'vue';

const emit = defineEmits(['manual', 'scan', 'pdf']);

const open = ref(false);

function toggle() {
  open.value = !open.value;
}

function close() {
  open.value = false;
}

function pick(action) {
  close();
  emit(action);
}
</script>

<template>
  <div class="fab-menu" :class="{ open }">
    <Transition name="fab-options">
      <div v-if="open" class="fab-options">
        <button class="fab-option" @click="pick('manual')">
          <span class="icon">✏️</span> Вручную
        </button>
        <button class="fab-option" @click="pick('scan')">
          <span class="icon">📸</span> Чек
        </button>
        <button class="fab-option" @click="pick('pdf')">
          <span class="icon">📄</span> PDF-выписка
        </button>
      </div>
    </Transition>

    <button class="fab-main" @click="toggle" :aria-label="open ? 'Закрыть' : 'Добавить операцию'">
      <svg viewBox="0 0 24 24" fill="currentColor" class="fab-icon">
        <path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5z"/>
      </svg>
    </button>
  </div>
</template>

<style scoped lang="scss">
/* FAB — только на мобильных */
.fab-menu {
  display: none;
}

@media (max-width: 700px) {
  .fab-menu {
    display: flex;
    position: fixed;
    right: 16px;
    bottom: calc(16px + env(safe-area-inset-bottom, 0));
    z-index: 100;
    flex-direction: column;
    align-items: flex-end;
    gap: 12px;
  }

  .fab-options {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 10px;
  }

  .fab-option {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 11px 16px 11px 14px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: #ffffff;
    color: var(--text);
    font-family: inherit;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 10px 24px -10px rgba(0, 0, 0, 0.4);
    white-space: nowrap;
    transition: all 0.15s;

    &:active {
      transform: scale(0.95);
    }

    .icon { font-size: 16px; }
  }

  .fab-main {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    border: none;
    background: linear-gradient(135deg, #3b82f6, #8b5cf6);
    color: #fff;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 10px 28px -8px rgba(59, 130, 246, 0.75);
    transition: transform 0.3s cubic-bezier(.34,1.56,.64,1);

    &:active { transform: scale(0.92); }
  }

  .fab-icon {
    width: 26px;
    height: 26px;
    transition: transform 0.3s cubic-bezier(.34,1.56,.64,1);
  }

  .fab-menu.open .fab-icon {
    transform: rotate(45deg);
  }
}

/* Анимация появления опций */
.fab-options-enter-active,
.fab-options-leave-active {
  transition: all 0.25s cubic-bezier(.34,1.56,.64,1);
}
.fab-options-enter-from,
.fab-options-leave-to {
  opacity: 0;
  transform: translateY(12px) scale(0.9);
}
</style>