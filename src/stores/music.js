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
  updatePlaylistName,
  updatePlaylistDescription,
  subscribePlaylist as subscribePlaylistApi,
  addTracksToPlaylist,
  invalidatePlaylistCache,
  dailyRecommendTracks,
  dailyRecommendPlaylist,
  toplists,
  getPlaylistDetail,
  playlistCatlist
} from '@/api/playlist'
import { search as searchApi, SEARCH_TYPES } from '@/api/others'
import { getLyric, getTrackDetail } from '@/api/track'
import { userPlayHistory, userPlaylist, invalidateUserPlaylistCache } from '@/api/user'
import { parseLRC } from '@/utils/common'
import { cacheLyric, getLyricFromCache } from '@/utils/db'

export const useMusicStore = defineStore('music', () => {
  const recommendList = ref([])
  const categoryList = ref(['全部'])
  const searchResults = ref([])
  const searchKeyword = ref('')
  const searchVisible = ref(false)
  const searchReturnContext = ref(null)
  const searchType = ref('tracks') // 当前搜索类型 Tab
  const searchResultsByType = ref({
    tracks: [],
    playlists: [],
    artists: [],
    albums: []
  })
  const searchPageByType = ref({})
  const searchLoading = computed(() => searchPageByType.value[searchType.value]?.loading || false)
  let searchGeneration = 0
  const freshPage = () => ({ loading: false, error: '', offset: 0, hasMore: true, total: null })
  const userPlaylists = ref([])
  const serverPlaylists = ref([])
  const playlistsLoading = ref(false)
  const playlistsError = ref('')
  const playlistChanges = ref({})
  let accountUid = null
  let accountGeneration = 0
  let playlistGeneration = 0

  function setAccount(uid) {
    if (String(uid) === String(accountUid)) return
    accountUid = uid
    accountGeneration++
    playlistGeneration++
    serverPlaylists.value = []
    playlistsLoading.value = false
    playlistsError.value = ''
    playlistChanges.value = {}
    serverPlayHistory.value = { weekData: [], allData: [] }
    historyLoading.value = false
    _lastFetchHistoryAt = 0
    dailyRecommend.value = { songs: [], playlists: [], date: '' }
    dailyRecommendLoading.value = false
    clearSearch()
    clearLyrics()
  }

  async function fetchUserPlaylists(uid = accountUid, force = false) {
    if (!uid) return []
    const token = ++playlistGeneration
    const account = accountGeneration
    playlistsLoading.value = true
    playlistsError.value = ''
    try {
      const data = await userPlaylist({ uid, limit: 1000 }, { forceRefresh: force || !serverPlaylists.value.length })
      if (token !== playlistGeneration || account !== accountGeneration) return []
      serverPlaylists.value = data.playlist || []
      return serverPlaylists.value
    } catch (e) {
      if (token === playlistGeneration && account === accountGeneration) playlistsError.value = e.message || '歌单加载失败，请重试'
      throw e
    } finally {
      if (token === playlistGeneration) playlistsLoading.value = false
    }
  }

  async function refreshAfterWrite(id, uid, token) {
    await Promise.all([
      invalidateUserPlaylistCache(uid).catch(() => {}),
      id == null ? Promise.resolve() : invalidatePlaylistCache(id).catch(() => {})
    ])
    if (token !== accountGeneration) return
    if (id != null) playlistChanges.value[id] = (playlistChanges.value[id] || 0) + 1
    try { await fetchUserPlaylists(uid, true) }
    catch { playlistsError.value = '云端已保存，但列表刷新失败，请重试加载' }
  }

  async function changePlaylist(id, write) {
    if (!accountUid) throw new Error('请先登录')
    const uid = accountUid
    const token = accountGeneration
    try { return await write() }
    finally { await refreshAfterWrite(id, uid, token) }
  }
  const currentLyrics = ref([])
  const currentLyricsTrackId = ref(null)
  let lyricsGeneration = 0
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

  async function loadMoreSearch(type = searchType.value) {
    const keyword = searchKeyword.value.trim()
    const page = searchPageByType.value[type]
    if (!keyword || !page || page.loading || !page.hasMore) return
    const token = searchGeneration
    page.loading = true
    page.error = ''
    try {
      const data = await searchApi({ keywords: keyword, type: SEARCH_TYPES[type], limit: SEARCH_LIMIT, offset: page.offset })
      if (data.code !== undefined && Number(data.code) !== 200) throw new Error(data.message || '搜索失败')
      const result = data.result || {}
      const field = { tracks: 'songs', playlists: 'playlists', artists: 'artists', albums: 'albums' }[type]
      const raw = result[field] || (type === 'tracks' ? result.song?.songs : []) || []
      let items = raw
      if (type === 'tracks' && raw.length) {
        try {
          const details = await getTrackDetail(raw.map(t => t.id).join(','))
          const byId = new Map((details.songs || []).map(t => [String(t.id), t]))
          items = raw.map(t => byId.get(String(t.id)) || t)
        } catch { /* 详情不可用时保留搜索结果 */ }
      }
      if (token !== searchGeneration) return
      const existing = searchResultsByType.value[type]
      const seen = new Set(existing.map(t => String(t.id)))
      searchResultsByType.value[type] = [...existing, ...items.filter(t => {
        if (seen.has(String(t.id))) return false
        seen.add(String(t.id))
        return true
      })]
      page.offset += raw.length
      const countField = { tracks: 'songCount', playlists: 'playlistCount', artists: 'artistCount', albums: 'albumCount' }[type]
      page.total = Number.isFinite(result[countField]) ? result[countField] : null
      page.hasMore = raw.length > 0 && (page.total !== null ? page.offset < page.total : result.hasMore ?? raw.length === SEARCH_LIMIT)
      if (searchType.value === type) searchResults.value = searchResultsByType.value[type]
    } catch (e) {
      if (token === searchGeneration) page.error = e.message || '搜索失败，请重试'
    } finally {
      if (token === searchGeneration) page.loading = false
    }
  }

  async function search(keyword) {
    clearSearch()
    searchKeyword.value = keyword.trim()
    if (!searchKeyword.value) return
    searchVisible.value = true
    await Promise.all(Object.keys(SEARCH_TYPES).map(type => loadMoreSearch(type)))
  }

  function setSearchType(type) {
    searchType.value = type
    searchResults.value = searchResultsByType.value[type] || []
  }

  function clearSearch() {
    searchGeneration++
    searchVisible.value = false
    searchReturnContext.value = null
    searchKeyword.value = ''
    searchResults.value = []
    searchResultsByType.value = { tracks: [], playlists: [], artists: [], albums: [] }
    searchPageByType.value = Object.fromEntries(Object.keys(SEARCH_TYPES).map(type => [type, freshPage()]))
    searchType.value = 'tracks'
  }

  function suspendSearch(context) {
    searchReturnContext.value = { ...context, generation: searchGeneration }
    searchVisible.value = false
    return searchReturnContext.value
  }

  function resumeSearch() {
    if (
      searchReturnContext.value?.generation !== searchGeneration ||
      !searchKeyword.value
    ) return
    searchVisible.value = true
  }

  async function fetchLyrics(trackId) {
    trackId = Number(trackId)
    const requestId = ++lyricsGeneration
    currentLyricsTrackId.value = trackId
    currentLyrics.value = []
    const isCurrent = () =>
      requestId === lyricsGeneration && currentLyricsTrackId.value === trackId
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
      if (isCurrent()) currentLyrics.value = lyric
      return lyric
    }

    try {
      const cached = await getLyricFromCache(trackId).catch(() => null)
      if (!isCurrent()) return []
      if (cached) {
        currentLyrics.value = cached.lyric
        if (cached.stale) fetchLatest().catch(() => {})
        return cached.lyric
      }
      return await fetchLatest()
    } catch (e) {
      console.error('Failed to fetch lyrics:', e)
      if (isCurrent()) currentLyrics.value = []
    }
    return []
  }

  function clearLyrics() {
    lyricsGeneration++
    currentLyricsTrackId.value = null
    currentLyrics.value = []
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
    const token = accountGeneration
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
      if (token !== accountGeneration) return
      serverPlayHistory.value = { allData, weekData }
    } catch (e) {
      if (token === accountGeneration) _lastFetchHistoryAt = 0
      console.error('Failed to fetch play history:', e)
    }
    if (token === accountGeneration) historyLoading.value = false
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

    const token = accountGeneration
    dailyRecommendLoading.value = true
    try {
      const [songsData, playlistsData] = await Promise.all([
        dailyRecommendTracks(),
        dailyRecommendPlaylist()
      ])
      if (token !== accountGeneration) return dailyRecommend.value
      dailyRecommend.value = {
        songs: songsData.data?.dailySongs || [],
        playlists: playlistsData.recommend || [],
        date: getLocalDate()
      }
    } catch (e) {
      console.error('Failed to fetch daily recommend:', e)
      throw e
    } finally {
      if (token === accountGeneration) dailyRecommendLoading.value = false
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

  async function createPlaylist(name, description = '') {
    if (!accountUid) throw new Error('请先登录')
    const uid = accountUid
    const token = accountGeneration
    const result = await createPlaylistApi({ name, privacy: 10 })
    const id = result.id || result.playlist?.id
    if (!id) throw new Error('创建响应缺少歌单编号，请刷新列表确认')
    try {
      if (description) await updatePlaylistDescription(id, description)
    } catch (cause) {
      const error = new Error(`歌单已创建，但简介未保存：${cause.message}`)
      error.playlistId = id
      throw error
    } finally {
      await refreshAfterWrite(id, uid, token)
    }
    return { id, name, description }
  }

  async function updatePlaylist(id, data) {
    return changePlaylist(id, async () => {
      await updatePlaylistName(id, data.name)
      try { await updatePlaylistDescription(id, data.description || '') }
      catch (cause) { throw new Error(`名称已保存，但简介未保存：${cause.message}`, { cause }) }
    })
  }

  function deletePlaylist(id) {
    return changePlaylist(id, () => deletePlaylistApi({ id }))
  }

  function setPlaylistSubscribed(id, subscribed) {
    return changePlaylist(id, () => subscribePlaylistApi(id, subscribed))
  }

  function changePlaylistTracks(id, trackIds, op) {
    return changePlaylist(id, () => addTracksToPlaylist({ pid: id, tracks: trackIds.join(','), op }))
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
    searchVisible,
    searchReturnContext,
    suspendSearch,
    resumeSearch,
    searchType,
    searchResultsByType,
    searchLoading,
    searchPageByType,
    loadMoreSearch,
    userPlaylists,
    serverPlaylists,
    playlistsLoading,
    playlistsError,
    playlistChanges,
    setAccount,
    fetchUserPlaylists,
    changePlaylistTracks,
    setPlaylistSubscribed,
    currentLyrics,
    currentLyricsTrackId,
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
    clearLyrics,
    fetchPlayHistory,
    fetchDailyRecommend,
    fetchToplists,
    fetchToplistDetail,
    createPlaylist,
    updatePlaylist,
    deletePlaylist,
    restorePlaylists,
    restoreCategoryState,
    getTrackById
  }
})
