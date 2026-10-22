<script setup>
  import PlaylistFormModal from '@/components/PlaylistFormModal.vue'
  import { ref, computed, onMounted, watch, nextTick } from 'vue'
  import {
    Plus,
    Music,
    Settings,
    LogOut,
    History,
    Trash2,
    Heart,
    Play,
    Crown
  } from '@/components/icons'
  import { useUserStore } from '@/stores/user'
  import { useMusicStore } from '@/stores/music'
  import { useUiStore } from '@/stores/ui'
  import { usePlayerStore } from '@/stores/player'
  import { useRouter } from 'vue-router'
  import PlaylistCard from '@/components/PlaylistCard.vue'
  import TrackList from '@/components/TrackList.vue'
  import { STORAGE_KEYS } from '@/constants'
  import {
    MUSIC_QUALITY_OPTIONS,
    DEFAULT_MUSIC_QUALITY,
    LYRIC_FONT_SIZE_OPTIONS,
    DEFAULT_LYRIC_FONT_SIZE,
    THEME_OPTIONS,
    THEME_COLOR_OPTIONS,
    SHORTCUT_ACTIONS
  } from '@/constants'
  import { clearTrackSourceCache } from '@/utils/db'
  import { useTheme } from '@/composables/useTheme'
  import {
    useShortcuts,
    formatShortcut,
    eventToShortcut
  } from '@/composables/useShortcuts'
  import { usePreload, PRELOAD_ITEMS } from '@/composables/usePreload'
  import { getPageScrollContainer, scrollPageTo } from '@/utils/pageScroll'
  import { useSidebarAutoHide } from '@/composables/useSidebarAutoHide'
  import { useSidebarCollapse } from '@/composables/useSidebarCollapse'
  import { useCoverRotation } from '@/composables/useCoverRotation'

  const userStore = useUserStore()
  const musicStore = useMusicStore()
  const uiStore = useUiStore()
  const playerStore = usePlayerStore()
  const {
    enabled: coverRotationEnabled,
    secondsPerTurn,
    setEnabled: setCoverRotationEnabled,
    setSecondsPerTurn
  } = useCoverRotation()
  const router = useRouter()
  const { theme, setTheme, themeColor, setThemeColor } = useTheme()
  const { collapsed: sidebarCollapsed, setCollapsed: setSidebarCollapsed } = useSidebarCollapse()
  const {
    enabled: sidebarAutoHide,
    triggerWidth: sidebarTriggerWidth,
    hideDelay: sidebarHideDelay,
    setEnabled: setSidebarAutoHide,
    setTriggerWidth: setSidebarTriggerWidth,
    setHideDelay: setSidebarHideDelay
  } = useSidebarAutoHide()
  function changeTheme(value) {
    setTheme(value)
  }
  function changeThemeColor(value) {
    setThemeColor(value)
  }

  // 快捷键
  const {
    enabled: shortcutsEnabled,
    shortcuts,
    setEnabled: setShortcutsEnabled,
    setShortcut,
    resetShortcut,
    resetAllShortcuts,
    findConflict
  } = useShortcuts()
  // 当前正在录制的 action id（null 表示未录制）
  const recordingId = ref(null)
  // 录制时的冲突提示
  const conflictMsg = ref('')

  function startRecording(actionId) {
    recordingId.value = actionId
    conflictMsg.value = ''
  }

  function cancelRecording() {
    recordingId.value = null
    conflictMsg.value = ''
  }

  // 录制按键：在按钮上监听 keydown
  function onRecordKeydown(e, actionId) {
    if (recordingId.value !== actionId) return
    if (e.key === 'Tab') {
      cancelRecording()
      return
    }
    e.preventDefault()
    e.stopPropagation()
    // ESC 取消录制（不录制为键位）
    if (e.key === 'Escape') {
      cancelRecording()
      return
    }
    // 单独的修饰键不算完整键位，忽略
    const modifierOnly = ['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)
    if (modifierOnly) return

    const sc = eventToShortcut(e)
    // 规则：除 Space 外必须带修饰键
    if (sc.key !== ' ' && !sc.ctrl && !sc.alt && !sc.shift) {
      conflictMsg.value = '需配合 Ctrl/Alt/Shift 修饰键'
      return
    }
    // 冲突检测
    const conflict = findConflict(actionId, sc)
    if (conflict) {
      conflictMsg.value = `该键位已被「${conflict.label}」占用`
      return
    }
    setShortcut(actionId, sc)
    recordingId.value = null
    conflictMsg.value = ''
    uiStore.showToast('快捷键已更新', 'success')
  }

  function onResetShortcut(actionId) {
    resetShortcut(actionId)
    conflictMsg.value = ''
  }

  function onResetAllShortcuts() {
    resetAllShortcuts()
    uiStore.showToast('已重置全部快捷键', 'success')
  }

  // 预加载
  const {
    config: preloadConfig,
    setEnabled: setPreloadEnabled,
    setItem: setPreloadItem
  } = usePreload()

  const settingsSections = [
    { key: 'appearance', label: '外观' },
    { key: 'playback', label: '播放与歌词' },
    { key: 'shortcuts', label: '快捷键' },
    { key: 'preload', label: '预加载' }
  ]
  const savedSettingsSection = localStorage.getItem(STORAGE_KEYS.SETTINGS_SECTION)
  const activeSettingsSection = ref(
    settingsSections.some(section => section.key === savedSettingsSection)
      ? savedSettingsSection : 'appearance'
  )
  const settingsForm = ref(null)
  const settingsTabs = ref(null)

  watch(settingsForm, (form, _, onCleanup) => {
    if (!form) return
    const container = getPageScrollContainer()
    // Clip the panel behind the sticky tabs so its fill cannot square off their corners.
    const updateClip = () => {
      if (!settingsTabs.value) return
      const top = Math.max(0,
        settingsTabs.value.getBoundingClientRect().top - form.getBoundingClientRect().top)
      form.style.setProperty('--settings-clip-top', `${top}px`)
    }
    updateClip()
    container?.addEventListener('scroll', updateClip, { passive: true })
    window.addEventListener('resize', updateClip)
    onCleanup(() => {
      container?.removeEventListener('scroll', updateClip)
      window.removeEventListener('resize', updateClip)
    })
  }, { flush: 'post' })

  async function selectSettingsSection(key) {
    const container = getPageScrollContainer()
    const top = container && settingsForm.value
      ? Math.min(container.scrollTop, container.scrollTop +
        settingsForm.value.getBoundingClientRect().top - container.getBoundingClientRect().top)
      : null
    cancelRecording()
    activeSettingsSection.value = key
    localStorage.setItem(STORAGE_KEYS.SETTINGS_SECTION, key)
    await nextTick()
    if (top !== null) scrollPageTo({ top: Math.max(0, top), behavior: 'instant' })
    settingsTabs.value?.querySelector(`[data-settings-section="${key}"]`)?.focus({ preventScroll: true })
  }

  function onSettingsTabKeydown(event, index) {
    if (event.altKey || event.ctrlKey || event.metaKey) return
    let nextIndex
    const last = settingsSections.length - 1
    switch (event.key) {
      case 'ArrowRight': nextIndex = (index + 1) % settingsSections.length; break
      case 'ArrowLeft': nextIndex = (index + last) % settingsSections.length; break
      case 'Home': nextIndex = 0; break
      case 'End': nextIndex = last; break
      default: return
    }
    event.preventDefault()
    event.stopPropagation()
    selectSettingsSection(settingsSections[nextIndex].key)
  }

  const activeMenu = ref('liked')
  const showPlaylistForm = ref(false)
  // 播放历史模式：'local' | 'week' | 'all'（参考 YesPlayMusic playHistoryMode）
  const historyMode = ref('local')

  // 音质偏好（参考上游 YesPlayMusic musicQuality）
  const musicQuality = ref(
    Number(localStorage.getItem(STORAGE_KEYS.MUSIC_QUALITY)) ||
      DEFAULT_MUSIC_QUALITY
  )
  function changeMusicQuality(value) {
    musicQuality.value = value
    localStorage.setItem(STORAGE_KEYS.MUSIC_QUALITY, String(value))
    // 切音质清空 url 缓存，下次播放按新音质重拉（对齐上游 clearCache）
    clearTrackSourceCache().catch(() => {})
    uiStore.showToast('音质已更新', 'success')
  }

  // 歌词字号偏好（参考上游 YesPlayMusic lyricFontSize）
  const lyricFontSize = ref(
    Number(localStorage.getItem(STORAGE_KEYS.LYRIC_FONT_SIZE)) ||
      DEFAULT_LYRIC_FONT_SIZE
  )
  function changeLyricFontSize(value) {
    lyricFontSize.value = value
    localStorage.setItem(STORAGE_KEYS.LYRIC_FONT_SIZE, String(value))
    uiStore.showToast('歌词字号已更新，重新进入播放页生效', 'success')
  }

  // 歌词翻译开关（参考上游 YesPlayMusic showLyricsTranslation，默认开）
  const showLyricsTranslation = ref(
    localStorage.getItem(STORAGE_KEYS.SHOW_LYRICS_TRANSLATION) !== 'false'
  )
  function setShowLyricsTranslation(value) {
    showLyricsTranslation.value = value
    localStorage.setItem(STORAGE_KEYS.SHOW_LYRICS_TRANSLATION, String(value))
    uiStore.showToast('设置已更新，重新进入播放页生效', 'success')
  }

  // 歌词时间显示开关（参考上游 YesPlayMusic showLyricsTime，默认关）
  const showLyricsTime = ref(
    localStorage.getItem(STORAGE_KEYS.SHOW_LYRICS_TIME) === 'true'
  )
  function setShowLyricsTime(value) {
    showLyricsTime.value = value
    localStorage.setItem(STORAGE_KEYS.SHOW_LYRICS_TIME, String(value))
    uiStore.showToast('设置已更新，重新进入播放页生效', 'success')
  }

  // 喜欢的歌曲（详情提升到 userStore，跨导航保留）
  const likedTracks = computed(() => userStore.likedTracks)
  const likedLoading = computed(() => userStore.likedTracksLoading)

  function playAllLiked() {
    if (likedTracks.value.length === 0) return
    playerStore.play(likedTracks.value[0], likedTracks.value)
  }

  const menuItems = [
    { key: 'liked', label: '喜欢的歌曲', icon: Heart },
    { key: 'playlists', label: '我的歌单', icon: Music },
    { key: 'history', label: '播放历史', icon: History },
    { key: 'settings', label: '个人设置', icon: Settings }
  ]

  function persistActiveMenu() {
    localStorage.setItem(STORAGE_KEYS.PROFILE_ACTIVE_MENU, activeMenu.value)
  }

  function restoreActiveMenu() {
    const saved = localStorage.getItem(STORAGE_KEYS.PROFILE_ACTIVE_MENU)
    if (saved && menuItems.some(item => item.key === saved)) {
      activeMenu.value = saved
    }
  }

  function selectMenu(key) {
    cancelRecording()
    activeMenu.value = key
    persistActiveMenu()
    // 滚动到页面顶部
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    scrollPageTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
  }

  // 网易云歌单
  const serverPlaylists = computed(() => musicStore.serverPlaylists || [])
  const serverPlaylistsLoading = computed(() => musicStore.playlistsLoading)

  // 按创建者分类：自己创建的 vs 收藏他人的
  const createdPlaylists = computed(() =>
    serverPlaylists.value.filter(
      p => p.creator?.userId === userStore.userInfo.id
    )
  )
  const subscribedPlaylists = computed(() =>
    serverPlaylists.value.filter(
      p => p.creator?.userId !== userStore.userInfo.id
    )
  )

  async function fetchServerPlaylists(force = false) {
    if (!userStore.isLoggedIn) return
    try { await musicStore.fetchUserPlaylists(userStore.userInfo.id, force) }
    catch { /* 页面展示可重试错误 */ }
  }

  function clearHistory() {
    playerStore.clearHistory()
    uiStore.showToast('播放历史已清空', 'success')
  }

  // 参考 YesPlayMusic playHistoryList computed
  const historyTracks = computed(() => {
    if (historyMode.value === 'local') {
      return playerStore.playHistory
    }
    if (historyMode.value === 'week') {
      return musicStore.serverPlayHistory.weekData || []
    }
    if (historyMode.value === 'all') {
      return musicStore.serverPlayHistory.allData || []
    }
    return []
  })

  function switchHistoryMode(mode) {
    historyMode.value = mode
    // 切换到服务端数据时，拉取播放历史
    if (mode !== 'local' && userStore.userInfo.id) {
      musicStore.fetchPlayHistory(userStore.userInfo.id)
    }
  }

  function openCreateForm() {
    showPlaylistForm.value = true
  }

  async function logout() {
    const confirmed = await uiStore.showConfirm({
      title: '退出登录',
      message: '确定要退出登录吗？',
      confirmText: '退出',
      cancelText: '取消'
    })
    if (confirmed) {
      userStore.logout()
      router.push({ name: 'login' })
    }
  }

  onMounted(async () => {
    restoreActiveMenu()
    if (activeMenu.value === 'liked') {
      userStore.fetchLikedTracks()
    }
    if (activeMenu.value === 'playlists') {
      fetchServerPlaylists()
    }
  })

  watch(activeMenu, async menu => {
    if (menu === 'liked') {
      userStore.fetchLikedTracks()
    }
    if (menu === 'playlists') {
      fetchServerPlaylists()
    }
    if (
      menu === 'history' &&
      historyMode.value !== 'local' &&
      userStore.userInfo.id
    ) {
      musicStore.fetchPlayHistory(userStore.userInfo.id)
    }
  })
</script>

<template>
  <div class="profile-view">
    <div class="profile-layout">
      <aside class="sidebar">
        <div class="user-info">
          <img :src="userStore.avatarUrl" alt="avatar" class="avatar" />
          <div class="user-name">
            {{ userStore.userInfo.nickname }}
            <span
              v-if="
                userStore.userInfo.vipType !== 0 &&
                userStore.userInfo.showVipBadge
              "
              class="vip-badge"
            >
              <Crown :size="11" />
              <span>黑胶VIP</span>
            </span>
          </div>
        </div>
        <nav class="menu">
          <button
            v-for="item in menuItems"
            :key="item.key"
            class="menu-item"
            :class="{ active: activeMenu === item.key }"
            @click="selectMenu(item.key)"
          >
            <component :is="item.icon" :size="18" />
            <span>{{ item.label }}</span>
          </button>
        </nav>
        <button class="menu-item logout" @click="logout">
          <LogOut :size="18" />
          <span>退出登录</span>
        </button>
      </aside>

      <main class="main-content">
        <div v-if="activeMenu === 'liked'">
          <div class="section-header">
            <h1 class="section-title">喜欢的歌曲</h1>
            <button
              v-if="likedTracks.length > 0"
              class="create-btn"
              @click="playAllLiked"
            >
              <Play :size="18" />
              <span>播放全部</span>
            </button>
          </div>
          <div
            v-if="likedTracks.length === 0 && !likedLoading"
            class="empty-state"
          >
            <Heart :size="48" color="var(--color-text-muted)" />
            <p class="empty-text">还没有喜欢的歌曲</p>
          </div>
          <div v-else-if="likedLoading" class="empty-state">
            <p class="empty-text">加载中...</p>
          </div>
          <TrackList v-else :tracks="likedTracks" />
        </div>

        <div v-if="activeMenu === 'playlists'">
          <div class="section-header">
            <h1 class="section-title">我的歌单</h1>
            <button class="create-btn" @click="openCreateForm">
              <Plus :size="18" />
              <span>新建歌单</span>
            </button>
          </div>

          <div v-if="musicStore.playlistsError" role="alert">
            <p>{{ musicStore.playlistsError }}</p>
            <button class="create-btn" :disabled="serverPlaylistsLoading" @click="fetchServerPlaylists(true)">重新加载歌单</button>
          </div>

          <!-- 创建的歌单 -->
          <div v-if="createdPlaylists.length > 0" class="playlist-section">
            <div class="playlist-section-title">创建</div>
            <div class="playlist-list">
              <PlaylistCard
                v-for="playlist in createdPlaylists"
                :key="'created-' + playlist.id"
                :playlist="{
                  id: playlist.id,
                  name: playlist.name,
                  coverUrl: playlist.coverImgUrl,
                  description: playlist.description,
                  tracks: [],
                  trackCount: playlist.trackCount
                }"
              />
            </div>
          </div>

          <!-- 收藏的歌单 -->
          <div v-if="subscribedPlaylists.length > 0" class="playlist-section">
            <div class="playlist-section-title">收藏</div>
            <div class="playlist-list">
              <PlaylistCard
                v-for="playlist in subscribedPlaylists"
                :key="'subscribed-' + playlist.id"
                :playlist="{
                  id: playlist.id,
                  name: playlist.name,
                  coverUrl: playlist.coverImgUrl,
                  description: playlist.description,
                  tracks: [],
                  trackCount: playlist.trackCount
                }"
              />
            </div>
          </div>

          <div v-if="musicStore.userPlaylists?.length" class="playlist-section">
            <h2 class="playlist-section-title">本机历史歌单 · 只读</h2>
            <p class="sidebar-settings-help">这些记录保存在本机，可查看和播放，不会自动上传网易云。</p>
            <div class="playlist-list">
              <PlaylistCard v-for="playlist in musicStore.userPlaylists" :key="'local-' + playlist.id" :playlist="playlist" local />
            </div>
          </div>

          <!-- 加载中 -->
          <div v-if="serverPlaylistsLoading" class="empty-state">
            <p class="empty-text">加载歌单中...</p>
          </div>

          <!-- 空状态 -->
          <div
            v-if="
              createdPlaylists.length === 0 &&
              subscribedPlaylists.length === 0 &&
              !serverPlaylistsLoading
            "
            class="empty-state"
          >
            <Music :size="48" color="var(--color-text-muted)" />
            <p class="empty-text">还没有歌单，点击"新建歌单"创建第一个吧</p>
          </div>
        </div>

        <div v-if="activeMenu === 'history'">
          <div class="section-header">
            <h1 class="section-title">播放历史</h1>
            <div class="history-actions">
              <button
                v-if="historyTracks.length > 0 && historyMode === 'local'"
                class="create-btn"
                @click="clearHistory"
              >
                <Trash2 :size="18" />
                <span>清空</span>
              </button>
            </div>
          </div>
          <!-- 参考 YesPlayMusic playHistory 切换按钮 -->
          <div class="history-tabs">
            <button
              class="history-tab"
              :class="{ active: historyMode === 'local' }"
              @click="switchHistoryMode('local')"
            >
              本地
            </button>
            <button
              v-if="userStore.userInfo.id"
              class="history-tab"
              :class="{ active: historyMode === 'week' }"
              @click="switchHistoryMode('week')"
            >
              最近一周
            </button>
            <button
              v-if="userStore.userInfo.id"
              class="history-tab"
              :class="{ active: historyMode === 'all' }"
              @click="switchHistoryMode('all')"
            >
              所有时间
            </button>
          </div>
          <div
            v-if="historyTracks.length === 0 && !musicStore.historyLoading"
            class="empty-state"
          >
            <History :size="48" color="var(--color-text-muted)" />
            <p class="empty-text">还没有播放记录</p>
          </div>
          <div v-else-if="musicStore.historyLoading" class="empty-state">
            <p class="empty-text">加载中...</p>
          </div>
          <TrackList
            v-else
            :tracks="historyTracks"
            :show-played-at="historyMode === 'local'"
            :show-play-count="historyMode !== 'local'"
          />
        </div>

        <div v-if="activeMenu === 'settings'">
          <div class="section-header">
            <h1 class="section-title">个人设置</h1>
          </div>
          <div ref="settingsForm" class="settings-form">
            <div ref="settingsTabs" class="settings-tabs" role="tablist" aria-label="设置分类">
              <button
                v-for="(section, index) in settingsSections"
                :id="`settings-tab-${section.key}`"
                :key="section.key"
                type="button"
                role="tab"
                class="settings-tab"
                :data-settings-section="section.key"
                :aria-selected="activeSettingsSection === section.key"
                :aria-controls="`settings-panel-${section.key}`"
                :tabindex="activeSettingsSection === section.key ? 0 : -1"
                @click="selectSettingsSection(section.key)"
                @keydown="onSettingsTabKeydown($event, index)"
              >
                {{ section.label }}
              </button>
            </div>
            <section
              id="settings-panel-appearance"
              v-show="activeSettingsSection === 'appearance'"
              class="settings-panel"
              role="tabpanel"
              aria-labelledby="settings-tab-appearance"
            >
              <div class="form-group">
                <label class="form-label">主题</label>
                <div class="quality-segmented" role="group" aria-label="主题选择">
                  <button
                    v-for="opt in THEME_OPTIONS"
                    :key="opt.value"
                    type="button"
                    class="quality-tab"
                    :class="{ active: theme === opt.value }"
                    :aria-pressed="theme === opt.value"
                    @click="changeTheme(opt.value)"
                  >
                    {{ opt.short }}
                  </button>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">主题色</label>
                <div
                  class="theme-color-swatches"
                  role="group"
                  aria-label="主题色选择"
                >
                  <button
                    v-for="opt in THEME_COLOR_OPTIONS"
                    :key="opt.value"
                    type="button"
                    class="theme-color-swatch"
                    :class="{ active: themeColor === opt.value }"
                    :style="{ '--swatch-color': opt.swatch }"
                    :aria-pressed="themeColor === opt.value"
                    :aria-label="opt.label"
                    @click="changeThemeColor(opt.value)"
                  >
                    <span class="swatch-dot"></span>
                  </button>
                </div>
              </div>
              <div class="form-group sidebar-settings">
                <div class="setting-copy">
                  <label class="form-label" for="sidebar-auto-hide">自动隐藏导航</label>
                  <p class="sidebar-settings-help">鼠标靠近页面左边缘时展开，离开后自动收起；触摸设备保持常显。</p>
                </div>
                <label class="toggle-switch">
                  <input
                    id="sidebar-auto-hide"
                    type="checkbox"
                    :checked="sidebarAutoHide"
                    @change="setSidebarAutoHide($event.target.checked)"
                  />
                  <span class="toggle-slider"></span>
                </label>
                <div v-if="sidebarAutoHide" class="settings-subsection">
                  <label class="sidebar-range-label" for="sidebar-trigger-width">
                    触发区域宽度 <output for="sidebar-trigger-width">{{ sidebarTriggerWidth }} px</output>
                  </label>
                  <input
                    id="sidebar-trigger-width"
                    class="sidebar-range"
                    type="range"
                    min="4" max="48" step="4"
                    :value="sidebarTriggerWidth"
                    @input="setSidebarTriggerWidth(Number($event.target.value))"
                  />
                  <label class="sidebar-range-label" for="sidebar-hide-delay">
                    隐藏延时 <output for="sidebar-hide-delay">{{ sidebarHideDelay }} 毫秒</output>
                  </label>
                  <input
                    id="sidebar-hide-delay"
                    class="sidebar-range"
                    type="range"
                    min="0" max="1500" step="50"
                    :value="sidebarHideDelay"
                    @input="setSidebarHideDelay(Number($event.target.value))"
                  />
                </div>
              </div>
              <div class="form-group">
                <div class="setting-copy">
                  <label class="form-label" for="sidebar-collapsed">折叠导航</label>
                  <p class="sidebar-settings-help">收起菜单文字，仅保留图标；不影响自动隐藏。</p>
                </div>
                <label class="toggle-switch">
                  <input
                    id="sidebar-collapsed"
                    type="checkbox"
                    :checked="sidebarCollapsed"
                    @change="setSidebarCollapsed($event.target.checked)"
                  />
                  <span class="toggle-slider"></span>
                </label>
              </div>
              <div v-if="userStore.userInfo.vipType !== 0" class="form-group">
                <div class="toggle-row">
                  <label class="toggle-label" for="settings-vip-badge">显示黑胶VIP角标</label>
                  <label class="toggle-switch">
                    <input
                      id="settings-vip-badge"
                      type="checkbox"
                      :checked="userStore.userInfo.showVipBadge"
                      @change="userStore.setShowVipBadge($event.target.checked)"
                    />
                    <span class="toggle-slider"></span>
                  </label>
                </div>
              </div>
            </section>
            <section
              id="settings-panel-playback"
              v-show="activeSettingsSection === 'playback'"
              class="settings-panel"
              role="tabpanel"
              aria-labelledby="settings-tab-playback"
            >
              <p class="settings-panel-note">音质在下次播放时生效；歌词设置在重新进入播放页后生效。</p>
              <div class="form-group">
                <label class="form-label">音质</label>
                <div class="quality-segmented" role="group" aria-label="音质选择">
                  <button
                    v-for="opt in MUSIC_QUALITY_OPTIONS"
                    :key="opt.value"
                    type="button"
                    class="quality-tab"
                    :class="{ active: musicQuality === opt.value }"
                    :aria-pressed="musicQuality === opt.value"
                    @click="changeMusicQuality(opt.value)"
                  >
                    {{ opt.short }}
                  </button>
                </div>
              </div>
              <div class="form-group">
                <div class="setting-copy">
                  <label class="form-label" for="settings-cover-rotation">封面旋转</label>
                  <p class="cover-rotation-help">播放时转动，暂停时停住；遵循系统减少动态效果设置。</p>
                </div>
                <label class="toggle-switch">
                  <input
                    id="settings-cover-rotation"
                    type="checkbox"
                    :checked="coverRotationEnabled"
                    @change="setCoverRotationEnabled($event.target.checked)"
                  />
                  <span class="toggle-slider"></span>
                </label>
                <div v-if="coverRotationEnabled" class="settings-subsection">
                  <label class="cover-rotation-range-label" for="settings-cover-seconds">
                    每圈用时 <output for="settings-cover-seconds">{{ secondsPerTurn }} 秒/圈</output>
                  </label>
                  <input
                    id="settings-cover-seconds"
                    class="cover-rotation-range"
                    type="range"
                    min="5" max="60" step="1"
                    :value="secondsPerTurn"
                    @input="setSecondsPerTurn(Number($event.target.value))"
                  />
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">歌词字号</label>
                <div
                  class="quality-segmented"
                  role="group"
                  aria-label="歌词字号选择"
                >
                  <button
                    v-for="opt in LYRIC_FONT_SIZE_OPTIONS"
                    :key="opt.value"
                    type="button"
                    class="quality-tab"
                    :class="{ active: lyricFontSize === opt.value }"
                    :aria-pressed="lyricFontSize === opt.value"
                    @click="changeLyricFontSize(opt.value)"
                  >
                    {{ opt.short }}
                  </button>
                </div>
              </div>
              <div class="form-group">
                <div class="toggle-row">
                  <label class="toggle-label" for="settings-lyrics-translation">显示歌词翻译</label>
                  <label class="toggle-switch">
                    <input
                      id="settings-lyrics-translation"
                      type="checkbox"
                      :checked="showLyricsTranslation"
                      @change="setShowLyricsTranslation($event.target.checked)"
                    />
                    <span class="toggle-slider"></span>
                  </label>
                </div>
              </div>
              <div class="form-group">
                <div class="toggle-row">
                  <label class="toggle-label" for="settings-lyrics-time">显示歌词时间</label>
                  <label class="toggle-switch">
                    <input
                      id="settings-lyrics-time"
                      type="checkbox"
                      :checked="showLyricsTime"
                      @change="setShowLyricsTime($event.target.checked)"
                    />
                    <span class="toggle-slider"></span>
                  </label>
                </div>
              </div>
            </section>
            <section
              id="settings-panel-shortcuts"
              v-show="activeSettingsSection === 'shortcuts'"
              class="settings-panel"
              role="tabpanel"
              aria-labelledby="settings-tab-shortcuts"
            >
              <div class="form-group">
                <div class="toggle-row">
                  <label class="toggle-label" for="settings-shortcuts-enabled">启用快捷键</label>
                  <label class="toggle-switch">
                    <input
                      id="settings-shortcuts-enabled"
                      type="checkbox"
                      :checked="shortcutsEnabled"
                      @change="setShortcutsEnabled($event.target.checked)"
                    />
                    <span class="toggle-slider"></span>
                  </label>
                </div>
              </div>
              <div v-if="shortcutsEnabled" class="shortcuts-section">
                <div class="shortcuts-header">
                  <button class="reset-all-btn" @click="onResetAllShortcuts">
                    重置全部
                  </button>
                </div>
                <div
                  v-for="action in SHORTCUT_ACTIONS"
                  :key="action.id"
                  class="shortcut-row"
                >
                  <span class="shortcut-label">{{ action.label }}</span>
                  <div class="shortcut-controls">
                    <span
                      v-if="conflictMsg && recordingId === action.id"
                      class="shortcut-conflict"
                    >
                      {{ conflictMsg }}
                    </span>
                    <button
                      class="shortcut-key"
                      :aria-label="`修改${action.label}快捷键`"
                      :class="{ recording: recordingId === action.id }"
                      @keydown="onRecordKeydown($event, action.id)"
                      @click="startRecording(action.id)"
                      @blur="cancelRecording"
                      tabindex="0"
                    >
                      {{
                        recordingId === action.id
                          ? '请按下快捷键...'
                          : formatShortcut(shortcuts[action.id])
                      }}
                    </button>
                    <button
                      class="shortcut-reset"
                      :aria-label="`重置${action.label}快捷键`"
                      @click="onResetShortcut(action.id)"
                    >
                      重置
                    </button>
                  </div>
                </div>
              </div>
            </section>
            <section
              id="settings-panel-preload"
              v-show="activeSettingsSection === 'preload'"
              class="settings-panel"
              role="tabpanel"
              aria-labelledby="settings-tab-preload"
            >
              <p class="settings-panel-note">开启后会立即预加载所选内容。</p>
              <div class="form-group">
                <div class="toggle-row">
                  <label class="toggle-label" for="settings-preload-enabled">启用预加载</label>
                  <label class="toggle-switch">
                    <input
                      id="settings-preload-enabled"
                      type="checkbox"
                      :checked="preloadConfig.enabled"
                      @change="setPreloadEnabled($event.target.checked)"
                    />
                    <span class="toggle-slider"></span>
                  </label>
                </div>
              </div>
              <div v-if="preloadConfig.enabled" class="settings-subsection preload-items">
                <div
                  v-for="item in PRELOAD_ITEMS"
                  :key="item.key"
                  class="toggle-row"
                >
                  <label class="shortcut-label" :for="`settings-preload-${item.key}`">{{ item.label }}</label>
                  <label class="toggle-switch">
                    <input
                      :id="`settings-preload-${item.key}`"
                      type="checkbox"
                      :checked="preloadConfig.items[item.key]"
                      @change="setPreloadItem(item.key, $event.target.checked)"
                    />
                    <span class="toggle-slider"></span>
                  </label>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>

    <PlaylistFormModal :visible="showPlaylistForm" @close="showPlaylistForm = false" />
  </div>
</template>

<style scoped>
  .profile-view {
    min-height: calc(100vh - var(--navbar-height));
  }
  .profile-layout {
    display: grid;
    grid-template-columns: var(--sidebar-width) 1fr;
    max-width: var(--content-max-width);
    margin: 0 auto;
    padding: var(--spacing-xl);
    gap: var(--spacing-xl);
  }
  .sidebar {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
    align-self: start;
    position: sticky;
    top: calc(var(--navbar-height) + var(--spacing-xl));
  }
  .user-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--spacing-lg);
    background: var(--color-card-bg);
    border-radius: var(--radius-lg);
    margin-bottom: var(--spacing-md);
  }
  .avatar {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    object-fit: cover;
    border: 3px solid var(--color-primary);
    margin-bottom: var(--spacing-sm);
  }
  .user-name {
    font-size: 18px;
    font-weight: 700;
    color: var(--color-text);
    position: relative;
    display: inline-block;
  }
  .vip-badge {
    position: absolute;
    top: -3px;
    right: -64px;
    display: inline-flex;
    align-items: center;
    gap: 2px;
    padding: 2px 6px;
    border-radius: var(--radius-sm);
    font-size: 11px;
    line-height: 1;
    color: var(--color-badge-vip);
    background: #000;
    white-space: nowrap;
  }

  .menu {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .menu-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    border-radius: var(--radius-md);
    font-size: 14px;
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: all var(--transition-fast);
    width: 100%;
    text-align: left;
  }
  .menu-item:hover {
    background: var(--color-secondary-bg-hover);
    color: var(--color-text);
  }
  .menu-item.active {
    background: var(--color-primary-bg-transparent);
    color: var(--color-primary);
  }
  .menu-item.logout {
    color: var(--color-text-secondary);
  }
  .menu-item.logout:hover {
    color: var(--color-error);
    background: rgba(239, 68, 68, 0.1);
  }
  .main-content {
    min-width: 0;
  }
  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--spacing-lg);
  }
  .section-title {
    font-size: 24px;
    font-weight: 700;
    color: var(--color-text);
  }
  .create-btn {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-sm) var(--spacing-lg);
    border: 1px solid var(--color-primary);
    color: var(--color-primary);
    border-radius: var(--radius-md);
    font-size: 14px;
    font-weight: 500;
    transition: all var(--transition-fast);
  }
  .create-btn:hover {
    background: var(--color-primary);
    color: #ffffff;
  }
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--spacing-3xl);
    gap: var(--spacing-md);
  }
  .empty-text {
    font-size: 14px;
    color: var(--color-text-muted);
  }
  .playlist-section {
    margin-bottom: var(--spacing-lg);
  }

  .playlist-section-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text-muted);
    margin-bottom: var(--spacing-md);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .playlist-list {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--spacing-md);
  }
  .playlist-list > * {
    min-width: 0;
  }
  .history-actions {
    display: flex;
    gap: var(--spacing-sm);
  }
  .history-tabs {
    display: flex;
    gap: var(--spacing-sm);
    margin-bottom: var(--spacing-lg);
  }
  .history-tab {
    padding: var(--spacing-xs) var(--spacing-md);
    border-radius: var(--radius-full);
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text-secondary);
    background: transparent;
    border: 1px solid var(--color-border);
    transition: all var(--transition-fast);
  }
  .history-tab:hover {
    color: var(--color-text);
    background: var(--color-secondary-bg-hover);
  }
  .history-tab.active {
    background: var(--color-primary);
    color: #ffffff;
    border-color: var(--color-primary);
  }
  .cover-rotation-help,
  .sidebar-settings-help {
    margin-top: var(--spacing-sm);
    font-size: 12px;
    color: var(--color-text-secondary);
    line-height: 1.6;
  }
  .cover-rotation-range-label,
  .sidebar-range-label {
    display: flex;
    justify-content: space-between;
    gap: var(--spacing-md);
    margin-top: var(--spacing-md);
    font-size: 13px;
  }
  .cover-rotation-range-label output,
  .sidebar-range-label output {
    color: var(--color-text-secondary);
    font-variant-numeric: tabular-nums;
  }
  .cover-rotation-range,
  .sidebar-range {
    width: 100%;
    min-height: 32px;
    accent-color: var(--color-action-bg);
  }
  .cover-rotation-range:focus-visible,
  .sidebar-range:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
    border-radius: var(--radius-sm);
  }
  .quality-segmented {
    display: inline-flex;
    gap: 4px;
    padding: 4px;
    background: var(--color-secondary-bg);
    border-radius: var(--radius-md);
  }
  .quality-tab {
    flex: 1;
    min-height: 36px;
    padding: var(--spacing-xs) var(--spacing-md);
    border: none;
    border-radius: var(--radius-sm);
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text-secondary);
    background: transparent;
    cursor: pointer;
    transition: all var(--transition-fast);
    white-space: nowrap;
  }
  .quality-tab:hover {
    color: var(--color-text);
  }
  .quality-tab.active {
    background: var(--color-card-bg);
    color: var(--color-primary);
    box-shadow: var(--shadow-sm);
  }
  .theme-color-swatches {
    display: flex;
    gap: var(--spacing-sm);
    align-items: center;
  }
  .theme-color-swatch {
    position: relative;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 2px solid transparent;
    background: transparent;
    padding: 0;
    cursor: pointer;
    transition: all var(--transition-fast);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  /* tooltip：读取 aria-label，hover + 键盘焦点触发，往上弹 */
  .theme-color-swatch::after {
    content: attr(aria-label);
    position: absolute;
    bottom: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%);
    padding: 4px 8px;
    background: rgba(0, 0, 0, 0.85);
    color: #ffffff;
    font-size: 12px;
    line-height: 1.4;
    border-radius: var(--radius-sm);
    white-space: nowrap;
    pointer-events: none;
    opacity: 0;
    transition: opacity var(--transition-fast);
    z-index: var(--z-tooltip, 1200);
  }
  .theme-color-swatch:hover::after,
  .theme-color-swatch:focus-visible::after {
    opacity: 1;
  }
  .theme-color-swatch .swatch-dot {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--swatch-color);
    transition: transform var(--transition-fast);
  }
  .theme-color-swatch:hover .swatch-dot {
    transform: scale(1.1);
  }
  .theme-color-swatch.active {
    border-color: var(--swatch-color);
  }
  .theme-color-swatch.active .swatch-dot {
    transform: scale(0.85);
  }
  .theme-color-swatch:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }
  .toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-md);
  }
  .toggle-label {
    font-size: 14px;
    font-weight: 500;
    color: var(--color-text);
  }
  .toggle-switch {
    position: relative;
    display: inline-block;
    width: 44px;
    height: 24px;
    flex-shrink: 0;
    cursor: pointer;
  }
  .toggle-switch input {
    opacity: 0;
    width: 0;
    height: 0;
    position: absolute;
  }
  .toggle-slider {
    position: absolute;
    inset: 0;
    background: var(--color-secondary-bg-hover);
    border-radius: var(--radius-full);
    transition: background var(--transition-fast);
  }
  .toggle-slider::before {
    content: '';
    position: absolute;
    top: 3px;
    left: 3px;
    width: 18px;
    height: 18px;
    background: #ffffff;
    border-radius: 50%;
    box-shadow: var(--shadow-sm);
    transition: transform var(--transition-fast);
  }
  .toggle-switch input:checked + .toggle-slider {
    background: var(--color-primary);
  }
  .toggle-switch input:checked + .toggle-slider::before {
    transform: translateX(20px);
  }
  .toggle-switch input:focus-visible + .toggle-slider {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }
  /* 快捷键设置 */
  .shortcuts-section {
    margin-top: var(--spacing-md);
  }
  .shortcuts-header {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    margin-bottom: var(--spacing-sm);
  }
  .reset-all-btn {
    font-size: 12px;
    color: var(--color-text-muted);
    transition: color var(--transition-fast);
  }
  .reset-all-btn:hover {
    color: var(--color-primary);
  }
  .shortcut-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-md);
    padding: var(--spacing-xs) 0;
    min-height: 36px;
  }
  .shortcut-label {
    font-size: 14px;
    color: var(--color-text);
  }
  .shortcut-controls {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }
  .shortcut-conflict {
    font-size: 12px;
    color: var(--color-error);
  }
  .shortcut-key {
    min-width: 120px;
    padding: 6px 12px;
    background: var(--color-secondary-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: 13px;
    font-family: monospace;
    color: var(--color-text);
    cursor: pointer;
    transition: all var(--transition-fast);
    text-align: center;
  }
  .shortcut-key:hover {
    border-color: var(--color-primary);
  }
  .shortcut-key.recording {
    border-color: var(--color-primary);
    color: var(--color-primary);
    background: var(--color-primary-bg);
  }
  .shortcut-key:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }
  .shortcut-reset {
    font-size: 12px;
    color: var(--color-text-muted);
    transition: color var(--transition-fast);
  }
  .shortcut-reset:hover {
    color: var(--color-primary);
  }
</style>
