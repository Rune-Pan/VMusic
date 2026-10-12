// IndexedDB 持久缓存（Dexie）
// 参考 YesPlayMusic src/utils/db.js：SWR 模式 + LRU 淘汰
import Dexie from 'dexie'
import {
  CACHE_TTL_LYRIC,
  CACHE_TTL_TRACK_DETAIL,
  CACHE_TTL_PLAYLIST_DETAIL,
  CACHE_TTL_TRACK_SOURCE,
  CACHE_TTL_USER_PLAYLISTS,
  CACHE_TTL_TOPLISTS,
  CACHE_TTL_CATEGORY_LIST,
  CACHE_TTL_RECOMMEND,
  CACHE_MAX_LYRIC,
  CACHE_MAX_TRACK_DETAIL,
  CACHE_MAX_PLAYLIST_DETAIL,
  CACHE_MAX_TRACK_SOURCE,
  CACHE_MAX_USER_PLAYLISTS,
  CACHE_MAX_MISC
} from '@/constants'

const db = new Dexie('vmusic')

// 表定义：主键 id，索引 lastAccess（用于 LRU 淘汰）
db.version(1).stores({
  lyric: 'id, lastAccess',
  trackDetail: 'id, lastAccess',
  playlistDetail: 'id, lastAccess',
  trackSource: 'id, lastAccess'
})

// version 2：新增 userPlaylists（用户歌单列表）与 miscCache（低频 GET 收口）
db.version(2).stores({
  lyric: 'id, lastAccess',
  trackDetail: 'id, lastAccess',
  playlistDetail: 'id, lastAccess',
  trackSource: 'id, lastAccess',
  userPlaylists: 'id, lastAccess',
  miscCache: 'id, lastAccess'
})

// ========== 通用工具 ==========

// LRU 淘汰：按 lastAccess 升序删最旧，直到条数 <= max
async function evictIfNeeded(table, max) {
  const count = await db[table].count()
  if (count <= max) return
  const overflow = count - max
  const oldest = await db[table].orderBy('lastAccess').limit(overflow).toArray()
  await db[table].bulkDelete(oldest.map(r => r.id))
}

// 判断是否过期
function isStale(updateTime, ttl) {
  return Date.now() - updateTime > ttl
}

// ========== lyric 表 ==========

export async function cacheLyric(id, lyric) {
  await db.lyric.put({
    id,
    lyric,
    updateTime: Date.now(),
    lastAccess: Date.now()
  })
  await evictIfNeeded('lyric', CACHE_MAX_LYRIC)
}

export async function getLyricFromCache(id) {
  const record = await db.lyric.get(id)
  if (!record) return null
  await db.lyric.update(id, { lastAccess: Date.now() })
  return {
    lyric: record.lyric,
    stale: isStale(record.updateTime, CACHE_TTL_LYRIC)
  }
}

// ========== trackDetail 表 ==========

export async function cacheTrackDetail(song, privileges) {
  if (!song?.id) return
  await db.trackDetail.put({
    id: song.id,
    song,
    privileges,
    updateTime: Date.now(),
    lastAccess: Date.now()
  })
  await evictIfNeeded('trackDetail', CACHE_MAX_TRACK_DETAIL)
}

// 批量查询，对标上游 getTrackDetailFromCache(ids)
// ids 为数组，返回 { songs, privileges, stale } 或 null（任一缺失即视为未命中）
export async function getTrackDetailFromCache(ids) {
  const records = await db.trackDetail.bulkGet(ids)
  if (records.some(r => !r)) return null
  // 更新 lastAccess
  await Promise.all(
    records.map(r => db.trackDetail.update(r.id, { lastAccess: Date.now() }))
  )
  return {
    songs: records.map(r => r.song),
    privileges: records.map(r => r.privileges),
    stale: records.some(r => isStale(r.updateTime, CACHE_TTL_TRACK_DETAIL))
  }
}

// ========== playlistDetail 表 ==========

export async function cachePlaylistDetail(id, playlist, tracks, isSubscribed) {
  await db.playlistDetail.put({
    id,
    playlist,
    tracks,
    isSubscribed,
    updateTime: Date.now(),
    lastAccess: Date.now()
  })
  await evictIfNeeded('playlistDetail', CACHE_MAX_PLAYLIST_DETAIL)
}

export async function getPlaylistDetailFromCache(id) {
  const record = await db.playlistDetail.get(id)
  if (!record) return null
  await db.playlistDetail.update(id, { lastAccess: Date.now() })
  return {
    playlist: record.playlist,
    tracks: record.tracks,
    isSubscribed: record.isSubscribed,
    stale: isStale(record.updateTime, CACHE_TTL_PLAYLIST_DETAIL)
  }
}

// ========== trackSource 表（只存 url，不存字节） ==========

export async function cacheTrackSource(id, url, br) {
  await db.trackSource.put({
    id,
    url,
    br,
    updateTime: Date.now(),
    lastAccess: Date.now()
  })
  await evictIfNeeded('trackSource', CACHE_MAX_TRACK_SOURCE)
}

export async function getTrackSourceFromCache(id) {
  const record = await db.trackSource.get(id)
  if (!record) return null
  await db.trackSource.update(id, { lastAccess: Date.now() })
  return {
    url: record.url,
    br: record.br,
    stale: isStale(record.updateTime, CACHE_TTL_TRACK_SOURCE)
  }
}

// 清除单首歌的 url 缓存（播放失败回退用）
export async function clearTrackSource(id) {
  await db.trackSource.delete(id)
}

// 清空全部 url 缓存（切换音质用，对齐上游 clearCache）
export async function clearTrackSourceCache() {
  await db.trackSource.clear()
}

// ========== userPlaylists 表（用户歌单列表，跨视图共享） ==========

export async function cacheUserPlaylists(uid, playlists) {
  await db.userPlaylists.put({
    id: String(uid),
    playlists,
    updateTime: Date.now(),
    lastAccess: Date.now()
  })
  await evictIfNeeded('userPlaylists', CACHE_MAX_USER_PLAYLISTS)
}

export async function getUserPlaylistsFromCache(uid) {
  const record = await db.userPlaylists.get(String(uid))
  if (!record) return null
  await db.userPlaylists.update(String(uid), { lastAccess: Date.now() })
  return {
    playlists: record.playlists,
    stale: isStale(record.updateTime, CACHE_TTL_USER_PLAYLISTS)
  }
}

// ========== miscCache 表（低频 GET 收口：toplists/categoryList/recommend） ==========

// key 对应的 TTL 映射
const MISC_TTL_MAP = {
  toplists: CACHE_TTL_TOPLISTS,
  categoryList: CACHE_TTL_CATEGORY_LIST,
  recommend: CACHE_TTL_RECOMMEND
}

export async function cacheMisc(key, data) {
  await db.miscCache.put({
    id: key,
    data,
    updateTime: Date.now(),
    lastAccess: Date.now()
  })
  await evictIfNeeded('miscCache', CACHE_MAX_MISC)
}

export async function getMiscFromCache(key) {
  const record = await db.miscCache.get(key)
  if (!record) return null
  await db.miscCache.update(key, { lastAccess: Date.now() })
  const ttl = MISC_TTL_MAP[key] || CACHE_TTL_RECOMMEND
  return {
    data: record.data,
    stale: isStale(record.updateTime, ttl)
  }
}
