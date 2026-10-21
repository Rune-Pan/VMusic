import request from '@/utils/request'
import { requireApiSuccess } from '@/utils/apiResult'
import { cacheUserPlaylists, getUserPlaylistsFromCache, invalidateUserPlaylists } from '@/utils/db'

const playlistRequests = new Map()
export function invalidateUserPlaylistCache(uid) {
  const key = String(uid)
  playlistRequests.set(key, (playlistRequests.get(key) || 0) + 1)
  return invalidateUserPlaylists(uid)
}

export function userAccount() {
  return request({
    url: '/user/account',
    method: 'get',
    params: { timestamp: Date.now() }
  })
}

// SWR：命中未过期直接返回；过期返回旧值 + 后台刷新；未命中等网络
export function userPlaylist(params, { forceRefresh = false } = {}) {
  const uid = params?.uid
  const fetchLatest = async () => {
    const key = String(uid)
    const token = (playlistRequests.get(key) || 0) + 1
    playlistRequests.set(key, token)
    const data = await request({ url: '/user/playlist', method: 'get', params: {
      ...params, ...(forceRefresh ? { timestamp: Date.now() } : {})
    } })
    requireApiSuccess(data, '加载歌单失败')
    if (uid && data?.playlist && token === playlistRequests.get(key)) {
      await cacheUserPlaylists(uid, data.playlist).catch(() => {})
    }
    return data
  }

  if (!uid || forceRefresh) return fetchLatest()

  return getUserPlaylistsFromCache(uid).catch(() => null).then(async cached => {
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
