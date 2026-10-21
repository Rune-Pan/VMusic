import request from '@/utils/request'
import { requireApiSuccess } from '@/utils/apiResult'
import { mapTrackPlayableStatus } from '@/utils/common'

export async function getAlbumDetail(id) {
  const response = await request({
    url: '/album',
    method: 'get',
    params: { id }
  })
  const data = requireApiSuccess(response, '专辑加载失败，请重试')
  if (!data.album?.id || !Array.isArray(data.songs)) {
    throw new Error('专辑不存在或数据暂时不可用')
  }
  return {
    album: data.album,
    songs: mapTrackPlayableStatus(data.songs, data.privileges || [])
  }
}
