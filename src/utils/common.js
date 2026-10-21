// 移植自 YesPlayMusic src/utils/common.js + src/utils/filters.js
// 歌曲可播放性判断 + LRC 歌词解析 + 图片缩放

function isTrackPlayable(track) {
  if (!track?.privilege) return true
  const privilege = track.privilege
  // pl===0（VIP 付费）放行试听；仅无版权(cs)与需购买(fee===4)拦截
  if (privilege?.cs || privilege?.fee === 4) return false
  return true
}

export function mapTrackPlayableStatus(tracks, privileges = []) {
  return tracks.map(track => {
    const privilege =
      privileges.find(p => p?.id === track.id) || track.privilege
    return {
      ...track,
      privilege,
      playable: isTrackPlayable({ ...track, privilege }),
      reason: privilege?.cs
        ? '无版权'
        : privilege?.fee === 4
          ? '需购买'
          : privilege?.pl === 0 || privilege?.fee === 1
            ? '需 VIP'
            : ''
    }
  })
}

// LRC 歌词解析：将 "[mm:ss.ms]歌词" 文本转为 { time, rawTime, content }[] 数组
// rawTime 用于匹配翻译歌词（参考 YesPlayMusic lyricParser）
export function parseLRC(lrcText) {
  if (!lrcText || typeof lrcText !== 'string') return []

  const lines = lrcText.split('\n')
  const result = []
  const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/

  for (const line of lines) {
    const match = line.match(timeRegex)
    if (!match) continue

    const rawTime = match[0]
    const min = parseInt(match[1], 10)
    const sec = parseInt(match[2], 10)
    const ms = parseInt(match[3], 10)
    const time = min * 60 + sec + ms / (match[3].length === 2 ? 100 : 1000)

    const content = line.replace(timeRegex, '').trim()
    if (content) {
      result.push({ time, rawTime, content })
    }
  }

  return result.sort((a, b) => a.time - b.time)
}

// 参考 YesPlayMusic resizeImage filter：转换为 https + 按尺寸请求缩略图
export function resizeImage(imgUrl, size = 512) {
  if (!imgUrl) return ''
  let httpsUrl = imgUrl
  if (imgUrl.startsWith('http:')) {
    httpsUrl = 'https' + imgUrl.slice(4)
  }
  return `${httpsUrl}?param=${size}y${size}`
}

// 参考 YesPlayMusic src/utils/auth.js setCookies
export function setCookies(string) {
  const cookies = string.split(';;')
  cookies.forEach(cookie => {
    document.cookie = cookie
  })
}

// 登录恢复仅接受站内路径，避免重定向回登录页。
export function getLoginRedirect(value) {
  return typeof value === 'string' && value.startsWith('/') &&
    !value.startsWith('//') && !/^\/login(?:[/?#]|$)/.test(value)
    ? value : '/'
}

// 格式化时长：毫秒 → "m:ss"
export function formatDuration(ms) {
  if (!ms || isNaN(ms)) return '0:00'
  const totalSec = Math.floor(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${min}:${sec.toString().padStart(2, '0')}`
}

// 格式化相对时间：时间戳 → "刚刚" / "5分钟前" / "3小时前" 等
export function formatRelativeTime(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now - date
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour
  const year = 365 * day

  if (diff < minute) return '刚刚'
  if (diff < hour) return `${Math.floor(diff / minute)}分钟前`
  if (diff < day) return `${Math.floor(diff / hour)}小时前`
  if (diff < 7 * day) return `${Math.floor(diff / day)}天前`
  if (diff < year) return `${date.getMonth() + 1}月${date.getDate()}日`
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}
