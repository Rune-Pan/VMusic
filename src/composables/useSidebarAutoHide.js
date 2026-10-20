import { computed, reactive, ref, toRefs } from 'vue'
import { STORAGE_KEYS } from '@/constants'

const defaults = { enabled: false, triggerWidth: 16, hideDelay: 350 }

function normalize(value) {
  return {
    enabled: typeof value?.enabled === 'boolean' ? value.enabled : defaults.enabled,
    triggerWidth:
      Number.isInteger(value?.triggerWidth) && value.triggerWidth >= 4 &&
      value.triggerWidth <= 48 && value.triggerWidth % 4 === 0
        ? value.triggerWidth : defaults.triggerWidth,
    hideDelay:
      Number.isInteger(value?.hideDelay) && value.hideDelay >= 0 &&
      value.hideDelay <= 1500 && value.hideDelay % 50 === 0
        ? value.hideDelay : defaults.hideDelay
  }
}

function restore() {
  try {
    return normalize(JSON.parse(localStorage.getItem(STORAGE_KEYS.SIDEBAR_AUTO_HIDE)))
  } catch {
    return { ...defaults }
  }
}

const preferences = reactive(restore())
const hoverQuery = window.matchMedia?.('(any-hover: hover) and (any-pointer: fine)')
const supportsHover = ref(hoverQuery?.matches ?? false)
const isAutoHideActive = computed(() => preferences.enabled && supportsHover.value)
function onHoverChange(event) {
  supportsHover.value = event.matches
}
hoverQuery?.addEventListener('change', onHoverChange)
if (import.meta.hot) {
  import.meta.hot.dispose(() => hoverQuery?.removeEventListener('change', onHoverChange))
}

function update(patch) {
  Object.assign(preferences, normalize({ ...preferences, ...patch }))
  localStorage.setItem(STORAGE_KEYS.SIDEBAR_AUTO_HIDE, JSON.stringify(preferences))
}

export function useSidebarAutoHide() {
  return {
    ...toRefs(preferences),
    isAutoHideActive,
    setEnabled: value => update({ enabled: value }),
    setTriggerWidth: value => update({ triggerWidth: value }),
    setHideDelay: value => update({ hideDelay: value })
  }
}
