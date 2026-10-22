import { beforeEach, expect, it, vi } from 'vitest'
import request from '@/utils/request'
import { getComments } from '@/api/comment'

vi.mock('@/utils/request', () => ({ default: vi.fn() }))
beforeEach(() => request.mockReset())
const payload = (overrides = {}) => ({
  code: 200,
  data: {
    comments: [{ commentId: 1 }],
    hasMore: true,
    cursor: 123,
    ...overrides
  }
})

it.each([
  ['track', 0, 3],
  ['track', 0, 2],
  ['track', 0, 99],
  ['playlist', 2, 3],
  ['playlist', 2, 2],
  ['playlist', 2, 99],
  ['track', 0, 1]
])(
  '资源与排序使用真实新版端点：%s/%s/%s',
  async (type, resourceType, sortType) => {
    const normalized = sortType === 1 ? 99 : sortType
    request.mockResolvedValueOnce(
      payload({ sortType: normalized === 99 ? 1 : normalized })
    )
    await expect(getComments({ type, id: 12, sortType })).resolves.toEqual({
      comments: [{ commentId: 1 }],
      hasMore: true,
      cursor: '123'
    })
    expect(request).toHaveBeenCalledWith({
      url: '/comment/new',
      method: 'get',
      params: {
        type: resourceType,
        id: 12,
        sortType: normalized,
        pageNo: 1,
        pageSize: 20,
        timestamp: expect.any(Number)
      }
    })
  }
)

it('时间续页携带游标，热度与推荐按页号请求', async () => {
  request.mockResolvedValue(payload())
  for (const sortType of [3, 2, 99]) {
    await getComments({
      type: 'track',
      id: 1,
      sortType,
      pageNo: 2,
      cursor: '123'
    })
    expect(request.mock.lastCall[0].params).toEqual({
      type: 0,
      id: 1,
      sortType,
      pageNo: 2,
      pageSize: 20,
      ...(sortType === 3 ? { cursor: '123' } : {}),
      timestamp: expect.any(Number)
    })
  }
})

it('解包嵌套响应，保留上游顺序，以 hasMore 而非条数判断分页', async () => {
  const comments = Array.from({ length: 25 }, (_, index) => ({
    commentId: 25 - index
  }))
  request.mockResolvedValueOnce({
    code: 200,
    body: payload({ comments, hasMore: false })
  })
  const data = await getComments({ type: 'playlist', id: 1, sortType: 99 })
  expect(data.comments).toEqual(comments)
  expect(data.hasMore).toBe(false)
  request.mockResolvedValueOnce(
    payload({ comments: [], hasMore: false, cursor: null })
  )
  await expect(
    getComments({ type: 'track', id: 1, sortType: 3 })
  ).resolves.toEqual({ comments: [], hasMore: false, cursor: '' })
})

it.each([
  [{ code: 403, message: '无权读取评论' }, '无权读取评论'],
  [{ code: 200, body: { code: 500, msg: '服务暂不可用' } }, '服务暂不可用'],
  [{ code: 200, data: { code: 400, message: '参数错误' } }, '参数错误'],
  [{ data: { comments: [] } }, '评论加载失败'],
  [payload({ comments: null }), '评论数据暂时不可用'],
  [payload({ hasMore: undefined }), '评论数据暂时不可用'],
  [payload({ comments: [null] }), '评论数据暂时不可用'],
  [payload({ sortType: 2 }), '当前排序暂时不可用']
])('HTTP 成功不掩盖业务失败与残缺响应：%j', async (response, message) => {
  request.mockResolvedValueOnce(response)
  await expect(
    getComments({ type: 'track', id: 1, sortType: 3 })
  ).rejects.toThrow(message)
})
