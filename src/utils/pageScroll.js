export function getPageScrollContainer() {
  return document.querySelector('.desktop-shell > .main-content')
}

export function scrollPageTo(options) {
  const container = getPageScrollContainer()
  if (container) container.scrollTo(options)
  else window.scrollTo(options)
}

let pendingPosition = null

export function cancelPageScroll() {
  pendingPosition = null
}

export function restorePageScroll() {
  if (!pendingPosition) return
  const container = getPageScrollContainer()
  // The outgoing page is still present during the route's out-in transition.
  if (container?.querySelector(':scope > .fade-leave-active')) return
  scrollPageTo({ ...pendingPosition, behavior: 'instant' })
  if (!container || Math.abs(container.scrollTop - pendingPosition.top) < 1) {
    pendingPosition = null
  }
}

export function queuePageScroll(position) {
  pendingPosition = position
  restorePageScroll()
}
