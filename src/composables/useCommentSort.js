import { readonly, ref } from 'vue'
import { COMMENT_SORT_OPTIONS, STORAGE_KEYS } from '@/constants'

function restore() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.COMMENT_SORT)
    return (
      COMMENT_SORT_OPTIONS.find(option => String(option.value) === saved)
        ?.value || 3
    )
  } catch {
    return 3
  }
}

const sortType = ref(restore())

function setSort(value) {
  if (!COMMENT_SORT_OPTIONS.some(option => option.value === value)) return
  sortType.value = value
  localStorage.setItem(STORAGE_KEYS.COMMENT_SORT, String(value))
}

export function useCommentSort() {
  return { sortType: readonly(sortType), setSort }
}
