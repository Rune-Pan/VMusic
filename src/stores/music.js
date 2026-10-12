import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import {
  STORAGE_KEYS,
  RECOMMEND_LIMIT,
  CATEGORY_PLAYLIST_LIMIT,
  SEARCH_LIMIT,
  PRELOAD_CATEGORY_COUNT,
  TOPLIST_PREVIEW_COUNT,
  FETCH_DEBOUNCE_PLAY_HISTORY
} from '@/constants'
import {
  recommendPlaylist,
  topPlaylist,
  createPlaylist as createPlaylistApi,
  deletePlaylist as deletePlaylistApi,
  dailyRecommendTracks,
  dailyRecommendPlaylist,
  toplists,
  getPlaylistDetail,
  playlistCatlist
} from '@/api/playlist'
import { search as searchApi, SEARCH_TYPES } from '@/api/others'
import { getLyric, getTrackDetail } from '@/api/track'
import { userPlayHistory } from '@/api/user'
import { parseLRC } from '@/utils/common'
import { cacheLyric, getLyricFromCache } from '@/utils/db'

export const useMusicStore = defineStore('music', () => {
  const recommendList = ref([])
  const categoryList = ref(['全部'])
  const searchResults = ref([])
  const searchKeyword = ref('')
  const searchType = ref('tracks') // 当前搜索类型 Tab
  const searchResultsByType = ref({
    tracks: [],
    playlists: [],
    artists: [],
    albums: []
  })
  const searchLoading = ref(false)
  const userPlaylists = ref([])
  const currentLyrics = ref([])
  const loading = ref(false)
  // 缓存各分类的歌曲数据，key 为分类名
  const categoryCache = ref({})
  // 当前激活的分类
  const activeCategory = ref('全部')
  // 参考 YesPlayMusic fetchPlayHistory：服务端播放历史（登录后可用）
  const serverPlayHistory = ref({ weekData: [], allData: [] })
  const historyLoading = ref(false)

  const filteredList = computed(() => {
    if (searchKeyword.value.trim()) {
      const kw = searchKeyword.value.toLowerCase().trim()
      return recommendList.value.filter(track => {
        const nameMatch = track.name.toLowerCase().includes(kw)
        const artistMatch = track.ar?.some(a =>
          a.name.toLowerCase().includes(kw)
        )
        return nameMatch || artistMatch
      })
    }
    return recommendList.value
  })

  async function fetchRecommend() {
    loading.value = true
    try {
      const data = await recommendPlaylist({ limit: RECOMMEND_LIMIT })
      if (data.result) {
        // 保留歌单对象本身，与其他分类（topPlaylist）保持一致，
        // 使 MusicCard 能正确识别为歌单并跳转到歌单详情页
        recommendList.value = data.result
        categoryCache.value['全部'] = recommendList.value
        persistCategoryState()
      }
    } catch (e) {
      console.error('Failed to fetch recommend:', e)
      recommendList.value = []
    }
    loading.value = false
    // 后台预加载热门分类（不阻塞 UI）
    preloadCategories()
  }

  // 从服务端获取歌单分类标签（内存缓存，已有数据则跳过）
  async function fetchCategoryList() {
    if (categoryList.value.length > 1) return categoryList.value
    try {
      const data = await playlistCatlist()
      const cats = (data.sub || []).map(item => item.name)
      categoryList.value = ['全部', ...cats]
    } catch (e) {
      console.error('Failed to fetch category list:', e)
    }
    return categoryList.value
  }

  async function preloadCategories() {
    const hotCategories = categoryList.value
      .filter(c => c !== '全部')
      .slice(0, PRELOAD_CATEGORY_COUNT)
    for (const cat of hotCategories) {
      if (!categoryCache.value[cat]) {
        try {
          await filterByCategory(cat, true) // 静默加载，不影响 UI
        } catch {
          /* 预加载失败不影响主流程 */
        }
      }
    }
  }

  // 按分类从 API 加载数据（真实 API）或本地过滤（mock 数据有 category 字段）
  // silent=true 时只写缓存，不更新 recommendList/activeCategory/loading
  async function filterByCategory(category, silent = false) {
    if (!silent) {
      activeCategory.value = category
      persistCategoryState()
    }
    if (category === '全部') {
      if (!silent) recommendList.value = categoryCache.value['全部'] || []
      return recommendList.value
    }
    // 优先使用缓存
    if (categoryCache.value[category]) {
      if (!silent) recommendList.value = categoryCache.value[category]
      return categoryCache.value[category]
    }
    // 如果当前数据带有 category 字段（mock 模式），本地过滤即可
    const localResult = recommendList.value.filter(t => t.category === category)
    if (localResult.length > 0) {
      categoryCache.value[category] = localResult
      persistCategoryState()
      if (!silent) recommendList.value = localResult
      return localResult
    }
    // 真实 API 模式：调用 topPlaylist 获取歌单列表（展示为歌单卡片）
    if (!silent) loading.value = true
    try {
      const data = await topPlaylist({
        cat: category,
        limit: CATEGORY_PLAYLIST_LIMIT,
        offset: 0
      })
      const playlists = (data.playlists || []).filter(p => p.trackCount > 0)
      categoryCache.value[category] = playlists
      persistCategoryState()
      if (!silent) recommendList.value = playlists
      return playlists
    } catch (e) {
      console.error(`Failed to fetch category "${category}":`, e)
      if (!silent) recommendList.value = []
      return []
    } finally {
      if (!silent) loading.value = false
    }
  }

  async function search(keyword) {
    searchKeyword.value = keyword
    if (!keyword.trim()) {
      searchResults.value = []
      searchResultsByType.value = {
        tracks: [],
        playlists: [],
        artists: [],
        albums: []
      }
      return
    }
    searchLoading.value = true
    try {
      const limit = SEARCH_LIMIT
      const requests = Object.entries(SEARCH_TYPES).map(([type, code]) =>
        searchApi({ keywords: keyword, type: code, limit })
          .then(data => {
            const result = data.result || {}
            if (type === 'tracks')
              return { type, items: result.songs || result.song?.songs || [] }
            if (type === 'albums') return { type, items: result.albums || [] }
            if (type === 'artists') return { type, items: result.artists || [] }
            if (type === 'playlists')
              return { type, items: result.playlists || [] }
            return { type, items: [] }
          })
          .catch(() => ({ type, items: [] }))
      )
      const results = await Promise.all(requests)
      const byType = {}
      for (const { type, items } of results) {
        byType[type] = items
      }
      // 参考 YesPlayMusic：搜索 API 返回的歌曲属性名与详情 API 不同
      // 需要调用 getTrackDetail 获取完整曲目数据（ar/al/dt）
      if (byType.tracks && byType.tracks.length > 0) {
        const trackIDs = byType.tracks.map(t => t.id)
        try {
          const detailData = await getTrackDetail(trackIDs.join(','))
          if (detailData.songs && detailData.songs.length > 0) {
            byType.tracks = detailData.songs
          }
        } catch {
          // 详情获取失败，保留搜索原始数据
        }
      }
      searchResultsByType.value = byType
      // 兼容旧的 searchResults（默认显示单曲）
      searchResults.value = byType.tracks || []
    } catch (e) {
      console.error('Failed to search:', e)
      searchResultsByType.value = {
        tracks: [],
        playlists: [],
        artists: [],
        albums: []
      }
      searchResults.value = []
    } finally {
      searchLoading.value = false
    }
  }

  function setSearchType(type) {
    searchType.value = type
    searchResults.value = searchResultsByType.value[type] || []
  }

  function clearSearch() {
    searchKeyword.value = ''
    searchResults.value = []
    searchResultsByType.value = {
      tracks: [],
      playlists: [],
      artists: [],
      albums: []
    }
    searchType.value = 'tracks'
  }

  async function fetchLyrics(trackId) {
    // 解析并匹配翻译歌词，返回 lyric 数组
    const parseAndMatch = data => {
      const lrcText = data.lrc?.lyric || ''
      const tLrcText = data.tlyric?.lyric || ''
      const lyric = parseLRC(lrcText)
      const tlyric = parseLRC(tLrcText)
      // 按 rawTime 匹配翻译歌词（参考 YesPlayMusic lyricWithTranslation）
      if (tlyric.length > 0) {
        const tMap = new Map(tlyric.map(t => [t.rawTime, t.content]))
        for (const line of lyric) {
          const trans = tMap.get(line.rawTime)
          if (trans) line.translation = trans
        }
      }
      return lyric
    }

    // SWR：命中用旧值（解析后的数组），过期后台刷新，未命中等网络
    const fetchLatest = async () => {
      const data = await getLyric(trackId)
      const lyric = parseAndMatch(data)
      cacheLyric(trackId, lyric).catch(() => {})
      currentLyrics.value = lyric
      return lyric
    }

    try {
      const cached = await getLyricFromCache(trackId)
      if (cached) {
        currentLyrics.value = cached.lyric
        if (cached.stale) fetchLatest().catch(() => {})
        return currentLyrics.value
      }
      await fetchLatest()
    } catch (e) {
      console.error('Failed to fetch lyrics:', e)
      currentLyrics.value = []
    }
    return currentLyrics.value
  }

  // 参考 YesPlayMusic fetchPlayHistory action：从服务端拉取播放历史
  // 时间窗去重：FETCH_DEBOUNCE_PLAY_HISTORY 内不重复请求
  let _lastFetchHistoryAt = 0
  async function fetchPlayHistory(uid, force = false) {
    if (!uid) return
    if (
      !force &&
      Date.now() - _lastFetchHistoryAt < FETCH_DEBOUNCE_PLAY_HISTORY
    )
      return
    _lastFetchHistoryAt = Date.now()
    historyLoading.value = true
    try {
      const [allResult, weekResult] = await Promise.all([
        userPlayHistory({ uid, type: 0 }), // type=0: allData
        userPlayHistory({ uid, type: 1 }) // type=1: weekData
      ])
      const allData = (allResult.allData || []).map(item => ({
        ...item.song,
        playCount: item.playCount
      }))
      const weekData = (weekResult.weekData || []).map(item => ({
        ...item.song,
        playCount: item.playCount
      }))
      serverPlayHistory.value = { allData, weekData }
    } catch (e) {
      console.error('Failed to fetch play history:', e)
    }
    historyLoading.value = false
  }

  // 每日推荐缓存
  const dailyRecommend = ref({ songs: [], playlists: [], date: '' })
  const dailyRecommendLoading = ref(false)

  function getLocalDate() {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  }

  function isToday(dateStr) {
    if (!dateStr) return false
    return dateStr === getLocalDate()
  }

  async function fetchDailyRecommend(force = false) {
    // 如果有缓存且是今天的数据，直接返回
    if (!force && isToday(dailyRecommend.value.date)) {
      return dailyRecommend.value
    }

    dailyRecommendLoading.value = true
    try {
      const [songsData, playlistsData] = await Promise.all([
        dailyRecommendTracks(),
        dailyRecommendPlaylist()
      ])
      dailyRecommend.value = {
        songs: songsData.data?.dailySongs || [],
        playlists: playlistsData.recommend || [],
        date: getLocalDate()
      }
    } catch (e) {
      console.error('Failed to fetch daily recommend:', e)
      throw e
    } finally {
      dailyRecommendLoading.value = false
    }
    return dailyRecommend.value
  }

  // 排行榜相关状态
  const toplistData = ref([])
  const toplistLoading = ref(false)
  const toplistCache = ref({}) // key: 榜单id, value: { tracks, updateTime }

  async function fetchToplists(force = false) {
    if (!force && toplistData.value.length > 0) {
      return toplistData.value
    }
    toplistLoading.value = true
    try {
      const data = await toplists()
      toplistData.value = data.list || []
    } catch (e) {
      console.error('Failed to fetch toplists:', e)
      toplistData.value = []
    } finally {
      toplistLoading.value = false
    }
    return toplistData.value
  }

  async function fetchToplistDetail(id) {
    if (toplistCache.value[id]) {
      return toplistCache.value[id]
    }
    try {
      const data = await getPlaylistDetail(id)
      const tracks =
        data.playlist?.tracks?.slice(0, TOPLIST_PREVIEW_COUNT) || []
      toplistCache.value[id] = tracks
      return tracks
    } catch (e) {
      console.error(`Failed to fetch toplist detail for ${id}:`, e)
      return []
    }
  }

  // 参考 YesPlayMusic ModalNewPlaylist.createPlaylist
  async function createPlaylist(name, description = '') {
    // 1. 先调网易云 API 创建歌单
    const result = await createPlaylistApi({ name, privacy: 10 })
    if (result.code !== 200) {
      throw new Error(result.message || '创建歌单失败')
    }
    const serverId = result.id
    // 2. 本地也保存一份（用于离线展示）
    const playlist = {
      id: serverId,
      name,
      description,
      coverUrl: `https://placehold.co/300x300/1E1E2E/3B82F6?text=${encodeURIComponent(name)}`,
      tracks: [],
      createdAt: new Date().toISOString()
    }
    userPlaylists.value.unshift(playlist)
    persistPlaylists()
    return playlist
  }

  function updatePlaylist(id, data) {
    const idx = userPlaylists.value.findIndex(p => p.id === id)
    if (idx !== -1) {
      userPlaylists.value[idx] = { ...userPlaylists.value[idx], ...data }
      persistPlaylists()
    }
  }

  // 参考 YesPlayMusic playlist_delete API
  async function deletePlaylist(id) {
    // 1. 先调网易云 API 删除歌单
    await deletePlaylistApi({ id })
    // 2. 服务端删除成功后再本地删除
    userPlaylists.value = userPlaylists.value.filter(p => p.id !== id)
    persistPlaylists()
  }

  function addTrackToPlaylist(playlistId, track) {
    const playlist = userPlaylists.value.find(p => p.id === playlistId)
    if (playlist && !playlist.tracks.some(t => t.id === track.id)) {
      playlist.tracks.push(track)
      persistPlaylists()
    }
  }

  function removeTrackFromPlaylist(playlistId, trackId) {
    const playlist = userPlaylists.value.find(p => p.id === playlistId)
    if (playlist) {
      playlist.tracks = playlist.tracks.filter(t => t.id !== trackId)
      persistPlaylists()
    }
  }

  function persistPlaylists() {
    localStorage.setItem(
      STORAGE_KEYS.PLAYLISTS,
      JSON.stringify(userPlaylists.value)
    )
  }

  function restorePlaylists() {
    const saved = localStorage.getItem(STORAGE_KEYS.PLAYLISTS)
    if (!saved) return
    try {
      userPlaylists.value = JSON.parse(saved)
    } catch (e) {
      console.error('Failed to restore playlists:', e)
    }
  }

  // 持久化分类缓存和激活状态（最多保留 10 个分类，防止 localStorage 超限）
  const MAX_CATEGORY_CACHE = 10

  function persistCategoryState() {
    const keys = Object.keys(categoryCache.value)
    if (keys.length > MAX_CATEGORY_CACHE) {
      // 保留「全部」+ 最近访问的分类（按插入顺序，淘汰最早的）
      const keep = keys.slice(-MAX_CATEGORY_CACHE)
      const trimmed = {}
      for (const k of keep) trimmed[k] = categoryCache.value[k]
      categoryCache.value = trimmed
    }
    localStorage.setItem(
      STORAGE_KEYS.CATEGORY_STATE,
      JSON.stringify({
        categoryCache: categoryCache.value,
        activeCategory: activeCategory.value
      })
    )
  }

  function restoreCategoryState() {
    const saved = localStorage.getItem(STORAGE_KEYS.CATEGORY_STATE)
    if (!saved) return
    try {
      const data = JSON.parse(saved)
      if (data.categoryCache && typeof data.categoryCache === 'object') {
        categoryCache.value = data.categoryCache
      }
      if (data.activeCategory) {
        activeCategory.value = data.activeCategory
      }
    } catch (e) {
      console.error('Failed to restore category state:', e)
    }
  }

  function getTrackById(id) {
    const nid = Number(id)
    // 先在当前列表查找
    let track = recommendList.value.find(t => t.id === nid)
    if (track) return track
    // 再在分类缓存中查找
    for (const cat of Object.values(categoryCache.value)) {
      track = cat.find(t => t.id === nid)
      if (track) return track
    }
    // 最后在搜索结果中查找
    track = searchResults.value.find(t => t.id === nid)
    return track || null
  }

  return {
    recommendList,
    categoryList,
    activeCategory,
    searchResults,
    searchKeyword,
    searchType,
    searchResultsByType,
    searchLoading,
    userPlaylists,
    currentLyrics,
    loading,
    serverPlayHistory,
    historyLoading,
    dailyRecommend,
    dailyRecommendLoading,
    filteredList,
    toplistData,
    toplistLoading,
    toplistCache,
    fetchRecommend,
    fetchCategoryList,
    search,
    setSearchType,
    clearSearch,
    filterByCategory,
    fetchLyrics,
    fetchPlayHistory,
    fetchDailyRecommend,
    fetchToplists,
    fetchToplistDetail,
    createPlaylist,
    updatePlaylist,
    deletePlaylist,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
    restorePlaylists,
    restoreCategoryState,
    getTrackById
  }
})
