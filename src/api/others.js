import { mapTrackPlayableStatus } from '@/utils/common'
import request from '@/utils/request'

export function search(params) {
  return request({ url: '/search', method: 'get', params }).then(data => {
    // 参考 YesPlayMusic：type=1 返回 result.songs，需要赋值回原数组
    if (data.result?.songs) {
      data.result.songs = mapTrackPlayableStatus(data.result.songs)
    } else if (data.result?.song?.songs) {
      data.result.song.songs = mapTrackPlayableStatus(data.result.song.songs)
    }
    return data
  })
}

// 搜索类型常量（参考 YesPlayMusic typeTable）
export const SEARCH_TYPES = {
  tracks: 1,
  albums: 10,
  artists: 100,
  playlists: 1000
}
