import { afterEach, expect, it, vi } from 'vitest'
import {
  cancelPageScroll,
  getPageScrollContainer,
  queuePageScroll,
  restorePageScroll,
  scrollPageTo
} from '@/utils/pageScroll'

afterEach(() => {
  cancelPageScroll()
  document.body.replaceChildren()
})

function addPage() {
  document.body.innerHTML =
    '<div class="desktop-shell"><main class="main-content"><div /></main></div>'
  const container = getPageScrollContainer()
  let maximum = 100
  container.scrollTo = vi.fn(({ top }) => {
    container.scrollTop = Math.min(top, maximum)
  })
  return { container, grow: () => { maximum = 2000 } }
}

it('正文异步加载后重试恢复，达到保存位置后停止', () => {
  const { container, grow } = addPage()
  queuePageScroll({ top: 800, left: 0 })
  expect(container.scrollTop).toBe(100)
  grow()
  restorePageScroll()
  expect(container.scrollTop).toBe(800)
  container.scrollTop = 900
  restorePageScroll()
  expect(container.scrollTop).toBe(900)
})

it('等离场页面移除后再恢复，避免恢复位置被旧页面消耗', () => {
  const { container, grow } = addPage()
  grow()
  container.firstElementChild.className = 'fade-leave-active'
  queuePageScroll({ top: 800, left: 0 })
  expect(container.scrollTo).not.toHaveBeenCalled()
  container.firstElementChild.className = ''
  restorePageScroll()
  expect(container.scrollTop).toBe(800)
})

it('用户开始操作后停止等待恢复，避免数据返回时抢走滚动位置', () => {
  const { container, grow } = addPage()
  queuePageScroll({ top: 800 })
  cancelPageScroll()
  grow()
  container.scrollTop = 50
  restorePageScroll()
  expect(container.scrollTop).toBe(50)
})

it('无桌面正文时保持登录或沉浸页面的窗口滚动', () => {
  document.body.innerHTML = '<main class="main-content" />'
  const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  scrollPageTo({ top: 200, behavior: 'smooth' })
  expect(scroll).toHaveBeenCalledExactlyOnceWith({ top: 200, behavior: 'smooth' })
  queuePageScroll({ top: 0, left: 0 })
  expect(scroll).toHaveBeenLastCalledWith({ top: 0, left: 0, behavior: 'instant' })
})
