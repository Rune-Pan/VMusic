import { mapTrackPlayableStatus } from '@/utils/common'
import request from '@/utils/request'
import {
  cachePlaylistDetail,
  getPlaylistDetailFromCache,
  cacheMisc,
  getMiscFromCache
} from '@/utils/db'

export function recommendPlaylist(params) {
  // SWR：命中未过期直接返回；过期返回旧值 + 后台刷新；未命中等网络
  const fetchLatest = async () => {
    const data = await request({ url: '/personalized', method: 'get', params })
    if (data.result) cacheMisc('recommend', data).catch(() => {})
    return data
  }
  return getMiscFromCache('recommend').then(async cached => {
    if (cached) {
      if (cached.stale) fetchLatest().catch(() => {})
      return cached.data
    }
    return fetchLatest()
  })
}

export function dailyRecommendPlaylist(params) {
  return request({
    url: '/recommend/resource',
    method: 'get',
    params: { ...params, timestamp: Date.now() }
  })
}

export function getPlaylistDetail(id, noCache = false) {
  // SWR：命中未过期直接返回；过期返回旧值同时后台刷新；未命中等网络
  // noCache=true（用户主动强制刷新）：跳过本地缓存直接请求
  const fetchLatest = async () => {
    const params = { id }
    params.timestamp = Date.now()
    const data = await request({
      url: '/playlist/detail',
      method: 'get',
      params
    })
    if (data.playlist) {
      data.playlist.tracks = mapTrackPlayableStatus(
        data.playlist.tracks,
        data.privileges || []
      )
      // 写入 IDB 缓存
      cachePlaylistDetail(
        id,
        data.playlist,
        data.playlist.tracks,
        data.playlist.subscribed || false
      ).catch(() => {})
    }
    return data
  }

  if (noCache) return fetchLatest()

  return getPlaylistDetailFromCache(id).then(async cached => {
    if (cached) {
      // 过期才后台刷新
      if (cached.stale) fetchLatest().catch(() => {})
      return { playlist: cached.playlist }
    }
    return fetchLatest()
  })
}

export function toplists() {
  // SWR：榜单列表更新频率低
  const fetchLatest = async () => {
    const data = await request({ url: '/toplist', method: 'get' })
    cacheMisc('toplists', data).catch(() => {})
    return data
  }
  return getMiscFromCache('toplists').then(async cached => {
    if (cached) {
      if (cached.stale) fetchLatest().catch(() => {})
      return cached.data
    }
    return fetchLatest()
  })
}

// 歌单分类（获取全部分类标签）
export function playlistCatlist() {
  // SWR：分类标签几乎不变
  const fetchLatest = async () => {
    const data = await request({ url: '/playlist/catlist', method: 'get' })
    cacheMisc('categoryList', data).catch(() => {})
    return data
  }
  return getMiscFromCache('categoryList').then(async cached => {
    if (cached) {
      if (cached.stale) fetchLatest().catch(() => {})
      return cached.data
    }
    return fetchLatest()
  })
}

// 网友精选碟 / 按分类获取歌单
// cat: 分类名，如 "华语"、"流行"、"摇滚"；limit/offset 分页
export function topPlaylist(params) {
  return request({ url: '/top/playlist', method: 'get', params })
}

export function dailyRecommendTracks() {
  return request({
    url: '/recommend/songs',
    method: 'get',
    params: { timestamp: Date.now() }
  }).then(result => {
    if (result.data?.dailySongs) {
      result.data.dailySongs = mapTrackPlayableStatus(
        result.data.dailySongs,
        result.data.privileges
      )
    }
    return result
  })
}

// 参考 YesPlayMusic createPlaylist API
// 说明: 调用此接口，传入歌单名字可新建歌单
export function createPlaylist(params) {
  params.timestamp = new Date().getTime()
  return request({ url: '/playlist/create', method: 'post', params })
}

// 参考 YesPlayMusic playlist_delete API
// 说明: 调用此接口，传入歌单 id 可删除歌单
export function deletePlaylist(params) {
  params.timestamp = new Date().getTime()
  return request({ url: '/playlist/delete', method: 'post', params })
}

// 添加歌曲到歌单
// op: add / del, pid: 歌单id, tracks: 歌曲id（逗号分隔）
export function addTracksToPlaylist(params) {
  params.timestamp = Date.now()
  return request({ url: '/playlist/tracks', method: 'post', params })
}

// 获取歌单评论
// SWR：仅缓存首页（offset=0），命中秒开 + 过期后台刷新；loadMore 走网络
export function getPlaylistComments(params) {
  const cacheKey = `comment:playlist:${params.id}`
  const fetchLatest = () =>
    request({ url: '/comment/playlist', method: 'get', params })
  if (params.offset && params.offset > 0) return fetchLatest()

  const fetchAndCache = async () => {
    const data = await fetchLatest()
    if (data?.comments?.length) cacheMisc(cacheKey, data).catch(() => {})
    return data
  }

  return getMiscFromCache(cacheKey).then(async cached => {
    if (cached) {
      if (cached.stale) fetchAndCache().catch(() => {})
      return cached.data
    }
    return fetchAndCache()
  })
}
