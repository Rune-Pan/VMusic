// @vitest-environment node
import { expect, it, vi } from 'vitest'
import { createMusicReader } from '../server/ai/music.js'

const song = id => ({
  id,
  name: `Song ${id}`,
  ar: [{ id: 10, name: 'Artist' }],
  al: { id: 100, name: 'Album' },
  dt: 200000
})
function reader(handler) {
  const fetcher = vi.fn(async (url, options) => ({
    ok: true,
    json: async () => handler(url.pathname, url.searchParams, options)
  }))
  return {
    music: createMusicReader({
      cookie: 'music-fixture-cookie',
      signal: new AbortController().signal,
      fetcher
    }),
    fetcher
  }
}

it('个人样本遵守20/5×5/20上限，区分无序喜欢、创建与收藏，不请求本机历史或排行', async () => {
  const { music, fetcher } = reader((path, params) => {
    if (path === '/likelist')
      return {
        code: 200,
        ids: Array.from({ length: 100 }, (_, index) => index + 1)
      }
    if (path === '/song/detail')
      return {
        code: 200,
        songs: params.get('ids').split(',').map(Number).map(song)
      }
    if (path === '/user/playlist')
      return {
        code: 200,
        playlist: Array.from({ length: 10 }, (_, index) => ({
          id: index,
          name: `Playlist ${index}`,
          creator: { userId: index % 2 ? 1 : 2 }
        }))
      }
    if (path === '/playlist/detail')
      return {
        code: 200,
        playlist: {
          tracks: Array.from({ length: 20 }, (_, index) =>
            song(100 + Number(params.get('id')) * 10 + index)
          )
        }
      }
    if (path === '/record/recent/song')
      return {
        code: 200,
        data: {
          list: Array.from({ length: 100 }, (_, index) => ({
            data: song(1000 + index),
            playTime: 999
          }))
        }
      }
    throw new Error('不应请求该端点')
  })
  const result = await music.personal('1')
  expect(result.tracks).toHaveLength(65)
  expect(result.tracks[0].source).toContain('无序')
  expect(
    result.tracks.some(item => item.source.startsWith('本人创建歌单'))
  ).toBe(true)
  expect(result.tracks.some(item => item.source.startsWith('收藏歌单'))).toBe(
    true
  )
  expect(
    fetcher.mock.calls.every(
      ([url, options]) =>
        !url.pathname.includes('record/recent/playlist') &&
        !url.pathname.includes('user/record') &&
        options.headers.cookie === 'music-fixture-cookie'
    )
  ).toBe(true)
  expect(JSON.stringify(result)).not.toContain('cookie')
  expect(JSON.stringify(result)).not.toContain('playTime')
})

it('个人来源失效明确缺失，不自动回退到其他账号或本机数据', async () => {
  const { music } = reader(() => ({ code: 301 }))
  const result = await music.personal('1')
  expect(result.tracks).toEqual([])
  expect(result.missing).toHaveLength(3)
})

it('评论即使上游超额返回，也只取每类20条并匿名去重截断', async () => {
  const { music } = reader((path, params) => ({
    code: 200,
    data: {
      comments: Array.from({ length: 50 }, (_, index) => ({
        commentId: index + (params.get('sortType') === '3' ? 10 : 0),
        content: '好'.repeat(1000),
        user: { nickname: '不发送的昵称', avatarUrl: '私人资料' },
        likedCount: 10,
        time: 100
      }))
    }
  }))
  const result = await music.comments('playlist', 123)
  expect(result.uniqueCount).toBe(30)
  expect(result.counts.map(item => item.count)).toEqual([20, 20])
  expect(result.comments.every(item => item.content.length === 300)).toBe(true)
  expect(JSON.stringify(result)).not.toContain('不发送的昵称')
  expect(JSON.stringify(result)).not.toContain('avatarUrl')
})

it('歌曲权限用详情返回值规范化，不将VIP试听当完整免费', async () => {
  const { music } = reader(() => ({
    code: 200,
    songs: [song(1), song(2), song(3)],
    privileges: [
      { id: 1, cs: true },
      { id: 2, fee: 4 },
      { id: 3, fee: 1 }
    ]
  }))
  expect(
    (await music.details([1, 2, 3])).map(item => [
      item.playable,
      item.permission
    ])
  ).toEqual([
    [false, '无版权'],
    [false, '需购买'],
    [true, 'VIP／可能仅试听']
  ])
})
