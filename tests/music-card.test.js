import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import MusicCard from '@/components/MusicCard.vue'
import { getPlaylistDetail } from '@/api/playlist'

const { play, push, showToast } = vi.hoisted(() => ({
  play: vi.fn(),
  push: vi.fn(),
  showToast: vi.fn()
}))
vi.mock('@/stores/player', () => ({ usePlayerStore: () => ({ play }) }))
vi.mock('@/stores/user', () => ({
  useUserStore: () => ({ isLoggedIn: true })
}))
vi.mock('@/stores/ui', () => ({ useUiStore: () => ({ showToast }) }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))
vi.mock('@/api/playlist', () => ({ getPlaylistDetail: vi.fn() }))

const tracks = [
  { id: 287063, name: '我怀念的', ar: [], al: {} },
  { id: 287221, name: '绿光', ar: [], al: {} }
]
const playlist = { id: 17747519380, name: '测试歌单', picUrl: 'cover.jpg' }
let wrapper

function open(item = playlist, type = 'track') {
  wrapper = mount(MusicCard, {
    props: { item, type },
    global: { stubs: { AddToPlaylistModal: true } }
  })
  return wrapper.get('.play-btn')
}

beforeEach(() => {
  vi.resetAllMocks()
  getPlaylistDetail.mockResolvedValue({ playlist: { tracks } })
})
afterEach(() => wrapper?.unmount())

it.each(['track', 'playlist'])('歌单封面播放加载歌曲并传入队列（type=%s）', async type => {
  await open(playlist, type).trigger('click')
  await flushPromises()
  expect(getPlaylistDetail).toHaveBeenCalledWith(playlist.id)
  expect(play).toHaveBeenCalledExactlyOnceWith(tracks[0], tracks)
  expect(push).not.toHaveBeenCalled()
})

it('歌曲卡片仍直接播放歌曲', async () => {
  await open(tracks[0]).trigger('click')
  await flushPromises()
  expect(getPlaylistDetail).not.toHaveBeenCalled()
  expect(play).toHaveBeenCalledExactlyOnceWith(tracks[0])
})

it('加载期间禁止重复提交，完成后恢复按钮', async () => {
  let resolve
  getPlaylistDetail.mockReturnValue(new Promise(done => (resolve = done)))
  const button = open()
  await button.trigger('click')
  await button.trigger('click')
  expect(button.attributes('disabled')).toBeDefined()
  expect(getPlaylistDetail).toHaveBeenCalledTimes(1)
  expect(play).not.toHaveBeenCalled()
  resolve({ playlist: { tracks } })
  await flushPromises()
  expect(play).toHaveBeenCalledTimes(1)
  expect(button.attributes('disabled')).toBeUndefined()
})

it('空歌单给出提示，不改变当前播放', async () => {
  getPlaylistDetail.mockResolvedValue({ playlist: { tracks: [] } })
  await open().trigger('click')
  await flushPromises()
  expect(play).not.toHaveBeenCalled()
  expect(showToast).toHaveBeenCalledWith('歌单暂无可播放的歌曲', 'warning')
})

it('加载失败给出提示并允许重试', async () => {
  getPlaylistDetail.mockRejectedValueOnce(new Error('network'))
  const button = open()
  await button.trigger('click')
  await flushPromises()
  expect(play).not.toHaveBeenCalled()
  expect(showToast).toHaveBeenCalledWith('歌单加载失败，请稍后重试', 'error')
  expect(button.attributes('disabled')).toBeUndefined()
  await button.trigger('click')
  await flushPromises()
  expect(play).toHaveBeenCalledExactlyOnceWith(tracks[0], tracks)
})

it('歌单标题仍进入详情，不触发播放', async () => {
  open()
  await wrapper.get('.name').trigger('click')
  expect(push).toHaveBeenCalledWith({
    name: 'playlist',
    params: { id: playlist.id }
  })
  expect(play).not.toHaveBeenCalled()
})

it('离开卡片后到达的歌单响应不会再启动播放', async () => {
  let resolve
  getPlaylistDetail.mockReturnValue(new Promise(done => (resolve = done)))
  await open().trigger('click')
  wrapper.unmount()
  wrapper = null
  resolve({ playlist: { tracks } })
  await flushPromises()
  expect(play).not.toHaveBeenCalled()
})
