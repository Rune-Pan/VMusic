import { mapTrackPlayableStatus } from '@/utils/common'
import request from '@/utils/request'
import { cacheMisc, getMiscFromCache } from '@/utils/db'

// SWR：命中返旧值同时后台刷新；未命中等网络
// ponytail: /artists?id 单请求同时返回 artist（头部）+ hotSongs（热门50），同源同缓存
export function getArtistDetail(id) {
  const fetchLatest = async () => {
    const [info, descRes] = await Promise.all([
      request({ url: '/artists', method: 'get', params: { id } }),
      request({ url: '/artist/desc', method: 'get', params: { id } })
    ])
    const data = {
      artist: info.artist || {},
      hotSongs: mapTrackPlayableStatus(info.hotSongs || []),
      desc: descRes.briefDesc || ''
    }
    cacheMisc(`artist:detail:${id}`, data).catch(() => {})
    return data
  }

  return getMiscFromCache(`artist:detail:${id}`).then(async cached => {
    if (cached) {
      if (cached.stale) fetchLatest().catch(() => {})
      return cached.data
    }
    return fetchLatest()
  })
}

// 专辑列表：走网络，不缓存（避免与"加载更多"追加页合并的复杂度）
export function getArtistAlbums(id, params) {
  return request({
    url: '/artist/album',
    method: 'get',
    params: { id, ...params }
  })
}

// 歌手全部歌曲：走网络，不缓存（与专辑分页同理）
// ponytail: /artist/songs 返回 { songs, more, total }，order=hot 让最热排前
export function getArtistSongs(id, params) {
  return request({
    url: '/artist/songs',
    method: 'get',
    params: { id, ...params }
  }).then(data => ({
    ...data,
    songs: mapTrackPlayableStatus(data.songs || [], data.privileges || [])
  }))
}
