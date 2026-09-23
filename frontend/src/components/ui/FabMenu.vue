<script setup>
const emit = defineEmits(['scan']);

function handleClick() {
  emit('scan');
}
</script>

<template>
  <div class="fab-menu">
    <button
      class="fab-main"
      type="button"
      @click="handleClick"
      aria-label="Сканировать чек"
      title="Сканировать чек"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" class="fab-icon">
        <!-- Иконка фотоаппарата / сканера -->
        <path d="M9 3 7.17 5H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3.17L15 3H9zm3 15a5 5 0 1 1 0-10 5 5 0 0 1 0 10z"/>
      </svg>
    </button>
  </div>
</template>

<style scoped lang="scss">
/* ✅ FAB работает ВЕЗДЕ (и ПК, и мобильные) */
.fab-menu {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 100;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
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
  transition: transform 0.2s cubic-bezier(.34,1.56,.64,1), box-shadow 0.2s;

  &:hover {
    box-shadow: 0 14px 34px -10px rgba(59, 130, 246, 0.9);
    transform: translateY(-2px);
  }

  &:active { transform: scale(0.92); }
}

.fab-icon {
  width: 26px;
  height: 26px;
}

/* ============================================================
   МОБИЛЬНЫЙ — учитываем safe-area
   ============================================================ */
@media (max-width: 700px) {
  .fab-menu {
    right: 16px;
    bottom: calc(16px + env(safe-area-inset-bottom, 0));
  }
}
</style>