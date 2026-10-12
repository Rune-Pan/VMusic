import request from '@/utils/request'
import { cacheUserPlaylists, getUserPlaylistsFromCache } from '@/utils/db'

export function userAccount() {
  return request({
    url: '/user/account',
    method: 'get',
    params: { timestamp: Date.now() }
  })
}

// SWR：命中未过期直接返回；过期返回旧值 + 后台刷新；未命中等网络
export function userPlaylist(params) {
  const uid = params?.uid
  const fetchLatest = async () => {
    const data = await request({ url: '/user/playlist', method: 'get', params })
    if (uid && data?.playlist) {
      cacheUserPlaylists(uid, data.playlist).catch(() => {})
    }
    return data
  }

  if (!uid) return fetchLatest()

  return getUserPlaylistsFromCache(uid).then(async cached => {
    if (cached) {
      if (cached.stale) fetchLatest().catch(() => {})
      return { playlist: cached.playlists }
    }
    return fetchLatest()
  })
}

export function userPlayHistory(params) {
  return request({ url: '/user/record', method: 'get', params })
}

export function userLikedSongsIDs(uid) {
  return request({
    url: '/likelist',
    method: 'get',
    params: { uid, timestamp: Date.now() }
  })
}

// 更新用户信息（昵称、头像等）
export function updateUserProfile(params) {
  params.timestamp = Date.now()
  return request({ url: '/user/update', method: 'post', params })
}
