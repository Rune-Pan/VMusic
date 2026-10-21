import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import {
  loginWithPhone,
  loginWithCaptcha as loginWithCaptchaApi,
  logout as logoutApi
} from '@/api/auth'
import { userAccount, userLikedSongsIDs, updateUserProfile } from '@/api/user'
import { getTrackDetail, resetTrackSourceCache } from '@/api/track'
import { setCookies } from '@/utils/common'
import { usePlayerStore } from '@/stores/player'
import { useMusicStore } from '@/stores/music'
import { isSessionExpired, requireApiSuccess } from '@/utils/apiResult'
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

  const isLiked = computed(() => id => [...likedSongIds.value].some(item => String(item) === String(id)))

  const sessionStatus = ref('unknown')
  const sessionError = ref('')
  let restored = false
  let savedSession = false
  let generation = 0
  let likedRevision = 0
  let sessionPromise = null
  let logoutPromise = null
  let lastLikedAt = 0
  let lastTracksAt = 0
  let fetchingLiked = null
  const sameId = (a, b) => String(a) === String(b)

  function resetAccount() {
    generation++
    likedRevision++
    fetchingLiked = null
    sessionPromise = null
    lastLikedAt = 0
    lastTracksAt = 0
    likedSongIds.value = new Set()
    likedTracks.value = []
    likedTracksLoading.value = false
    usePlayerStore().suspend()
    useMusicStore().setAccount(null)
    resetTrackSourceCache()
  }

  function acceptSession(data, account = '') {
    resetAccount()
    userInfo.value = {
      id: data.profile.userId || data.account?.id,
      nickname: data.profile.nickname || '听潮用户',
      avatar: data.profile.avatarUrl || '',
      account: account || data.account?.userName || '',
      vipType: data.account?.vipType ?? 0,
      showVipBadge: userInfo.value.showVipBadge ?? true
    }
    useMusicStore().setAccount(userInfo.value.id)
    savedSession = true
    sessionStatus.value = 'valid'
    sessionError.value = ''
    isLoggedIn.value = true
    persist()
    fetchLikedSongs()
  }

  async function authenticate(fetchAccount, account = '') {
    await logoutPromise
    const token = ++generation
    try {
      const data = requireApiSuccess(await fetchAccount(), '登录失败')
      if (token !== generation || !data.profile) return false
      acceptSession(data, account)
      return true
    } catch (e) {
      console.error('Login failed:', e)
      return false
    }
  }

  function login(credentials) {
    return authenticate(() => loginWithPhone({
      phone: credentials.account, password: credentials.password
    }), credentials.account)
  }

  function loginWithCaptcha(phone, captcha) {
    return authenticate(() => loginWithCaptchaApi({ phone, captcha }), phone)
  }

  function loginWithQrCode(cookie) {
    return authenticate(() => {
      setCookies(cookie)
      return userAccount()
    })
  }

  function expireSession() {
    resetAccount()
    savedSession = false
    sessionStatus.value = 'anonymous'
    sessionError.value = ''
    isLoggedIn.value = false
    userInfo.value = { id: null, nickname: '', avatar: '', account: '', vipType: 0, showVipBadge: true }
    localStorage.removeItem(STORAGE_KEYS.USER)
  }

  async function logout() {
    expireSession()
    logoutPromise = logoutApi().catch(e => console.error('Logout API failed:', e))
    await logoutPromise
    logoutPromise = null
  }

  function ensureSession() {
    restore()
    if (sessionStatus.value === 'valid') return Promise.resolve('valid')
    if (!savedSession) {
      sessionStatus.value = 'anonymous'
      return Promise.resolve('anonymous')
    }
    if (sessionPromise) return sessionPromise
    const token = generation
    sessionStatus.value = 'checking'
    const task = (async () => {
      try {
        const data = await userAccount()
        if (token !== generation) return sessionStatus.value
        if (isSessionExpired(data) || (Number(data.code) === 200 && !data.profile)) {
          expireSession()
        } else {
          requireApiSuccess(data, '无法校验登录状态')
          if (!data.profile?.userId) throw new Error('账号信息不完整')
          acceptSession(data)
        }
      } catch (e) {
        if (token !== generation) return sessionStatus.value
        if (isSessionExpired(e.response?.data) || e.code === 301) expireSession()
        else {
          sessionStatus.value = 'error'
          sessionError.value = '暂时无法校验登录状态，请检查网络后重试'
        }
      } finally {
        if (sessionPromise === task) sessionPromise = null
      }
      return sessionStatus.value
    })()
    sessionPromise = task
    return task
  }

  async function fetchLikedSongs(force = false) {
    if (!isLoggedIn.value || !userInfo.value.id) return
    if (fetchingLiked) return fetchingLiked
    if (!force && Date.now() - lastLikedAt < FETCH_DEBOUNCE_LIKED_SONGS) return
    const token = generation
    const revision = likedRevision
    const uid = userInfo.value.id
    const task = (async () => {
      try {
        const result = await userLikedSongsIDs(uid)
        if (token !== generation || revision !== likedRevision) return
        if (Array.isArray(result.ids)) {
          likedSongIds.value = new Set(result.ids)
          likedTracks.value = likedTracks.value.filter(t => result.ids.some(id => sameId(id, t.id)))
          lastLikedAt = Date.now()
          persist()
        }
      } catch (e) {
        console.error('Failed to fetch liked songs:', e)
      } finally {
        if (fetchingLiked === task) fetchingLiked = null
      }
    })()
    fetchingLiked = task
    return task
  }

  function addLikedSong(id, track) {
    if (!isLoggedIn.value) return
    likedRevision++
    likedSongIds.value = new Set([...likedSongIds.value, Number(id)])
    lastLikedAt = Date.now()
    lastTracksAt = 0
    persist()
    if (track) {
      likedTracks.value = [track, ...likedTracks.value.filter(t => !sameId(t.id, id))]
    } else {
      const token = generation
      getTrackDetail(String(id)).then(data => {
        if (token !== generation || !isLiked.value(Number(id))) return
        const item = data.songs?.[0]
        if (item && !likedTracks.value.some(t => sameId(t.id, id))) likedTracks.value.unshift(item)
      }).catch(() => {})
    }
  }

  function removeLikedSong(id) {
    likedRevision++
    likedSongIds.value = new Set([...likedSongIds.value].filter(item => !sameId(item, id)))
    likedTracks.value = likedTracks.value.filter(t => !sameId(t.id, id))
    lastLikedAt = Date.now()
    lastTracksAt = 0
    persist()
  }

  async function fetchLikedTracks(force = false) {
    if (!isLoggedIn.value) return
    if (!force && lastTracksAt && Date.now() - lastTracksAt < FETCH_DEBOUNCE_LIKED_SONGS) return
    const token = generation
    await fetchLikedSongs(force)
    if (token !== generation) return
    const revision = likedRevision
    const ids = [...likedSongIds.value]
    if (!ids.length) { likedTracks.value = []; return }
    likedTracksLoading.value = true
    try {
      const data = await getTrackDetail(ids.join(','))
      if (token !== generation || revision !== likedRevision) return
      likedTracks.value = data.songs || []
      lastTracksAt = Date.now()
    } catch (e) {
      console.error('Failed to fetch liked tracks:', e)
    } finally {
      if (token === generation) likedTracksLoading.value = false
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
    if (restored) return
    restored = true
    const saved = localStorage.getItem(STORAGE_KEYS.USER)
    if (!saved) return
    try {
      const data = JSON.parse(saved)
      savedSession = data.isLoggedIn === true && Boolean(data.userInfo?.id)
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
    sessionStatus,
    sessionError,
    ensureSession,
    expireSession,
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
