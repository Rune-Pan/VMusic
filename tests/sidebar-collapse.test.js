import { beforeEach, expect, it, vi } from 'vitest'
import { STORAGE_KEYS } from '@/constants'

beforeEach(() => {
  vi.resetModules()
  localStorage.clear()
})

async function preferences(saved) {
  if (saved !== undefined) localStorage.setItem(STORAGE_KEYS.SIDEBAR_COLLAPSED, saved)
  const { useSidebarCollapse } = await import('@/composables/useSidebarCollapse')
  return useSidebarCollapse()
}

it('默认展开且读取偏好时不写入本机存储', async () => {
  expect((await preferences()).collapsed.value).toBe(false)
  expect(localStorage.getItem(STORAGE_KEYS.SIDEBAR_COLLAPSED)).toBeNull()
})

it.each(['{bad', 'null', '[]', '1', '"true"', ''])('无效存储默认展开：%s', async saved => {
  expect((await preferences(saved)).collapsed.value).toBe(false)
  expect(localStorage.getItem(STORAGE_KEYS.SIDEBAR_COLLAPSED)).toBe(saved)
})

it.each([['true', true], ['false', false]])('恢复已保存布尔值：%s', async (saved, value) => {
  expect((await preferences(saved)).collapsed.value).toBe(value)
})

it('多个消费者即时同步，并在重新载入模块后恢复', async () => {
  const first = await preferences()
  const { useSidebarCollapse } = await import('@/composables/useSidebarCollapse')
  const second = useSidebarCollapse()
  first.setCollapsed(true)
  expect(second.collapsed.value).toBe(true)
  expect(localStorage.getItem(STORAGE_KEYS.SIDEBAR_COLLAPSED)).toBe('true')
  vi.resetModules()
  const restored = await preferences()
  expect(restored.collapsed.value).toBe(true)
  restored.setCollapsed(false)
  expect(localStorage.getItem(STORAGE_KEYS.SIDEBAR_COLLAPSED)).toBe('false')
})

it('折叠与自动隐藏各自保存，互不覆盖参数或开关', async () => {
  const saved = JSON.stringify({ enabled: true, triggerWidth: 24, hideDelay: 500 })
  localStorage.setItem(STORAGE_KEYS.SIDEBAR_AUTO_HIDE, saved)
  const state = await preferences()
  const { useSidebarAutoHide } = await import('@/composables/useSidebarAutoHide')
  const autoHide = useSidebarAutoHide()
  state.setCollapsed(true)
  expect(localStorage.getItem(STORAGE_KEYS.SIDEBAR_AUTO_HIDE)).toBe(saved)
  autoHide.setEnabled(false)
  expect(state.collapsed.value).toBe(true)
  expect(localStorage.getItem(STORAGE_KEYS.SIDEBAR_COLLAPSED)).toBe('true')
  state.setCollapsed(false)
  expect([autoHide.enabled.value, autoHide.triggerWidth.value, autoHide.hideDelay.value]).toEqual([false, 24, 500])
})
