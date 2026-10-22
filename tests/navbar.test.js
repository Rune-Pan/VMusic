import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia, disposePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { ref } from 'vue'
import NavBar from '@/components/NavBar.vue'
import { useSidebarCollapse } from '@/composables/useSidebarCollapse'

vi.mock('@/composables/useTheme', () => ({
  useTheme: () => ({ theme: ref('light'), toggleTheme: vi.fn() })
}))

let pinia, wrapper, router
beforeEach(() => {
  useSidebarCollapse().setCollapsed(false)
  localStorage.clear()
  pinia = createPinia()
  setActivePinia(pinia)
})
afterEach(() => {
  wrapper?.unmount()
  disposePinia(pinia)
})

async function open(path = '/') {
  const routes = [
    ['/', 'home'],
    ['/daily-recommend', 'daily-recommend'],
    ['/toplist', 'toplist'],
    ['/profile', 'profile'],
    ['/playlist/:id', 'playlist']
  ]
  router = createRouter({
    history: createMemoryHistory(),
    routes: routes.map(([path, name]) => ({
      path,
      name,
      component: { template: '<div />' }
    }))
  })
  await router.push(path)
  await router.isReady()
  wrapper = mount(NavBar, {
    global: {
      plugins: [pinia, router],
      stubs: { GlassSurface: { template: '<aside><slot /></aside>' } }
    }
  })
  await flushPromises()
}

it.each([
  ['/', '首页'],
  ['/daily-recommend', '每日推荐'],
  ['/toplist', '排行榜'],
  ['/profile', '个人中心']
])('短面板保留入口 %s 的跳转及当前页语义', async (path, label) => {
  await open('/playlist/1')
  expect(wrapper.findAll('.nav-link')).toHaveLength(4)
  await wrapper.get(`.nav-link[href="${path}"]`).trigger('click')
  await flushPromises()
  expect(router.currentRoute.value.path).toBe(path)
  const active = wrapper.findAll('[aria-current="page"]')
  expect(active).toHaveLength(1)
  expect(active[0].text()).toBe(label)
})

it('侧栏仅保留四个导航入口，不显示顶部品牌和底部标语', async () => {
  await open('/profile')
  expect(wrapper.find('.brand-home').exists()).toBe(false)
  expect(wrapper.find('[data-brand="tide"]').exists()).toBe(false)
  expect(wrapper.find('.sidebar-footer').exists()).toBe(false)
  expect(wrapper.findAll('.nav-link')).toHaveLength(4)
  await wrapper.get('.nav-link[href="/"]').trigger('click')
  await flushPromises()
  expect(router.currentRoute.value.path).toBe('/')
})

it('详情页继续不强制选中任何主导航项', async () => {
  await open('/playlist/1')
  expect(wrapper.find('[aria-current="page"]').exists()).toBe(false)
})

it.each([
  ['PageDown', 500, 850],
  ['PageUp', 500, 150],
  ['Home', 500, 0],
  ['End', 500, 2000]
])('导航焦点下 %s 继续滚动正文', async (key, start, top) => {
  const shell = document.createElement('div')
  shell.className = 'desktop-shell'
  const content = document.createElement('main')
  content.className = 'main-content'
  Object.defineProperties(content, {
    clientHeight: { value: 400 },
    scrollHeight: { value: 2000 }
  })
  content.scrollTop = start
  content.scrollTo = vi.fn()
  shell.append(content)
  document.body.append(shell)
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))
  try {
    await open('/')
    await wrapper.get('.nav-link').trigger('keydown', { key })
    expect(content.scrollTo).toHaveBeenCalledExactlyOnceWith({ top, behavior: 'auto' })
    content.scrollTo.mockClear()
    await wrapper.get('input[type="search"]').trigger('keydown', { key })
    await wrapper.get('.nav-link').trigger('keydown', { key, ctrlKey: true })
    expect(content.scrollTo).not.toHaveBeenCalled()
  } finally {
    shell.remove()
    vi.unstubAllGlobals()
  }
})


it('折叠状态保留完整入口名称、当前页语义，且仅设置控制宽窄', async () => {
  await open('/profile')
  useSidebarCollapse().setCollapsed(true)
  await flushPromises()
  expect(wrapper.classes()).toContain('collapsed')
  expect(wrapper.findAll('.nav-link').map(link => link.attributes('aria-label')))
    .toEqual(['首页', '每日推荐', '排行榜', '个人中心'])
  expect(wrapper.get('[aria-current="page"]').attributes('aria-label')).toBe('个人中心')
  expect(wrapper.findAll('.sidebar-navigation button')).toHaveLength(0)
  await wrapper.get('.nav-link[href="/daily-recommend"]').trigger('click')
  await flushPromises()
  expect(router.currentRoute.value.name).toBe('daily-recommend')
  expect(wrapper.classes()).toContain('collapsed')
})
