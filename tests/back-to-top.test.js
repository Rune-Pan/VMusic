import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import BackToTop from '@/components/BackToTop.vue'

vi.mock('@/stores/player', () => ({
  usePlayerStore: () => ({ hasTrack: false })
}))
vi.mock('@/stores/user', () => ({
  useUserStore: () => ({ isLoggedIn: false })
}))

let wrapper, router

function addScrollContainer() {
  const shell = document.createElement('div')
  shell.className = 'desktop-shell'
  const container = document.createElement('main')
  container.className = 'main-content'
  Object.defineProperty(container, 'clientHeight', { value: 300 })
  container.scrollTo = vi.fn()
  shell.append(container)
  document.body.append(shell)
  return container
}

async function open() {
  router = createRouter({
    history: createMemoryHistory(),
    routes: ['/', '/next'].map(path => ({
      path,
      component: { template: '<div />' }
    }))
  })
  await router.push('/')
  wrapper = mount(BackToTop, { global: { plugins: [router] } })
  await flushPromises()
}

async function scroll(target) {
  target.dispatchEvent(new Event('scroll'))
  await flushPromises()
}

beforeEach(() => {
  window.scrollY = 0
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })))
})

afterEach(() => {
  wrapper?.unmount()
  document.body.replaceChildren()
  vi.unstubAllGlobals()
})

it('正文超过一屏才显示回顶按钮，并使用正文高度判断', async () => {
  const container = addScrollContainer()
  window.scrollY = window.innerHeight * 2
  await open()
  expect(wrapper.find('button').exists()).toBe(false)

  container.scrollTop = 300
  await scroll(container)
  expect(wrapper.find('button').exists()).toBe(false)

  container.scrollTop = 301
  await scroll(container)
  expect(wrapper.find('button').exists()).toBe(true)
})

it('弹窗和歌词区域滚动不会改变正文的回顶按钮状态', async () => {
  const container = addScrollContainer()
  container.scrollTop = 400
  const lyrics = document.createElement('div')
  container.append(lyrics)
  const modal = document.createElement('div')
  document.body.append(modal)
  await open()

  container.scrollTop = 0
  await scroll(lyrics)
  await scroll(modal)
  expect(wrapper.find('button').exists()).toBe(true)

  await scroll(container)
  expect(wrapper.find('button').exists()).toBe(false)
})

it.each([
  [false, 'smooth'],
  [true, 'auto']
])('回顶滚动正文并遵循减少动态效果设置（%s）', async (reduce, behavior) => {
  const container = addScrollContainer()
  container.scrollTop = 400
  window.matchMedia.mockReturnValue({ matches: reduce })
  await open()

  await wrapper.get('button').trigger('click')
  expect(container.scrollTo).toHaveBeenCalledExactlyOnceWith({ top: 0, behavior })
  expect(window.scrollTo).not.toHaveBeenCalled()
})

it('无正文容器时支持窗口滚动和回顶，并忽略弹窗滚动', async () => {
  await open()
  window.scrollY = window.innerHeight * 2
  const modal = document.createElement('div')
  document.body.append(modal)
  await scroll(modal)
  expect(wrapper.find('button').exists()).toBe(false)

  await scroll(document)
  await wrapper.get('button').trigger('click')
  expect(window.scrollTo).toHaveBeenCalledExactlyOnceWith({
    top: 0,
    behavior: 'smooth'
  })
})

it('切页后按新的正文位置更新按钮，即使没有触发滚动事件', async () => {
  window.scrollY = window.innerHeight * 2
  await open()
  expect(wrapper.find('button').exists()).toBe(true)

  addScrollContainer()
  await router.push('/next')
  await flushPromises()
  expect(wrapper.find('button').exists()).toBe(false)
})
