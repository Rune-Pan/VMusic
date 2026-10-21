import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia, disposePinia } from 'pinia'
import { flushPromises } from '@vue/test-utils'
import { useUserStore } from '@/stores/user'
import { loginWithPhone } from '@/api/auth'
import { userAccount, userLikedSongsIDs } from '@/api/user'
import { getTrackDetail } from '@/api/track'
import { STORAGE_KEYS } from '@/constants'

const state = vi.hoisted(() => ({ suspend: vi.fn(), setAccount: vi.fn() }))
vi.mock('@/stores/player', () => ({ usePlayerStore: () => ({ suspend: state.suspend }) }))
vi.mock('@/stores/music', () => ({ useMusicStore: () => ({ setAccount: state.setAccount }) }))
vi.mock('@/api/auth', () => ({ loginWithPhone: vi.fn(), loginWithCaptcha: vi.fn(), logout: vi.fn(async () => ({})) }))
vi.mock('@/api/user', () => ({ userAccount: vi.fn(), userLikedSongsIDs: vi.fn(), updateUserProfile: vi.fn() }))
vi.mock('@/api/track', () => ({ getTrackDetail: vi.fn(), resetTrackSourceCache: vi.fn(async () => {}) }))
vi.mock('@/utils/db', () => ({ clearTrackSourceCache: vi.fn(async () => {}) }))
let pinia, user
const song = id => ({ id, name: `歌曲${id}` })
const account = id => ({ code: 200, profile: { userId: id, nickname: `用户${id}` } })
function deferred() { let resolve; const promise = new Promise(yes => { resolve = yes }); return { promise, resolve } }
async function login(id) {
  loginWithPhone.mockResolvedValueOnce(account(id))
  await user.login({ account: String(id), password: 'test-only' })
}
beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  pinia = createPinia()
  setActivePinia(pinia)
  userLikedSongsIDs.mockResolvedValue({ ids: [1] })
  getTrackDetail.mockImplementation(async ids => ({ songs: String(ids).split(',').map(Number).map(song) }))
  user = useUserStore()
})
afterEach(() => disposePinia(pinia))

it('本地标记不能替代服务端校验；网络失败可重试且不删除原记录', async () => {
  localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify({ isLoggedIn: true, userInfo: { id: 10 } }))
  user.restore()
  expect(user.isLoggedIn).toBe(false)
  userAccount.mockRejectedValueOnce(new Error('offline'))
  expect(await user.ensureSession()).toBe('error')
  expect(localStorage.getItem(STORAGE_KEYS.USER)).toContain('10')
  userAccount.mockResolvedValueOnce(account(10))
  expect(await user.ensureSession()).toBe('valid')
  expect(user.isLoggedIn).toBe(true)
})

it('服务端明确未登录时清理会话并停止播放', async () => {
  await login(10)
  user.expireSession()
  expect(user.isLoggedIn).toBe(false)
  expect(state.suspend).toHaveBeenCalled()
  expect(state.setAccount).toHaveBeenLastCalledWith(null)
})

it('旧账号喜欢请求迟到不得覆盖新账号，也不能复用旧请求', async () => {
  const old = deferred()
  userLikedSongsIDs.mockReturnValueOnce(old.promise).mockResolvedValue({ ids: [22] })
  await login(10)
  await user.logout()
  await login(20)
  await flushPromises()
  old.resolve({ ids: [11] })
  await flushPromises()
  expect(user.userInfo.id).toBe(20)
  expect([...user.likedSongIds]).toEqual([22])
  expect(userLikedSongsIDs).toHaveBeenCalledWith(20)
})

it('喜欢和取消喜欢立即同步列表；迟到的详情不能恢复已取消项', async () => {
  await login(10)
  await user.fetchLikedTracks(true)
  user.addLikedSong(2, song(2))
  expect(user.likedTracks.map(t => t.id)).toEqual([2, 1])
  user.removeLikedSong(1)
  expect(user.likedTracks.map(t => t.id)).toEqual([2])
  const old = deferred()
  getTrackDetail.mockReturnValueOnce(old.promise)
  const task = user.fetchLikedTracks()
  await flushPromises()
  user.removeLikedSong(2)
  old.resolve({ songs: [song(2)] })
  await task
  expect(user.likedTracks).toEqual([])
})
