<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useAccountsStore } from '@/stores/accounts';
import { fmt } from '@/composables/useFormat';

const emit = defineEmits(['reconcile']);
const accounts = useAccountsStore();

// ── Состояние 1: раскрыта ли вся секция ──
const LS_KEY_SECTION = 'financeProAccountsSection_v1';
const sectionOpen = ref(false);

// ── Состояние 2: раскрыты ли чипы владельца ──
const LS_KEY_CHIPS = 'financeProAccountsExpanded_v1';
const expandedByOwner = ref({});

onMounted(() => {
  try {
    if (localStorage.getItem(LS_KEY_SECTION) === '1') sectionOpen.value = true;
    const raw = localStorage.getItem(LS_KEY_CHIPS);
    expandedByOwner.value = raw ? JSON.parse(raw) : {};
  } catch (e) {}
});

watch(sectionOpen, (val) => {
  try { localStorage.setItem(LS_KEY_SECTION, val ? '1' : '0'); } catch (e) {}
});

watch(expandedByOwner, (val) => {
  try { localStorage.setItem(LS_KEY_CHIPS, JSON.stringify(val)); } catch (e) {}
}, { deep: true });

// ── Действия ──
function toggleSection() {
  sectionOpen.value = !sectionOpen.value;
}

function toggleOwnerChips(owner, e) {
  e.stopPropagation();
  expandedByOwner.value = {
    ...expandedByOwner.value,
    [owner]: !expandedByOwner.value[owner],
  };
}

function isChipsOpen(owner) {
  return !!expandedByOwner.value[owner];
}

function ownerTotal(list) {
  return list.reduce((s, a) => s + (Number(a.value) || 0), 0);
}

function diffText(id) {
  const d = accounts.diffByAccount?.[id];
  if (!d) return '—';
  if (!d.hasDiff) return '✅ сходится';
  const sign = d.diff > 0 ? '+' : '−';
  return `⚠️ ${sign}${fmt(Math.abs(d.diff))} ₽`;
}

function diffClass(id) {
  const d = accounts.diffByAccount?.[id];
  if (!d) return '';
  if (!d.hasDiff) return 'ok';
  return d.diff > 0 ? 'pos' : 'neg';
}

function bankLogo(id) {
  if (!id) return null;
  if (id.startsWith('sber')) return '/img/sber.png';
  if (id.startsWith('tbank')) return '/img/tbank.png';
  return null;
}
</script>

<template>
  <section class="accounts-block" :class="{ 'section-open': sectionOpen }">
    <!-- ═══ Кликабельный заголовок: раскрывает всю секцию ═══ -->
    <header class="ab-head" @click="toggleSection">
      <h3>💳 Наши счета</h3>
      <div class="ab-total">{{ fmt(accounts.total) }} ₽</div>
      <button
        class="ab-section-arrow"
        type="button"
        :aria-label="sectionOpen ? 'Свернуть счета' : 'Развернуть счета'"
      >
        <svg viewBox="0 0 24 24" class="chev">
          <path d="M7 10l5 5 5-5z"/>
        </svg>
      </button>
    </header>

    <!-- ═══ Компактные строки владельцев (всегда видны) ═══ -->
    <div class="ab-rows">
      <div
        v-for="(list, owner) in accounts.byOwner"
        :key="owner"
        class="ab-row"
        :class="{
          open: isChipsOpen(owner),
          sergey: owner === 'Сергей',
          sasha: owner === 'Саша',
        }"
      >
        <span class="ab-row-owner">
          <span class="emoji">{{ owner === 'Сергей' ? '👨' : '👩' }}</span>
          {{ owner }}
        </span>

        <!-- Чипы (показываются при клике на стрелку владельца) -->
        <span class="ab-row-chips">
          <span
            v-for="acc in list"
            :key="acc.id"
            class="ab-chip"
            :class="acc.id.startsWith('sber') ? 'sber' : 'tbank'"
          >
            <img
              v-if="bankLogo(acc.id)"
              :src="bankLogo(acc.id)"
              class="ab-chip-logo"
              :alt="acc.name"
            />
            <span class="ab-chip-sum">{{ fmt(acc.value) }} ₽</span>
          </span>
        </span>

        <!-- Итого по владельцу -->
        <span class="ab-row-total">{{ fmt(ownerTotal(list)) }} ₽</span>

        <!-- Стрелка → раскрывает чипы этого владельца -->
        <button
          class="ab-row-arrow"
          type="button"
          :aria-label="isChipsOpen(owner) ? 'Свернуть' : 'Развернуть'"
          @click="toggleOwnerChips(owner, $event)"
        >
          <svg viewBox="0 0 24 24">
            <path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- ═══ Развёрнутая секция со счетами и «Сверить» ═══ -->
    <div class="ab-expanded">
      <div v-for="(list, owner) in accounts.byOwner" :key="owner" class="ab-group">
        <div class="ab-group-title">
          <span class="emoji">{{ owner === 'Сергей' ? '👨' : '👩' }}</span>
          {{ owner }}
        </div>

        <div class="ab-cards">
          <div
            v-for="acc in list"
            :key="acc.id"
            class="account-card"
            :class="acc.id.startsWith('sber') ? 'sber' : 'tbank'"
          >
            <div class="acc-head">
              <img
                v-if="bankLogo(acc.id)"
                :src="bankLogo(acc.id)"
                class="account-logo-img"
                :alt="acc.name"
              />
              <span v-else class="account-logo-fallback">
                {{ acc.id.startsWith('sber') ? 'С' : 'Т' }}
              </span>
              <span class="account-name-text">{{ acc.name }}</span>
            </div>

            <div class="acc-balance">
              <span class="label">Текущий:</span>
              <span class="value">{{ fmt(acc.value) }} ₽</span>
            </div>

            <div class="acc-diff" :class="diffClass(acc.id)">
              {{ diffText(acc.id) }}
            </div>

            <button
              class="acc-reconcile-btn"
              @click.stop="emit('reconcile', acc)"
              type="button"
            >
              ⚖️ Сверить
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.accounts-block {
  padding: 14px 16px;
  background:
    linear-gradient(180deg, rgba(56, 189, 248, 0.06), transparent 60%),
    rgba(255, 255, 255, 0.9);
  border: 1px solid var(--border);
  border-radius: 16px;
  box-shadow: var(--shadow-md);
  transition: padding 0.25s ease, box-shadow 0.25s;

  &:hover { box-shadow: var(--shadow-lg); }
  &:not(.section-open) { padding-bottom: 14px; }
}

/* ─────────── Заголовок ─────────── */
.ab-head {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 10px;
  cursor: pointer;
  user-select: none;

  h3 {
    font-size: 12px;
    color: var(--accent);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin: 0;
    font-weight: 700;
    flex-shrink: 0;
  }
}

.ab-total {
  padding: 4px 12px;
  border-radius: 999px;
  background: linear-gradient(135deg, rgba(56, 189, 248, 0.14), rgba(139, 92, 246, 0.1));
  border: 1px solid rgba(56, 189, 248, 0.28);
  font-family: var(--mono);
  font-size: 13px;
  font-weight: 800;
  color: var(--accent);
  white-space: nowrap;
  margin-left: auto;

  &::before {
    content: "💰 ";
    font-size: 12px;
  }
}

.ab-section-arrow {
  background: #f1f5f9;
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--muted);
  width: 28px;
  height: 28px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  flex-shrink: 0;
  transition: all 0.15s;

  &:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  .chev {
    width: 14px;
    height: 14px;
    fill: currentColor;
    transform: rotate(180deg);
    transition: transform 0.3s cubic-bezier(.34,1.56,.64,1);
  }
}

.accounts-block.section-open .ab-section-arrow .chev {
  transform: rotate(0deg);
}

/* ─────────── Строки владельцев ─────────── */
.ab-rows {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ab-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  margin: 0 -8px;
  border-radius: 10px;
  min-width: 0;
  transition: background 0.2s ease;

  &.sergey.open, &.sasha.open {
    background: linear-gradient(90deg, rgba(56, 189, 248, 0.14), rgba(139, 92, 246, 0.06) 60%, transparent 100%);
  }
}

.ab-row-owner {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 700;
  color: var(--text);
  white-space: nowrap;
  flex-shrink: 0;
  min-width: 54px;

  .emoji { font-size: 13px; }
}

/* ─── Чипы: разворачиваются по клику на стрелку владельца ─── */
.ab-row-chips {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-left: 8px;
  margin-right: auto;
  min-width: 0;
  max-width: 0;
  opacity: 0;
  overflow: hidden;
  pointer-events: none;
  flex-shrink: 0;
  transition:
    max-width 0.3s cubic-bezier(.22,.61,.36,1),
    opacity 0.22s ease;
}

.ab-row.open .ab-row-chips {
  max-width: 500px;
  opacity: 1;
  pointer-events: auto;
}

.ab-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px 3px 4px;
  border-radius: 999px;
  border: 1px solid transparent;
  white-space: nowrap;
  flex-shrink: 0;

  &.sber {
    background: rgba(33, 160, 56, 0.14);
    border-color: rgba(33, 160, 56, 0.35);
    .ab-chip-sum { color: #15803d; }
  }

  &.tbank {
    background: rgba(255, 221, 45, 0.22);
    border-color: rgba(255, 191, 36, 0.45);
    .ab-chip-sum { color: #b45309; }
  }
}

.ab-chip-logo {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  object-fit: contain;
  background: #fff;
  padding: 1px;
  box-sizing: border-box;
}

.ab-chip-sum {
  font-family: var(--mono);
  font-size: 12px;
  font-weight: 700;
}

/* ─── Итого по владельцу ─── */
.ab-row-total {
  margin-left: auto;
  margin-right: 4px;
  padding: 3px 10px;
  border-radius: 999px;
  background: linear-gradient(135deg, rgba(56, 189, 248, 0.14), rgba(139, 92, 246, 0.1));
  border: 1px solid rgba(56, 189, 248, 0.28);
  font-family: var(--mono);
  font-size: 12px;
  font-weight: 800;
  color: var(--accent);
  white-space: nowrap;
  flex-shrink: 0;
  transition:
    max-width 0.3s cubic-bezier(.22,.61,.36,1),
    opacity 0.22s ease,
    padding 0.3s cubic-bezier(.22,.61,.36,1),
    margin 0.3s cubic-bezier(.22,.61,.36,1),
    border-width 0.3s;
}

.ab-row.open .ab-row-total {
  max-width: 0;
  opacity: 0;
  padding-left: 0;
  padding-right: 0;
  margin-left: 0;
  margin-right: 0;
  border-width: 0;
  overflow: hidden;
  pointer-events: none;
}

/* ─── Стрелка владельца ─── */
.ab-row-arrow {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  padding: 0;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: #f8fafc;
  color: var(--muted);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;

  svg {
    width: 12px;
    height: 12px;
    fill: currentColor;
    transform: rotate(180deg);
    transition: transform 0.3s cubic-bezier(.34,1.56,.64,1);
  }

  &:hover {
    color: var(--accent);
    border-color: var(--accent);
    background: rgba(56, 189, 248, 0.1);
  }
}

.ab-row.open .ab-row-arrow svg {
  transform: rotate(0deg);
}

/* ─────────── Развёрнутая секция ─────────── */
.ab-expanded {
  max-height: 0;
  overflow: hidden;
  opacity: 0;
  margin-top: 0;
  transition:
    max-height 0.4s ease,
    opacity 0.3s ease,
    margin 0.3s ease;
}

.accounts-block.section-open .ab-expanded {
  max-height: 2000px;
  opacity: 1;
  margin-top: 14px;
}

.ab-group {
  margin-bottom: 14px;
  &:last-child { margin-bottom: 0; }
}

.ab-group-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 700;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 6px;

  .emoji { font-size: 13px; }
}

.ab-cards {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}

/* ─── Карточка счёта ─── */
.account-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: #fff;
  transition: transform 0.15s, box-shadow 0.15s;

  &:hover {
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }
}

.acc-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.account-logo-img {
  width: 28px;
  height: 28px;
  object-fit: contain;
  border-radius: 6px;
  background: #fff;
  padding: 2px;
  box-sizing: border-box;
}

.account-logo-fallback {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 800;
  color: #fff;
  background: #21a038;
}

.account-name-text {
  font-weight: 700;
  font-size: 13px;
  color: var(--text);
}

.acc-balance {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 13px;

  .label { color: var(--muted); font-weight: 500; }
  .value {
    font-family: var(--mono);
    font-weight: 800;
    font-size: 15px;
    color: var(--text);
    letter-spacing: -0.02em;
  }
}

.acc-diff {
  font-size: 11.5px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 8px;
  width: fit-content;

  &.ok  { background: rgba(34, 197, 94, 0.12); color: #16a34a; }
  &.pos { background: rgba(34, 197, 94, 0.12); color: #16a34a; }
  &.neg { background: rgba(239, 68, 68, 0.12); color: #dc2626; }
}

.acc-reconcile-btn {
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: #f8fafc;
  color: var(--text);
  font-family: inherit;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    border-color: var(--accent);
    color: var(--accent);
    background: rgba(56, 189, 248, 0.08);
  }

  &:active { transform: scale(0.97); }
}
</style>