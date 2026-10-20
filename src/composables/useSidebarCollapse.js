import { ref } from 'vue'
import { STORAGE_KEYS } from '@/constants'

const collapsed = ref(localStorage.getItem(STORAGE_KEYS.SIDEBAR_COLLAPSED) === 'true')

function setCollapsed(value) {
  collapsed.value = value === true
  localStorage.setItem(STORAGE_KEYS.SIDEBAR_COLLAPSED, JSON.stringify(collapsed.value))
}

export function useSidebarCollapse() {
  return { collapsed, setCollapsed }
}
