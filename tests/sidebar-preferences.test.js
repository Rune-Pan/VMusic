import { beforeEach, afterEach, expect, it, vi } from 'vitest'

let hoverQuery
beforeEach(() => {
  vi.resetModules()
  localStorage.clear()
  hoverQuery = { matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }
  vi.stubGlobal('matchMedia', vi.fn(() => hoverQuery))
})
afterEach(() => vi.unstubAllGlobals())

async function preferences(saved) {
  if (saved !== undefined) localStorage.setItem('vmusic-sidebar-auto-hide', saved)
  const { useSidebarAutoHide } = await import('@/composables/useSidebarAutoHide')
  return useSidebarAutoHide()
}

it('默认关闭并采用16px/350ms，不写入既有偏好', async () => {
  const state = await preferences()
  expect([state.enabled.value, state.triggerWidth.value, state.hideDelay.value])
    .toEqual([false, 16, 350])
  expect(localStorage.getItem('vmusic-sidebar-auto-hide')).toBeNull()
})

it.each(['{bad', 'null', '[]', '{"enabled":"true","triggerWidth":15,"hideDelay":-1}'])
('无效存储恢复默认值：%s', async saved => {
  const state = await preferences(saved)
  expect([state.enabled.value, state.triggerWidth.value, state.hideDelay.value])
    .toEqual([false, 16, 350])
})

it('逐字段恢复有效值，缺失字段用默认值', async () => {
  const state = await preferences('{"enabled":true,"triggerWidth":48}')
  expect(state.isAutoHideActive.value).toBe(true)
  expect(state.triggerWidth.value).toBe(48)
  expect(state.hideDelay.value).toBe(350)
})

it('多个消费者即时共享，关闭保留参数，重新载入后恢复', async () => {
  const state = await preferences()
  const { useSidebarAutoHide } = await import('@/composables/useSidebarAutoHide')
  const other = useSidebarAutoHide()
  state.setEnabled(true)
  state.setTriggerWidth(24)
  state.setHideDelay(0)
  expect(other.isAutoHideActive.value).toBe(true)
  expect(other.triggerWidth.value).toBe(24)
  state.setEnabled(false)
  expect(other.hideDelay.value).toBe(0)
  vi.resetModules()
  const restored = await preferences()
  expect([restored.enabled.value, restored.triggerWidth.value, restored.hideDelay.value])
    .toEqual([false, 24, 0])
})

it('无悬停能力时常显，能力恢复后重新使用已保存的偏好', async () => {
  hoverQuery.matches = false
  const state = await preferences('{"enabled":true,"triggerWidth":16,"hideDelay":350}')
  expect(state.enabled.value).toBe(true)
  expect(state.isAutoHideActive.value).toBe(false)
  hoverQuery.addEventListener.mock.calls[0][1]({ matches: true })
  expect(state.isAutoHideActive.value).toBe(true)
  expect(JSON.parse(localStorage.getItem('vmusic-sidebar-auto-hide')).enabled).toBe(true)
})
