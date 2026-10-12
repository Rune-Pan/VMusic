import { ref, computed, watch } from 'vue'
import {
  STORAGE_KEYS,
  THEME_COLOR_OPTIONS,
  DEFAULT_THEME_COLOR
} from '@/constants'

const STORAGE_KEY = STORAGE_KEYS.THEME
const STORAGE_KEY_COLOR = STORAGE_KEYS.THEME_COLOR
const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)'

function getSystemTheme() {
  return window.matchMedia?.(SYSTEM_DARK_QUERY).matches ? 'dark' : 'light'
}

function getSavedTheme() {
  const saved = localStorage.getItem(STORAGE_KEY)
  return ['dark', 'light', 'auto'].includes(saved) ? saved : 'auto'
}

function getSavedThemeColor() {
  const saved = localStorage.getItem(STORAGE_KEY_COLOR)
  return THEME_COLOR_OPTIONS.some(o => o.value === saved)
    ? saved
    : DEFAULT_THEME_COLOR
}

const theme = ref(getSavedTheme())
const systemTheme = ref(getSystemTheme())
const themeColor = ref(getSavedThemeColor())

function applyTheme(value) {
  document.documentElement.setAttribute('data-theme', value)
}

// 应用主题色：根据当前生效的深浅模式，把 preset 的 5 个变量写到 :root
// 参考 YesPlayMusic changeThemeColor，主题色与深浅模式耦合（dark 配色不同）
function applyThemeColor(colorValue, appearance) {
  const preset =
    THEME_COLOR_OPTIONS.find(o => o.value === colorValue) ||
    THEME_COLOR_OPTIONS[0]
  const resolvedAppearance =
    appearance || (theme.value === 'auto' ? systemTheme.value : theme.value)
  const palette = preset[resolvedAppearance] || preset.light
  const root = document.documentElement
  root.style.setProperty('--color-primary', palette.primary)
  root.style.setProperty('--color-primary-hover', palette.primaryHover)
  root.style.setProperty('--color-primary-bg', palette.primaryBg)
  root.style.setProperty(
    '--color-primary-bg-transparent',
    palette.primaryBgTransparent
  )
  root.style.setProperty('--shadow-glow', palette.shadowGlow)
}

const mediaQuery = window.matchMedia?.(SYSTEM_DARK_QUERY)
function onSystemChange(e) {
  systemTheme.value = e.matches ? 'dark' : 'light'
}

if (mediaQuery) {
  mediaQuery.addEventListener('change', onSystemChange)
}

applyTheme(theme.value === 'auto' ? systemTheme.value : theme.value)
applyThemeColor(themeColor.value)

export function useTheme() {
  const effectiveTheme = computed(() => {
    return theme.value === 'auto' ? systemTheme.value : theme.value
  })

  watch(effectiveTheme, newVal => {
    applyTheme(newVal)
    // 深浅模式变化时重应用主题色（dark 配色不同）
    applyThemeColor(themeColor.value, newVal)
  })

  watch(theme, newVal => {
    localStorage.setItem(STORAGE_KEY, newVal)
  })

  // 直接设置主题色（设置页色块按钮用）
  function setThemeColor(value) {
    if (THEME_COLOR_OPTIONS.some(o => o.value === value)) {
      themeColor.value = value
    }
  }

  watch(themeColor, newVal => {
    localStorage.setItem(STORAGE_KEY_COLOR, newVal)
    applyThemeColor(newVal)
  })

  function toggleTheme() {
    if (theme.value === 'auto') {
      theme.value = 'dark'
    } else if (theme.value === 'dark') {
      theme.value = 'light'
    } else {
      theme.value = 'auto'
    }
  }

  // 直接设置主题（设置页分段按钮用），与 toggleTheme 共用同一 theme ref
  function setTheme(value) {
    if (['dark', 'light', 'auto'].includes(value)) {
      theme.value = value
    }
  }

  return {
    theme,
    effectiveTheme,
    systemTheme,
    themeColor,
    toggleTheme,
    setTheme,
    setThemeColor
  }
}
