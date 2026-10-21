import { expect, it, vi } from 'vitest'
import request from '@/utils/request'
import { getAlbumDetail } from '@/api/album'

vi.mock('@/utils/request', () => ({ default: vi.fn() }))

it('读取真实端点格式，并兼容歌曲内嵌与顶层权限', async () => {
  request.mockResolvedValueOnce({
    code: 200,
    album: { id: 1 },
    songs: [
      { id: 11, privilege: { cs: true } },
      { id: 12, privilege: { fee: 1 } },
      { id: 13 }
    ],
    privileges: [{ id: 13, fee: 4 }]
  })
  const data = await getAlbumDetail(1)
  expect(request).toHaveBeenCalledWith({
    url: '/album',
    method: 'get',
    params: { id: 1 }
  })
  expect(data.songs.map(t => [t.id, t.playable, t.reason])).toEqual([
    [11, false, '无版权'],
    [12, true, '需 VIP'],
    [13, false, '需购买']
  ])
})

it('解析嵌套成功响应及合法空曲目', async () => {
  request.mockResolvedValueOnce({
    code: 200,
    body: { code: 200, album: { id: 1 }, songs: [] }
  })
  await expect(getAlbumDetail(1)).resolves.toEqual({
    album: { id: 1 },
    songs: []
  })
})

it.each([
  [{ code: 404, message: '专辑不存在' }, '专辑不存在'],
  [{ code: 200, body: { code: 403, msg: '无访问权限' } }, '无访问权限'],
  [{ code: 200, songs: [] }, '专辑不存在或数据暂时不可用'],
  [{ code: 200, album: { id: 1 } }, '专辑不存在或数据暂时不可用'],
  [{ album: { id: 1 }, songs: [] }, '专辑加载失败']
])('成功 HTTP 不掩盖业务错误或残缺响应：%j', async (response, message) => {
  request.mockResolvedValueOnce(response)
  await expect(getAlbumDetail(1)).rejects.toThrow(message)
})
