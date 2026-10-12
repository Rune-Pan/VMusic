import { ref } from 'vue'
import { defineStore } from 'pinia'
import { DEFAULT_TOAST_DURATION } from '@/constants'

export const useUiStore = defineStore('ui', () => {
  const confirmDialog = ref({
    visible: false,
    title: '',
    message: '',
    confirmText: '确认',
    cancelText: '取消',
    resolve: null
  })

  const toasts = ref([])
  let toastId = 0

  function showConfirm(options = {}) {
    return new Promise(resolve => {
      confirmDialog.value = {
        visible: true,
        title: options.title || '确认操作',
        message: options.message || '确定要执行此操作吗？',
        confirmText: options.confirmText || '确认',
        cancelText: options.cancelText || '取消',
        resolve
      }
    })
  }

  function resolveConfirm(result) {
    if (confirmDialog.value.resolve) {
      confirmDialog.value.resolve(result)
    }
    confirmDialog.value.visible = false
    confirmDialog.value.resolve = null
  }

  function showToast(
    message,
    type = 'success',
    duration = DEFAULT_TOAST_DURATION
  ) {
    const id = ++toastId
    toasts.value.push({ id, message, type, duration })
    setTimeout(() => {
      removeToast(id)
    }, duration)
  }

  function removeToast(id) {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }

  return {
    confirmDialog,
    toasts,
    showConfirm,
    resolveConfirm,
    showToast,
    removeToast
  }
})
