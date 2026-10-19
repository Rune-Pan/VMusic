import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia, disposePinia } from 'pinia'
import { flushPromises } from '@vue/test-utils'
import { useMusicStore } from '@/stores/music'
import { getLyric } from '@/api/track'
import { getLyricFromCache, cacheLyric } from '@/utils/db'

vi.mock('@/api/track', () => ({ getLyric: vi.fn(), getTrackDetail: vi.fn() }))
vi.mock('@/utils/db', async original => ({
  ...(await original()),
  getLyricFromCache: vi.fn(),
  cacheLyric: vi.fn()
}))
const result = content => ({ lrc: { lyric: `[00:01.00]${content}` } })
function deferred() {
  let resolve
  const promise = new Promise(yes => {
    resolve = yes
  })
  return { promise, resolve }
}
let pinia, music
beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  music = useMusicStore()
  getLyricFromCache.mockResolvedValue(null)
  cacheLyric.mockResolvedValue()
  getLyric.mockImplementation(async id => result(`Track ${id}`))
})
afterEach(() => disposePinia(pinia))

it('旧歌词晚返回不覆盖新歌词', async () => {
  const old = deferred()
  getLyric.mockReturnValueOnce(old.promise)
  const first = music.fetchLyrics(1)
  await flushPromises()
  await music.fetchLyrics(2)
  old.resolve(result('Old'))
  await first
  expect(music.currentLyricsTrackId).toBe(2)
  expect(music.currentLyrics[0].content).toBe('Track 2')
})

it('切歌立即清理旧歌词，过期缓存后台刷新能更新当前共享数据', async () => {
  await music.fetchLyrics(1)
  const fresh = deferred()
  getLyricFromCache.mockResolvedValueOnce({
    stale: true,
    lyric: [{ time: 1, content: 'Cached' }]
  })
  getLyric.mockReturnValueOnce(fresh.promise)
  const loading = music.fetchLyrics(2)
  expect(music.currentLyrics).toEqual([])
  await loading
  expect(music.currentLyrics[0].content).toBe('Cached')
  fresh.resolve(result('Fresh'))
  await flushPromises()
  expect(music.currentLyrics[0].content).toBe('Fresh')
})

it('离开页面作废网络和 SWR 响应', async () => {
  const response = deferred()
  getLyric.mockReturnValueOnce(response.promise)
  const loading = music.fetchLyrics(1)
  await flushPromises()
  music.clearLyrics()
  response.resolve(result('Late'))
  await loading
  expect(music.currentLyricsTrackId).toBeNull()
  expect(music.currentLyrics).toEqual([])
})

it('缓存不可读仍可联网获取歌词', async () => {
  getLyricFromCache.mockRejectedValueOnce(new Error('IDB blocked'))
  await music.fetchLyrics(1)
  expect(music.currentLyrics[0].content).toBe('Track 1')
})

it('后台刷新失败保留已有缓存歌词', async () => {
  getLyricFromCache.mockResolvedValueOnce({
    stale: true,
    lyric: [{ content: 'Cached' }]
  })
  getLyric.mockRejectedValueOnce(new Error('offline'))
  await music.fetchLyrics(1)
  await flushPromises()
  expect(music.currentLyrics[0].content).toBe('Cached')
})
