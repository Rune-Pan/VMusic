import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import Dexie from 'dexie'
import { flushPromises } from '@vue/test-utils'
import request from '@/utils/request'
import * as cache from '@/utils/db'
import { getMP3, getTrackDetail, resetTrackSourceCache } from '@/api/track'

vi.mock('@/utils/request', () => ({ default: vi.fn() }))
let inspector
const song = { id: 1, name: 'Cached', ar: [], al: {} }

beforeAll(async () => {
  await cache.cacheTrackDetail(song)
  inspector = new Dexie('vmusic')
  await inspector.open()
})
beforeEach(async () => {
  await Promise.all(inspector.tables.map(table => table.clear()))
  localStorage.clear()
  request.mockImplementation(async options =>
    options.url === '/song/detail'
      ? { songs: [song], privileges: [] }
      : { data: [{ id: 1, url: 'https://new', freeTrialInfo: null }] }
  )
})
afterAll(() => inspector.close())

it('详情缓存以数值 ID 写入，也能用字符串和数值 ID 读取', async () => {
  await cache.cacheTrackDetail(song, {})
  expect((await getTrackDetail('1')).songs[0].id).toBe(1)
  expect((await getTrackDetail(1)).songs[0].id).toBe(1)
  expect(request).not.toHaveBeenCalled()
})

it('音源缓存仅在音质匹配时命中，字符串 ID 可读取既有数值记录', async () => {
  await cache.cacheTrackSource(1, 'https://cached', 320000)
  expect((await getMP3('1', 320000)).data[0].url).toBe('https://cached')
  expect(request).not.toHaveBeenCalled()
  expect((await getMP3(1, 128000)).data[0].url).toBe('https://new')
  expect(request).toHaveBeenCalledTimes(1)
})

it('强制刷新跳过缓存，并用 timestamp 绕过后端 URL 缓存', async () => {
  await cache.cacheTrackSource(1, 'https://bad', 320000)
  expect((await getMP3(1, 320000, { forceRefresh: true })).data[0].url).toBe(
    'https://new'
  )
  expect(request.mock.calls[0][0].params).toEqual({
    id: 1,
    br: 320000,
    timestamp: expect.any(Number)
  })
})

it('缓存读取拒绝时仍请求网络', async () => {
  vi.spyOn(cache, 'getTrackDetailFromCache').mockRejectedValue(
    new Error('IDB blocked')
  )
  vi.spyOn(cache, 'getTrackSourceFromCache').mockRejectedValue(
    new Error('IDB blocked')
  )
  expect((await getTrackDetail('1')).songs).toHaveLength(1)
  expect((await getMP3(1)).data[0].url).toBe('https://new')
  expect(request).toHaveBeenCalledTimes(2)
})

it('缓存写入拒绝不改变网络返回结果', async () => {
  vi.spyOn(cache, 'cacheTrackDetail').mockRejectedValue(new Error('full'))
  vi.spyOn(cache, 'cacheTrackSource').mockRejectedValue(new Error('full'))
  expect((await getTrackDetail('1')).songs[0].id).toBe(1)
  expect((await getMP3(1)).data[0].url).toBe('https://new')
  await flushPromises()
})

it('试听音源不进入持久缓存', async () => {
  request.mockResolvedValueOnce({
    data: [{ url: 'https://trial', freeTrialInfo: { start: 0, end: 30 } }]
  })
  await getMP3(1)
  await flushPromises()
  expect(await cache.getTrackSourceFromCache(1)).toBeNull()
})

it('过期详情先返回旧缓存，再后台更新', async () => {
  await cache.cacheTrackDetail(song)
  await inspector.table('trackDetail').update(1, { updateTime: 0 })
  expect((await getTrackDetail('1')).songs[0].name).toBe('Cached')
  await flushPromises()
  expect(request).toHaveBeenCalledTimes(1)
})

it('切账号后迟到的旧音源不能重新污染缓存', async () => {
  let resolve
  request.mockReturnValueOnce(new Promise(yes => { resolve = yes }))
  const old = getMP3(1, 320000, { forceRefresh: true })
  await flushPromises()
  await resetTrackSourceCache()
  resolve({ data: [{ id: 1, url: 'https://old-account', freeTrialInfo: null }] })
  await old
  expect(await cache.getTrackSourceFromCache(1)).toBeNull()
  expect((await getMP3(1, 320000)).data[0].url).toBe('https://new')
})
