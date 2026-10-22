import request from '@/utils/request'
import { requireApiSuccess } from '@/utils/apiResult'

export async function getComments({
  type,
  id,
  sortType,
  pageNo = 1,
  pageSize = 20,
  cursor = ''
}) {
  const sort = Number(sortType) === 1 ? 99 : Number(sortType)
  const response = await request({
    url: '/comment/new',
    method: 'get',
    params: {
      type: type === 'playlist' ? 2 : 0,
      id,
      sortType: sort,
      pageNo,
      pageSize,
      ...(sort === 3 && pageNo > 1 ? { cursor } : {}),
      timestamp: Date.now()
    }
  })
  const result = requireApiSuccess(response, '评论加载失败')
  let data = result.data
  if (data?.code !== undefined) data = requireApiSuccess(data, '评论加载失败')
  if (
    !Array.isArray(data?.comments) ||
    typeof data.hasMore !== 'boolean' ||
    data.comments.some(comment => comment?.commentId == null)
  ) {
    throw new Error('评论数据暂时不可用，请重试')
  }
  const returnedSort = Number(data.sortType) === 1 ? 99 : Number(data.sortType)
  if (data.sortType != null && returnedSort !== sort)
    throw new Error('当前排序暂时不可用，请重试')
  return {
    comments: data.comments,
    hasMore: data.hasMore,
    cursor:
      typeof data.cursor === 'string' || typeof data.cursor === 'number'
        ? String(data.cursor)
        : ''
  }
}
