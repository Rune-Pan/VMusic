<script setup>
  import GlassSurface from '@/components/GlassSurface.vue'
  import { useUiStore } from '@/stores/ui'
  import { useEscClose } from '@/composables/useEscClose'

  const uiStore = useUiStore()

  function handleConfirm() {
    uiStore.resolveConfirm(true)
  }

  function handleCancel() {
    uiStore.resolveConfirm(false)
  }

  // ESC 等同取消（点遮罩/取消按钮的效果）
  useEscClose(() => uiStore.confirmDialog.visible, handleCancel)
</script>

<template>
  <transition name="fade">
    <div
      v-if="uiStore.confirmDialog.visible"
      class="overlay"
      @click.self="handleCancel"
    >
      <transition name="slide-up" appear>
        <GlassSurface
          v-if="uiStore.confirmDialog.visible"
          class="dialog"
          modal
          :label="uiStore.confirmDialog.title"
        >
          <h3 class="title">{{ uiStore.confirmDialog.title }}</h3>
          <p class="message">{{ uiStore.confirmDialog.message }}</p>
          <div class="actions">
            <button
              class="btn btn-cancel"
              data-dialog-initial
              @click="handleCancel"
            >
              {{ uiStore.confirmDialog.cancelText }}
            </button>
            <button class="btn btn-confirm" @click="handleConfirm">
              {{ uiStore.confirmDialog.confirmText }}
            </button>
          </div>
        </GlassSurface>
      </transition>
    </div>
  </transition>
</template>

<style scoped>
  .overlay {
    position: fixed;
    inset: 0;
    background: var(--color-overlay);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    z-index: var(--z-modal);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-md);
  }

  .dialog {
    width: 100%;
    max-width: 400px;
    background: var(--color-modal-bg);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-xl);
    padding: var(--spacing-xl);
  }

  .title {
    font-size: 18px;
    font-weight: 700;
    color: var(--color-text);
    margin-bottom: var(--spacing-sm);
  }

  .message {
    font-size: 14px;
    color: var(--color-text-secondary);
    line-height: 1.6;
    margin-bottom: var(--spacing-xl);
  }

  .actions {
    display: flex;
    gap: var(--spacing-sm);
    justify-content: flex-end;
  }

  .btn {
    padding: var(--spacing-sm) var(--spacing-lg);
    border-radius: var(--radius-md);
    font-size: 14px;
    font-weight: 500;
    transition: all var(--transition-fast);
  }

  .btn-cancel {
    color: var(--color-text-secondary);
    border: 1px solid var(--color-border);
  }

  .btn-cancel:hover {
    background: var(--color-secondary-bg-hover);
    color: var(--color-text);
  }

  .btn-confirm {
    background: var(--color-primary);
    color: #ffffff;
  }

  .btn-confirm:hover {
    background: var(--color-primary-hover);
  }
</style>
