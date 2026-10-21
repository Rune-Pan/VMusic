import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia, disposePinia } from 'pinia'
import { useMusicStore } from '@/stores/music'
import { search as searchApi } from '@/api/others'
import { dailyRecommendTracks, dailyRecommendPlaylist } from '@/api/playlist'
import { userPlayHistory } from '@/api/user'
import { getTrackDetail } from '@/api/track'

vi.mock('@/api/others', () => ({ search: vi.fn(), SEARCH_TYPES: { tracks: 1, albums: 10, artists: 100, playlists: 1000 } }))
vi.mock('@/api/track', () => ({ getTrackDetail: vi.fn(), getLyric: vi.fn() }))
vi.mock('@/api/playlist', () => ({ dailyRecommendTracks: vi.fn(), dailyRecommendPlaylist: vi.fn() }))
vi.mock('@/api/user', () => ({ userPlayHistory: vi.fn() }))
let pinia, music
const song = id => ({ id, name: `歌曲${id}` })
function deferred() { let resolve; const promise = new Promise(yes => { resolve = yes }); return { promise, resolve } }
beforeEach(() => {
  vi.clearAllMocks()
  pinia = createPinia()
  setActivePinia(pinia)
  localStorage.clear()
  music = useMusicStore()
  searchApi.mockResolvedValue({ result: {} })
  getTrackDetail.mockImplementation(async ids => ({ songs: String(ids).split(',').map(Number).map(song) }))
})
afterEach(() => disposePinia(pinia))

it('慢旧搜索和关闭后的响应均不能恢复或覆盖当前结果', async () => {
  const old = deferred()
  searchApi.mockImplementation(({ keywords, type }) => type === 1
    ? keywords === '旧词' ? old.promise : Promise.resolve({ result: { songs: [song(2)], songCount: 1 } })
    : Promise.resolve({ result: {} }))
  const previous = music.search('旧词')
  await music.search('新词')
  old.resolve({ result: { songs: [song(1)] } })
  await previous
  expect(music.searchKeyword).toBe('新词')
  expect(music.searchResultsByType.tracks.map(t => t.id)).toEqual([2])
  const late = deferred()
  searchApi.mockReturnValue(late.promise)
  const closing = music.search('关闭')
  music.clearSearch()
  late.resolve({ result: { songs: [song(3)] } })
  await closing
  expect(music.searchResultsByType.tracks).toEqual([])
  expect(music.searchKeyword).toBe('')
})

it('四类分页各自维护offset，追加去重，末页停止加载', async () => {
  const fields = { 1: ['songs', 'songCount'], 10: ['albums', 'albumCount'], 100: ['artists', 'artistCount'], 1000: ['playlists', 'playlistCount'] }
  searchApi.mockImplementation(async ({ type, offset }) => {
    const [field, count] = fields[type]
    return { result: { [field]: offset === 0 ? Array.from({ length: 16 }, (_, i) => song(i + 1)) : [16, 17, 18, 19, 20].map(song), [count]: 21 } }
  })
  await music.search('测试')
  for (const type of ['tracks', 'artists', 'playlists', 'albums']) {
    await music.loadMoreSearch(type)
    expect(music.searchResultsByType[type]).toHaveLength(20)
    expect(music.searchPageByType[type].hasMore).toBe(false)
  }
  expect(searchApi).toHaveBeenCalledWith(expect.objectContaining({ type: 10, offset: 16, limit: 16 }))
  const count = searchApi.mock.calls.length
  await music.loadMoreSearch('albums')
  expect(searchApi).toHaveBeenCalledTimes(count)
})

it('分页失败保留已有内容，重试仍请求相同offset，不影响其他类型', async () => {
  searchApi.mockImplementation(async ({ type }) => ({ result: type === 100 ? { artists: Array.from({ length: 16 }, (_, i) => song(i + 1)) } : {} }))
  await music.search('测试')
  searchApi.mockRejectedValueOnce(new Error('网络断开'))
  await music.loadMoreSearch('artists')
  expect(music.searchResultsByType.artists).toHaveLength(16)
  expect(music.searchPageByType.artists.error).toBe('网络断开')
  searchApi.mockResolvedValueOnce({ result: { artists: [song(17)] } })
  await music.loadMoreSearch('artists')
  expect(searchApi).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 16 }))
  expect(music.searchResultsByType.artists).toHaveLength(17)
  expect(music.searchPageByType.artists.error).toBe('')
  expect(music.searchPageByType.tracks.error).toBe('')
})

it('切账号清理推荐和历史，旧账号迟到响应不得回写', async () => {
  music.setAccount(10)
  const oldDaily = deferred(), oldHistory = deferred()
  dailyRecommendTracks.mockReturnValueOnce(oldDaily.promise).mockResolvedValue({ data: { dailySongs: [song(20)] } })
  dailyRecommendPlaylist.mockResolvedValue({ recommend: [] })
  userPlayHistory.mockReturnValueOnce(oldHistory.promise).mockReturnValueOnce(oldHistory.promise).mockResolvedValue({ weekData: [], allData: [] })
  const daily = music.fetchDailyRecommend()
  const history = music.fetchPlayHistory(10)
  music.setAccount(20)
  await music.fetchDailyRecommend()
  await music.fetchPlayHistory(20)
  oldDaily.resolve({ data: { dailySongs: [song(10)] } })
  oldHistory.resolve({ weekData: [{ song: song(10) }], allData: [{ song: song(10) }] })
  await Promise.all([daily, history])
  expect(music.dailyRecommend.songs.map(t => t.id)).toEqual([20])
  expect(music.serverPlayHistory.allData).toEqual([])
})
