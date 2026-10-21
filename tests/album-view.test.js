import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { reactive } from 'vue'
import AlbumView from '@/views/AlbumView.vue'
import { getAlbumDetail } from '@/api/album'

const mocks = vi.hoisted(() => ({
  player: { setPlaylist: vi.fn() },
  ui: { showToast: vi.fn() }
}))
let route, wrapper
vi.mock('@/api/album', () => ({ getAlbumDetail: vi.fn() }))
vi.mock('@/stores/player', () => ({ usePlayerStore: () => mocks.player }))
vi.mock('@/stores/ui', () => ({ useUiStore: () => mocks.ui }))
vi.mock('vue-router', () => ({
  useRoute: () => route,
  useRouter: () => ({ options: { history: { state: {} } }, push: vi.fn() })
}))
const details = (
  id = 1,
  songs = [{ id: 11, name: '曲目一', playable: true }]
) => ({
  album: {
    id,
    name: `专辑${id}`,
    artists: [{ id: 2, name: '歌手' }],
    publishTime: 946684800000,
    description: '专辑简介'
  },
  songs
})
const deferred = () => {
  let resolve
  const promise = new Promise(yes => {
    resolve = yes
  })
  return { promise, resolve }
}
async function open() {
  wrapper = mount(AlbumView, {
    global: {
      stubs: {
        RouterLink: { props: ['to'], template: '<a><slot /></a>' },
        TrackList: {
          props: ['tracks'],
          template:
            '<div class="track-stub">{{ tracks.map(t => t.id).join(",") }}</div>'
        }
      }
    }
  })
  await flushPromises()
}
beforeEach(() => {
  vi.clearAllMocks()
  route = reactive({ params: { id: '1' } })
  getAlbumDetail.mockResolvedValue(details())
})
afterEach(() => wrapper?.unmount())

it('展示资料、歌手入口和专辑曲目，浏览及展开简介不触发播放', async () => {
  await open()
  expect(wrapper.get('h1').text()).toBe('专辑1')
  expect(wrapper.get('.track-stub').text()).toBe('11')
  expect(wrapper.get('.artists a').text()).toBe('歌手')
  expect(wrapper.get('.description-toggle').attributes('aria-expanded')).toBe(
    'false'
  )
  await wrapper.get('.description-toggle').trigger('click')
  expect(wrapper.get('.description-toggle').attributes('aria-expanded')).toBe(
    'true'
  )
  expect(mocks.player.setPlaylist).not.toHaveBeenCalled()
})

it('播放全部保留完整曲序，从首个可播曲目开始', async () => {
  const songs = [
    { id: 11, playable: false },
    { id: 12, playable: true, reason: '需 VIP' },
    { id: 13, playable: true }
  ]
  getAlbumDetail.mockResolvedValue(details(1, songs))
  await open()
  await wrapper.get('.play-all-btn').trigger('click')
  expect(mocks.player.setPlaylist).toHaveBeenCalledExactlyOnceWith(songs, 1)
})

it('全部受限时提示且不替换现有队列', async () => {
  getAlbumDetail.mockResolvedValue(details(1, [{ id: 11, playable: false }]))
  await open()
  await wrapper.get('.play-all-btn').trigger('click')
  expect(mocks.ui.showToast).toHaveBeenCalledWith(
    '这张专辑暂无可播放的曲目',
    'warning'
  )
  expect(mocks.player.setPlaylist).not.toHaveBeenCalled()
})

it('空专辑禁用播放，缺少简介和封面时回退', async () => {
  getAlbumDetail.mockResolvedValue({
    album: { id: 1, name: '空专辑' },
    songs: []
  })
  await open()
  expect(wrapper.get('.play-all-btn').attributes('disabled')).toBeDefined()
  expect(wrapper.text()).toContain('暂无专辑简介')
  expect(wrapper.get('.cover').attributes('src')).toBeTruthy()
})

it('加载失败展示原因，重试成功', async () => {
  getAlbumDetail.mockRejectedValueOnce(new Error('网络断开'))
  await open()
  expect(wrapper.get('[role="alert"]').text()).toBe('网络断开')
  await wrapper.get('.retry-btn').trigger('click')
  await flushPromises()
  expect(wrapper.get('h1').text()).toBe('专辑1')
})

it('专辑 A 的迟到响应不能覆盖 B，离页响应不得播放', async () => {
  const old = deferred()
  getAlbumDetail.mockReturnValueOnce(old.promise)
  await open()
  expect(wrapper.find('[role="status"]').exists()).toBe(true)
  route.params.id = '2'
  getAlbumDetail.mockResolvedValue(details(2))
  await flushPromises()
  old.resolve(details(1))
  await flushPromises()
  expect(wrapper.get('h1').text()).toBe('专辑2')
  const leaving = deferred()
  getAlbumDetail.mockReturnValueOnce(leaving.promise)
  route.params.id = '3'
  await flushPromises()
  wrapper.unmount()
  wrapper = null
  leaving.resolve(details(3))
  await flushPromises()
  expect(mocks.player.setPlaylist).not.toHaveBeenCalled()
})
