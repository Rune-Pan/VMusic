import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import NavBar from '@/components/NavBar.vue'
import { sidebarTestState } from '@/composables/useSidebarAutoHide'

vi.mock('@/composables/useSidebarAutoHide', async () => {
  const { ref } = await import('vue')
  const state = { isAutoHideActive: ref(true), triggerWidth: ref(16), hideDelay: ref(350) }
  return { sidebarTestState: state, useSidebarAutoHide: () => state }
})
vi.mock('@/composables/useTheme', async () => {
  const { ref } = await import('vue')
  return { useTheme: () => ({ theme: ref('light'), toggleTheme: vi.fn() }) }
})
vi.mock('@/stores/user', () => ({ useUserStore: () => ({ avatarUrl: '' }) }))
vi.mock('@/stores/music', () => ({ useMusicStore: () => ({ searchKeyword: '' }) }))
vi.mock('@/stores/ui', () => ({ useUiStore: () => ({}) }))

let wrapper
beforeEach(() => {
  vi.useFakeTimers()
  sidebarTestState.isAutoHideActive.value = true
  sidebarTestState.hideDelay.value = 350
})
afterEach(() => {
  wrapper?.unmount()
  document.body.replaceChildren()
})
async function open() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: ['/', '/profile', '/toplist', '/daily-recommend'].map(path => ({
      path, component: { template: '<div />' }
    }))
  })
  await router.push('/')
  wrapper = mount(NavBar, {
    attachTo: document.body,
    global: { plugins: [router], stubs: { GlassSurface: { template: '<aside><slot /></aside>' } } }
  })
  await nextTick()
}
const expanded = () => wrapper.classes().includes('sidebar-open')
async function advance(ms) { vi.advanceTimersByTime(ms); await nextTick() }

it('触发区停留100ms展开，跨间隙移入面板保持，离开350ms收起', async () => {
  await open()
  const trigger = wrapper.get('.sidebar-trigger')
  const panel = wrapper.get('.sidebar-region')
  expect(expanded()).toBe(false)
  await trigger.trigger('pointerenter')
  await advance(99)
  expect(expanded()).toBe(false)
  await advance(1)
  expect(expanded()).toBe(true)
  await trigger.trigger('pointerleave')
  await panel.trigger('pointerenter')
  await advance(1000)
  expect(expanded()).toBe(true)
  await panel.trigger('pointerleave')
  await advance(349)
  expect(expanded()).toBe(true)
  await advance(1)
  expect(expanded()).toBe(false)
})

it('快速划过不会展开，隐藏等待期间移回取消收起', async () => {
  await open()
  const trigger = wrapper.get('.sidebar-trigger')
  await trigger.trigger('pointerenter')
  await advance(50)
  await trigger.trigger('pointerleave')
  await advance(500)
  expect(expanded()).toBe(false)
  await trigger.trigger('pointerenter')
  await advance(100)
  await trigger.trigger('pointerleave')
  await advance(200)
  await trigger.trigger('pointerenter')
  await advance(500)
  expect(expanded()).toBe(true)
})

it('键盘立即唤出并保持，焦点离开后按延时隐藏', async () => {
  await open()
  const link = wrapper.get('.nav-link')
  vi.spyOn(link.element, 'matches').mockReturnValue(true)
  await link.trigger('focusin')
  expect(expanded()).toBe(true)
  await advance(1000)
  expect(expanded()).toBe(true)
  await link.trigger('focusout', { relatedTarget: document.body })
  await advance(350)
  expect(expanded()).toBe(false)
})

it('鼠标点击残留焦点不阻止离开后隐藏', async () => {
  await open()
  const panel = wrapper.get('.sidebar-region')
  await panel.trigger('pointerenter')
  await advance(100)
  const link = wrapper.get('.nav-link')
  vi.spyOn(link.element, 'matches').mockReturnValue(false)
  await link.trigger('focusin')
  await link.trigger('pointerdown')
  await panel.trigger('pointerleave')
  await advance(350)
  expect(expanded()).toBe(false)
})

it('关闭或设备能力改变时移除触发区并清理计时器', async () => {
  await open()
  await wrapper.get('.sidebar-trigger').trigger('pointerenter')
  sidebarTestState.isAutoHideActive.value = false
  await nextTick()
  expect(wrapper.find('.sidebar-trigger').exists()).toBe(false)
  expect(wrapper.classes()).not.toContain('auto-hide')
  expect(vi.getTimerCount()).toBe(0)
})

it('隐藏延时修改即时生效；卸载清理未结束的定时器', async () => {
  await open()
  await wrapper.get('.sidebar-trigger').trigger('pointerenter')
  await advance(100)
  await wrapper.get('.sidebar-trigger').trigger('pointerleave')
  sidebarTestState.hideDelay.value = 0
  await nextTick()
  await advance(0)
  expect(expanded()).toBe(false)
  await wrapper.get('.sidebar-trigger').trigger('pointerenter')
  wrapper.unmount()
  wrapper = null
  expect(vi.getTimerCount()).toBe(0)
})
