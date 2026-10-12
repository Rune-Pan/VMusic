import { watch, onBeforeUnmount } from 'vue'

// 当前可见弹窗栈：后入的为最上层，ESC 只关栈顶
const stack = []

function onKeydown(e) {
  if (e.key !== 'Escape') return
  // 找栈顶 visible 的弹窗
  for (let i = stack.length - 1; i >= 0; i--) {
    const item = stack[i]
    if (item.isVisible()) {
      e.stopPropagation()
      item.onClose()
      return
    }
  }
}

let listenerAttached = false
function ensureListener() {
  if (listenerAttached) return
  window.addEventListener('keydown', onKeydown, true)
  listenerAttached = true
}

// 注册 ESC 关闭
// isVisible: 返回当前是否可见的 getter（props.visible 或内部 ref.value）
// onClose: ESC 触发时的关闭回调
export function useEscClose(isVisible, onClose) {
  const item = {
    isVisible: () => isVisible() === true,
    onClose
  }

  const push = () => {
    stack.push(item)
    ensureListener()
  }
  const remove = () => {
    const idx = stack.indexOf(item)
    if (idx !== -1) stack.splice(idx, 1)
  }

  watch(
    () => isVisible(),
    visible => {
      if (visible) push()
      else remove()
    },
    { immediate: true }
  )

  onBeforeUnmount(remove)
}
