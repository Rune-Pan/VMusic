import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import {
  loginWithPhone,
  loginWithCaptcha as loginWithCaptchaApi,
  logout as logoutApi
} from '@/api/auth'
import { userAccount, userLikedSongsIDs, updateUserProfile } from '@/api/user'
import { getTrackDetail } from '@/api/track'
import { setCookies } from '@/utils/common'
import { clearTrackSourceCache } from '@/utils/db'
import {
  STORAGE_KEYS,
  PLACEHOLDER_AVATAR_80,
  FETCH_DEBOUNCE_LIKED_SONGS
} from '@/constants'

export const useUserStore = defineStore('user', () => {
  const isLoggedIn = ref(false)
  const userInfo = ref({
    id: null,
    nickname: '',
    avatar: '',
    account: '',
    vipType: 0,
    showVipBadge: true
  })
  // 参考 YesPlayMusic state.liked.songs：用户喜欢的歌曲 ID 集合
  const likedSongIds = ref(new Set())
  // 喜欢的歌曲详情（提升到 store 跨导航保留，仅内存，刷新靠 ID + trackDetail SWR 重建）
  const likedTracks = ref([])
  const likedTracksLoading = ref(false)

  const avatarUrl = computed(() => {
    if (userInfo.value.avatar) return userInfo.value.avatar
    return PLACEHOLDER_AVATAR_80
  })

  const isLiked = computed(() => id => likedSongIds.value.has(id))

  async function login(credentials) {
    try {
      const data = await loginWithPhone({
        phone: credentials.account,
        password: credentials.password
      })
      if (data.code === 200 && data.profile) {
        isLoggedIn.value = true
        userInfo.value = {
          id: data.profile.userId || data.account?.id || Date.now(),
          nickname: data.profile.nickname || credentials.account,
          avatar: data.profile.avatarUrl || '',
          account: credentials.account,
          vipType: data.account?.vipType ?? 0,
          showVipBadge: userInfo.value.showVipBadge ?? true
        }
        persist()
        fetchLikedSongs()
        return true
      }
      return false
    } catch (e) {
      console.error('Login failed:', e)
      return false
    }
  }

  // 手机号 + 验证码登录（参考 login，复用登录后处理）
  async function loginWithCaptcha(phone, captcha) {
    try {
      const data = await loginWithCaptchaApi({ phone, captcha })
      if (data.code === 200 && data.profile) {
        isLoggedIn.value = true
        userInfo.value = {
          id: data.profile.userId || data.account?.id || Date.now(),
          nickname: data.profile.nickname || phone,
          avatar: data.profile.avatarUrl || '',
          account: phone,
          vipType: data.account?.vipType ?? 0,
          showVipBadge: userInfo.value.showVipBadge ?? true
        }
        persist()
        fetchLikedSongs()
        return true
      }
      return false
    } catch (e) {
      console.error('Captcha login failed:', e)
      return false
    }
  }

  // 参考 YesPlayMusic handleLoginResponse + fetchUserProfile
  async function loginWithQrCode(cookie) {
    try {
      setCookies(cookie)
      // 拉取用户资料
      const result = await userAccount()
      if (result.code === 200 && result.profile) {
        isLoggedIn.value = true
        userInfo.value = {
          id: result.profile.userId || result.account?.id || Date.now(),
          nickname: result.profile.nickname || '听潮用户',
          avatar: result.profile.avatarUrl || '',
          account: result.account?.userName || '',
          vipType: result.account?.vipType ?? 0,
          showVipBadge: userInfo.value.showVipBadge ?? true
        }
        persist()
        fetchLikedSongs()
        return true
      }
      return false
    } catch (e) {
      console.error('QR Login failed:', e)
      return false
    }
  }

  async function logout() {
    // 先清除本地状态，确保 UI 立即响应
    isLoggedIn.value = false
    userInfo.value = {
      id: null,
      nickname: '',
      avatar: '',
      account: '',
      vipType: 0,
      showVipBadge: true
    }
    likedSongIds.value.clear()
    likedTracks.value = []
    localStorage.removeItem(STORAGE_KEYS.USER)
    // 清空音频 url 缓存，避免切账号后命中上一账号的试听/完整版 url
    clearTrackSourceCache().catch(() => {})
    // 后台调用登出 API（不阻塞 UI）
    try {
      await logoutApi()
    } catch (e) {
      console.error('Logout API failed:', e)
    }
  }

  // 参考 YesPlayMusic fetchLikedSongs action
  // 时间窗去重：FETCH_DEBOUNCE_LIKED_SONGS 内不重复请求
  // inflight 合并：进行中的请求复用同 Promise，避免登录时 fetchLikedTracks 误判 ID 为空
  let _lastFetchLikedAt = 0
  let _fetchingLikedPromise = null
  async function fetchLikedSongs(force = false) {
    if (!isLoggedIn.value || !userInfo.value.id) return
    if (_fetchingLikedPromise) return _fetchingLikedPromise
    if (!force && Date.now() - _lastFetchLikedAt < FETCH_DEBOUNCE_LIKED_SONGS)
      return
    _fetchingLikedPromise = (async () => {
      try {
        const result = await userLikedSongsIDs(userInfo.value.id)
        // 非空数组才视为成功：登录瞬间可能返回空数组（后端未同步），不锁、可重试
        if (result.ids?.length) {
          likedSongIds.value = new Set(result.ids)
          persist()
          // 仅成功才更新时间戳，失败可重试不被去重锁死
          _lastFetchLikedAt = Date.now()
        }
      } catch (e) {
        console.error('Failed to fetch liked songs:', e)
      } finally {
        _fetchingLikedPromise = null
      }
    })()
    return _fetchingLikedPromise
  }

  function addLikedSong(id) {
    // 整体重新赋值 Set 触发响应式（Set.add 不被 ref 拦截）
    const next = new Set(likedSongIds.value)
    next.add(id)
    likedSongIds.value = next
    persist()
    // 不立即 fetchLikedTracks：服务端在 likeSong API 完成前未更新，
    // 强行拉会用旧数据覆盖乐观更新。详情列表下次进入页面时拉。
  }

  function removeLikedSong(id) {
    const next = new Set(likedSongIds.value)
    next.delete(id)
    likedSongIds.value = next
    persist()
  }

  // 喜欢的歌曲详情：复用 ID 集合的 10 分钟窗口，过期或 force 才重拉
  let _lastFetchLikedTracksAt = 0
  async function fetchLikedTracks(force = false) {
    if (!isLoggedIn.value) return
    // ID 为空时不走去重，允许重试拉取
    if (
      !force &&
      likedSongIds.value.size > 0 &&
      Date.now() - _lastFetchLikedTracksAt < FETCH_DEBOUNCE_LIKED_SONGS
    ) {
      return
    }
    // 先确保 ID 集合是最新的；ID 为空时强制重拉（绕过 fetchLikedSongs 去重，避免登录后空列表）
    await fetchLikedSongs(force || likedSongIds.value.size === 0)
    const ids = Array.from(likedSongIds.value)
    if (ids.length === 0) {
      likedTracks.value = []
      // 空列表不锁窗口，允许下次重试（登录瞬间可能 ID 未就绪）
      return
    }
    likedTracksLoading.value = true
    _lastFetchLikedTracksAt = Date.now()
    try {
      const data = await getTrackDetail(ids.join(','))
      likedTracks.value = data.songs || []
    } catch (e) {
      console.error('Failed to fetch liked tracks:', e)
      likedTracks.value = []
    } finally {
      likedTracksLoading.value = false
    }
  }

  // 设置黑胶VIP角标显隐（纯本地偏好，即时持久化）
  function setShowVipBadge(val) {
    userInfo.value.showVipBadge = val
    persist()
  }

  async function updateProfile(data) {
    try {
      // 调用网易云 API 更新用户信息
      const params = {}
      if (data.nickname) params.nickname = data.nickname
      if (data.avatar) params.avatarUrl = data.avatar
      if (data.signature !== undefined) params.signature = data.signature
      if (data.gender !== undefined) params.gender = data.gender

      await updateUserProfile(params)
      // 更新本地状态
      userInfo.value = { ...userInfo.value, ...data }
      persist()
      return true
    } catch (e) {
      console.error('Failed to update profile:', e)
      throw e
    }
  }

  function persist() {
    localStorage.setItem(
      STORAGE_KEYS.USER,
      JSON.stringify({
        isLoggedIn: isLoggedIn.value,
        userInfo: userInfo.value,
        likedSongIds: Array.from(likedSongIds.value)
      })
    )
  }

  function restore() {
    const saved = localStorage.getItem(STORAGE_KEYS.USER)
    if (!saved) return
    try {
      const data = JSON.parse(saved)
      isLoggedIn.value = data.isLoggedIn ?? false
      userInfo.value = data.userInfo ?? {
        id: null,
        nickname: '',
        avatar: '',
        account: '',
        vipType: 0,
        showVipBadge: true
      }
      // 旧 localStorage 数据可能缺 showVipBadge，补默认值
      if (userInfo.value.showVipBadge === undefined) {
        userInfo.value.showVipBadge = true
      }
      // 恢复喜欢的歌曲 ID 集合
      if (data.likedSongIds && Array.isArray(data.likedSongIds)) {
        likedSongIds.value = new Set(data.likedSongIds)
      }
    } catch (e) {
      console.error('Failed to restore user state:', e)
    }
  }

  return {
    isLoggedIn,
    userInfo,
    avatarUrl,
    likedSongIds,
    likedTracks,
    likedTracksLoading,
    isLiked,
    login,
    loginWithCaptcha,
    loginWithQrCode,
    logout,
    updateProfile,
    setShowVipBadge,
    fetchLikedSongs,
    fetchLikedTracks,
    addLikedSong,
    removeLikedSong,
    restore
  }
})
