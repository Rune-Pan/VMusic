import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { getLoginRedirect } from '@/utils/common'
import router from '@/router'
import { cancelPageScroll } from '@/utils/pageScroll'

const state = vi.hoisted(() => ({ user: { restore: vi.fn(), ensureSession: vi.fn(), expireSession: vi.fn(), isLoggedIn: false, sessionStatus: 'anonymous' } }))
vi.mock('@/stores/user', () => ({ useUserStore: () => state.user }))
router.addRoute({ path: '/guard-test', name: 'guard-test', component: { template: '<div />' }, meta: { requiresAuth: true } })
router.addRoute({ path: '/login', name: 'login', component: { template: '<div />' }, meta: { requiresAuth: false } })
router.addRoute({ path: '/', name: 'home', component: { template: '<div />' }, meta: { requiresAuth: true } })
beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  state.user.isLoggedIn = false
  state.user.sessionStatus = 'anonymous'
  state.user.ensureSession.mockImplementation(async () => state.user.sessionStatus)
})
afterEach(cancelPageScroll)

it('未登录访问保护页面，保留含查询参数的完整原路径', async () => {
  await router.push('/guard-test?from=queue')
  expect(router.currentRoute.value.name).toBe('login')
  expect(router.currentRoute.value.query.redirect).toBe('/guard-test?from=queue')
})

it('专辑详情受会话保护，登录后保留专辑地址', async () => {
  expect(router.resolve('/album/35514').meta.requiresAuth).toBe(true)
  await router.push('/album/35514?from=search')
  expect(router.currentRoute.value.name).toBe('login')
  expect(router.currentRoute.value.query.redirect).toBe('/album/35514?from=search')
  state.user.isLoggedIn = true
  state.user.sessionStatus = 'valid'
  await router.replace(getLoginRedirect(router.currentRoute.value.query.redirect))
  expect(router.currentRoute.value.fullPath).toBe('/album/35514?from=search')
})

it('网络失败进入可重试登录页，不在跳转时再次自动校验', async () => {
  state.user.ensureSession.mockImplementationOnce(async () => { state.user.sessionStatus = 'error'; return 'error' })
  await router.push('/guard-test?offline=1')
  expect(router.currentRoute.value.query.retry).toBe('session')
  expect(router.currentRoute.value.query.redirect).toBe('/guard-test?offline=1')
})

it('重新登录后返回原路径和查询参数', async () => {
  state.user.isLoggedIn = true
  state.user.sessionStatus = 'valid'
  await router.push('/login?redirect=%2Fguard-test%3Frestored%3D1')
  expect(router.currentRoute.value.fullPath).toBe('/guard-test?restored=1')
})

it('保护接口过期事件清理会话并返回带原路径的登录页', async () => {
  state.user.isLoggedIn = true
  state.user.sessionStatus = 'valid'
  state.user.expireSession.mockImplementation(() => { state.user.isLoggedIn = false; state.user.sessionStatus = 'anonymous' })
  await router.push('/guard-test?expired=1')
  window.dispatchEvent(new Event('vmusic:session-expired'))
  await flushPromises()
  expect(state.user.expireSession).toHaveBeenCalled()
  expect(router.currentRoute.value.query.redirect).toBe('/guard-test?expired=1')
})

it.each([undefined, ['a'], '//outside.example', 'https://outside.example', '/login', '/login?redirect=/login'])('非法或循环返回路径安全回首页：%s', value => {
  expect(getLoginRedirect(value)).toBe('/')
})
