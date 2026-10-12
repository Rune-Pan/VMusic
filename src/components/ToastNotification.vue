<script setup>
  import { CheckCircle, AlertCircle, XCircle, X } from '@lucide/vue'
  import { useUiStore } from '@/stores/ui'

  const uiStore = useUiStore()

  const iconMap = {
    success: CheckCircle,
    warning: AlertCircle,
    error: XCircle
  }

  const colorMap = {
    success: 'var(--color-success)',
    warning: 'var(--color-warning)',
    error: 'var(--color-error)'
  }
</script>

<template>
  <div class="toast-container">
    <transition-group name="slide-down">
      <div v-for="toast in uiStore.toasts" :key="toast.id" class="toast">
        <component
          :is="iconMap[toast.type]"
          :size="20"
          :color="colorMap[toast.type]"
        />
        <span class="message">{{ toast.message }}</span>
        <button class="close-btn" @click="uiStore.removeToast(toast.id)">
          <X :size="16" />
        </button>
      </div>
    </transition-group>
  </div>
</template>

<style scoped>
  .toast-container {
    position: fixed;
    top: 80px;
    left: 50%;
    transform: translateX(-50%);
    z-index: var(--z-toast);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    pointer-events: none;
  }

  .toast {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--color-toast-bg);
    backdrop-filter: blur(16px) saturate(180%);
    -webkit-backdrop-filter: blur(16px) saturate(180%);
    border: 1px solid var(--color-toast-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-xl);
    pointer-events: auto;
    min-width: 280px;
    max-width: min(480px, calc(100vw - 48px));
  }

  .message {
    flex: 1;
    font-size: 14px;
    color: var(--color-text);
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    margin: -4px -8px -4px 0;
    padding: 0;
    color: var(--color-text-muted);
    background: transparent;
    border: none;
    border-radius: var(--radius-full);
    cursor: pointer;
    transition:
      color var(--transition-fast),
      background-color var(--transition-fast);
  }

  .close-btn:hover {
    color: var(--color-text);
    background: var(--color-secondary-bg-transparent);
  }
</style>
