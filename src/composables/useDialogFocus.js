import { nextTick, onMounted, onBeforeUnmount } from 'vue'

const dialogs = []
const selector =
  'button:not([disabled]), a[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function useDialogFocus(target, enabled) {
  let dialog
  let previousFocus
  let stableTrigger
  const controls = () =>
    [...dialog.querySelectorAll(selector)].filter(
      element =>
        element.getClientRects().length &&
        getComputedStyle(element).visibility !== 'hidden'
    )
  function trapTab(event) {
    if (event.key !== 'Tab' || dialogs.at(-1) !== dialog) return
    const items = controls()
    const first = items[0] || dialog
    const last = items.at(-1) || dialog
    const outside = !dialog.contains(document.activeElement)
    if (
      outside ||
      !items.length ||
      (event.shiftKey
        ? document.activeElement === first
        : document.activeElement === last)
    ) {
      event.preventDefault()
      ;(event.shiftKey ? last : first).focus({ preventScroll: true })
    }
  }
  onMounted(async () => {
    if (!enabled()) return
    await nextTick()
    dialog = target.value
    if (!dialog) return
    previousFocus = document.activeElement
    stableTrigger = previousFocus
      ?.closest('[data-dialog-return]')
      ?.querySelector('button')
    dialogs.push(dialog)
    window.addEventListener('keydown', trapTab, true)
    ;(
      dialog.querySelector('[data-dialog-initial]') ||
      controls()[0] ||
      dialog
    ).focus({ preventScroll: true })
  })
  onBeforeUnmount(() => {
    if (!dialog) return
    const wasTop = dialogs.at(-1) === dialog
    const index = dialogs.indexOf(dialog)
    if (index >= 0) dialogs.splice(index, 1)
    window.removeEventListener('keydown', trapTab, true)
    if (wasTop) {
      const destination = previousFocus?.isConnected
        ? previousFocus
        : stableTrigger?.isConnected
          ? stableTrigger
          : dialogs.at(-1)
      destination?.focus({ preventScroll: true })
    }
  })
}
