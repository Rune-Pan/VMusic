import { mapTrackPlayableStatus } from '@/utils/common'
import request from '@/utils/request'
import { requireApiSuccess } from '@/utils/apiResult'
import {
  cacheTrackDetail,
  getTrackDetailFromCache,
  cacheTrackSource,
  getTrackSourceFromCache,
  clearTrackSourceCache
} from '@/utils/db'
import { STORAGE_KEYS, DEFAULT_MUSIC_QUALITY } from '@/constants'

let sourceGeneration = 0
let sourceReset = Promise.resolve()
export function resetTrackSourceCache() {
  sourceGeneration++
  sourceReset = clearTrackSourceCache().catch(() => {})
  return sourceReset
}

// 读取音质偏好（getMP3 默认 br）
function getMusicQuality() {
  const saved = Number(localStorage.getItem(STORAGE_KEYS.MUSIC_QUALITY))
  return saved || DEFAULT_MUSIC_QUALITY
}

export function getMP3(
  id,
  br = getMusicQuality(),
  { forceRefresh = false } = {}
) {
  const token = sourceGeneration
  // SWR：命中未过期直接返回；过期返回旧值同时后台刷新；未命中等网络
  const fetchLatest = async () => {
    const data = await request({
      url: '/song/url',
      method: 'get',
      params: { id, br, ...(forceRefresh ? { timestamp: Date.now() } : {}) }
    })
    const item = data?.data?.[0]
    const url = item?.url
    // 试听片段 url 不缓存（freeTrialInfo 非空即试听），避免非 VIP 的试听 url 污染缓存
    if (url && !item.freeTrialInfo && token === sourceGeneration) {
      cacheTrackSource(id, url, br).catch(() => {})
    }
    return data
  }

  if (forceRefresh) return sourceReset.then(fetchLatest)
  return sourceReset.then(() => getTrackSourceFromCache(id))
    .catch(() => null)
    .then(async cached => {
      if (cached && Number(cached.br) === Number(br)) {
        // 过期才后台刷新（url 有时效，过期需重拉）
        if (cached.stale) fetchLatest().catch(() => {})
        // freeTrialInfo 置 null 表示非试听（试听状态不缓存，避免误判）
        return {
          data: [{ id, url: cached.url, br: cached.br, freeTrialInfo: null }]
        }
      }
      return fetchLatest()
    })
}

export function getTrackDetail(ids) {
  // SWR：命中未过期直接返回；过期返回旧值同时后台刷新；未命中等网络
  const fetchLatest = async () => {
    const data = await request({
      url: '/song/detail',
      method: 'get',
      params: { ids }
    })
    data.songs = mapTrackPlayableStatus(data.songs, data.privileges)
    // 写入 IDB 缓存
    const privileges = data.privileges || []
    for (const song of data.songs || []) {
      const priv = privileges.find(p => p.id === song.id)
      cacheTrackDetail(song, priv).catch(() => {})
    }
    return data
  }

  const idArr = String(ids).split(',')

  return getTrackDetailFromCache(idArr)
    .catch(() => null)
    .then(async cached => {
      if (cached) {
        // 过期才后台刷新
        if (cached.stale) fetchLatest().catch(() => {})
        return { songs: cached.songs, privileges: cached.privileges }
      }
      return fetchLatest()
    })
}

export function getLyric(id) {
  return request({ url: '/lyric', method: 'get', params: { id } })
}

// 参考 YesPlayMusic src/api/track.js scrobble：听歌打卡
export function scrobble(params) {
  params.timestamp = Date.now()
  return request({ url: '/scrobble', method: 'get', params })
}

// 参考 YesPlayMusic src/api/track.js likeATrack：喜欢 / 取消喜欢歌曲
export function likeSong(params) {
  params.timestamp = Date.now()
  return request({ url: '/like', method: 'get', params }).then(data =>
    requireApiSuccess(data, '喜欢操作失败')
  )
}
