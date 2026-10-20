import { ref, watch } from 'vue'

export function useAmbientCover(source) {
  const displayedCover = ref('')
  watch(
    source,
    (url, previous, onCleanup) => {
      if (!url) {
        displayedCover.value = ''
        return
      }
      const image = new Image()
      let active = true
      image.onload = () => {
        if (active) displayedCover.value = url
      }
      image.onerror = () => {
        if (active) displayedCover.value = ''
      }
      onCleanup(() => {
        active = false
        image.onload = null
        image.onerror = null
      })
      image.src = url
    },
    { immediate: true }
  )
  return displayedCover
}
