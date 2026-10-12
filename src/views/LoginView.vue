<script setup>
  // 参考 YesPlayMusic src/views/loginAccount.vue
  import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue'
  import { useRouter, useRoute } from 'vue-router'
  import {
    Music,
    User,
    Lock,
    Eye,
    EyeOff,
    QrCode,
    Sun,
    Moon,
    Monitor,
    RefreshCw,
    ShieldCheck
  } from '@lucide/vue'
  import QRCode from 'qrcode'
  import { useUserStore } from '@/stores/user'
  import { useUiStore } from '@/stores/ui'
  import { useTheme } from '@/composables/useTheme'
  import { loginQrCodeKey, loginQrCodeCheck, captchaSent } from '@/api/auth'
  import { QR_CHECK_INTERVAL } from '@/constants'

  const router = useRouter()
  const route = useRoute()
  const userStore = useUserStore()
  const uiStore = useUiStore()

  // 登录模式：'qrCode' | 'account'
  const mode = ref('qrCode')
  // 账号登录凭证类型：'password' | 'captcha'
  const credentialType = ref('password')
  const showPassword = ref(false)
  const loading = ref(false)
  const sendingCaptcha = ref(false)
  // 验证码倒计时（秒），0 表示可发送
  const captchaCountdown = ref(0)
  let captchaTimer = null

  const form = reactive({
    account: '',
    password: '',
    captcha: '',
    confirmPassword: ''
  })
  const errors = reactive({
    account: '',
    password: '',
    captcha: '',
    confirmPassword: ''
  })

  // 扫码登录状态
  const qrCodeSvg = ref('')
  const qrCodeKey = ref('')
  const qrCodeInformation = ref('打开网易云音乐APP扫码登录')
  let qrCodeCheckInterval = null

  // ========== 主题切换 ==========
  const { theme, effectiveTheme, toggleTheme } = useTheme()

  const themeLabel = computed(() => {
    if (theme.value === 'auto') return '切换到深色模式'
    if (theme.value === 'dark') return '切换到浅色模式'
    return '跟随系统主题'
  })

  const qrColor = computed(() => {
    return effectiveTheme.value === 'dark' ? '#FFFFFF' : '#1E293B'
  })

  function onToggleTheme() {
    toggleTheme()
    if (mode.value === 'qrCode') {
      getQrCodeKey()
    }
  }

  // ========== 账号密码登录 ==========
  function validateAccount() {
    if (!form.account) {
      errors.account = '请输入账号'
      return false
    }
    if (form.account.length < 4 || form.account.length > 16) {
      errors.account = '账号长度需为4-16位'
      return false
    }
    errors.account = ''
    return true
  }

  function validatePassword() {
    if (!form.password) {
      errors.password = '请输入密码'
      return false
    }
    if (form.password.length < 6 || form.password.length > 20) {
      errors.password = '密码长度需为6-20位'
      return false
    }
    errors.password = ''
    return true
  }

  function validateCaptcha() {
    if (!form.captcha) {
      errors.captcha = '请输入验证码'
      return false
    }
    if (!/^\d{4,6}$/.test(form.captcha)) {
      errors.captcha = '验证码为4-6位数字'
      return false
    }
    errors.captcha = ''
    return true
  }

  async function sendCaptcha() {
    if (!form.account) {
      errors.account = '请先输入手机号'
      return
    }
    if (captchaCountdown.value > 0 || sendingCaptcha.value) return
    sendingCaptcha.value = true
    try {
      const result = await captchaSent({ phone: form.account, ctcode: '86' })
      if (result.code === 200) {
        uiStore.showToast('验证码已发送', 'success')
        startCaptchaCountdown()
      } else {
        uiStore.showToast(result.message || '验证码发送失败', 'error')
      }
    } catch (e) {
      uiStore.showToast('验证码发送失败', 'error')
      console.error('Send captcha failed:', e)
    } finally {
      sendingCaptcha.value = false
    }
  }

  function startCaptchaCountdown() {
    captchaCountdown.value = 60
    captchaTimer = setInterval(() => {
      captchaCountdown.value--
      if (captchaCountdown.value <= 0) {
        clearInterval(captchaTimer)
        captchaTimer = null
      }
    }, 1000)
  }

  // 切换凭证类型时清空对应输入
  function switchCredential(type) {
    credentialType.value = type
    errors.password = ''
    errors.captcha = ''
  }

  async function handleSubmit() {
    if (!validateAccount()) return
    if (credentialType.value === 'password') {
      if (!validatePassword()) return
      loading.value = true
      const success = await userStore.login({
        account: form.account,
        password: form.password
      })
      loading.value = false
      if (success) {
        uiStore.showToast('登录成功', 'success')
        const redirect = route.query.redirect || '/'
        router.push(redirect)
      } else {
        uiStore.showToast('登录失败，请检查账号密码', 'error')
      }
    } else {
      if (!validateCaptcha()) return
      loading.value = true
      const success = await userStore.loginWithCaptcha(
        form.account,
        form.captcha
      )
      loading.value = false
      if (success) {
        uiStore.showToast('登录成功', 'success')
        const redirect = route.query.redirect || '/'
        router.push(redirect)
      } else {
        uiStore.showToast('登录失败，请检查手机号或验证码', 'error')
      }
    }
  }

  // ========== 扫码登录 - 参考 YesPlayMusic getQrCodeKey + checkQrCodeLogin ==========
  async function renderQrCodeSvg(key) {
    const svg = await QRCode.toString(
      `https://music.163.com/login?codekey=${key}`,
      {
        width: 192,
        margin: 0,
        color: {
          dark: qrColor.value,
          light: '#00000000'
        },
        type: 'svg'
      }
    )
    qrCodeSvg.value = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
  }

  async function getQrCodeKey() {
    try {
      const result = await loginQrCodeKey()
      if (result.code === 200) {
        qrCodeKey.value = result.data.unikey
        await renderQrCodeSvg(qrCodeKey.value)
        qrCodeInformation.value = '打开网易云音乐APP扫码登录'
        checkQrCodeLogin()
      }
    } catch (e) {
      console.error('Failed to get QR code key:', e)
      qrCodeInformation.value = '二维码获取失败，请刷新'
    }
  }

  // 主题变化时，用已有 key 重新渲染二维码颜色
  watch(qrColor, () => {
    if (qrCodeKey.value && mode.value === 'qrCode') {
      renderQrCodeSvg(qrCodeKey.value)
    }
  })

  // 参考 YesPlayMusic checkQrCodeLogin
  function checkQrCodeLogin() {
    clearQrCodeInterval()
    qrCodeCheckInterval = setInterval(async () => {
      if (!qrCodeKey.value) return
      try {
        const result = await loginQrCodeCheck(qrCodeKey.value)
        if (result.code === 800) {
          // 二维码过期
          clearQrCodeInterval()
          qrCodeInformation.value = '二维码已失效，请重新扫码'
          getQrCodeKey()
        } else if (result.code === 801) {
          qrCodeInformation.value = '打开网易云音乐APP扫码登录'
        } else if (result.code === 802) {
          qrCodeInformation.value = '扫描成功，请在手机上确认登录'
        } else if (result.code === 803) {
          // 登录成功
          clearQrCodeInterval()
          qrCodeInformation.value = '登录成功，请稍等...'
          const cookie = result.cookie.replaceAll(' HTTPOnly', '')
          const success = await userStore.loginWithQrCode(cookie)
          if (success) {
            uiStore.showToast('登录成功', 'success')
            const redirect = route.query.redirect || '/'
            router.push(redirect)
          } else {
            uiStore.showToast('登录失败，请重试', 'error')
          }
        }
      } catch (e) {
        console.error('QR check failed:', e)
      }
    }, QR_CHECK_INTERVAL)
  }

  function clearQrCodeInterval() {
    if (qrCodeCheckInterval) {
      clearInterval(qrCodeCheckInterval)
      qrCodeCheckInterval = null
    }
  }

  // ========== 抽象声波动效背景 ==========
  const canvasRef = ref(null)
  let animationId = null
  let particles = []

  function initCanvasAnimation() {
    const canvas = canvasRef.value
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    let width = (canvas.width = window.innerWidth)
    let height = (canvas.height = window.innerHeight)

    const isDark = () => effectiveTheme.value === 'dark'

    // 粒子配置
    const particleCount = Math.min(80, Math.floor((width * height) / 20000))
    particles = []
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 2 + 1,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        alpha: Math.random() * 0.5 + 0.2
      })
    }

    let time = 0

    function draw() {
      const dark = isDark()
      ctx.clearRect(0, 0, width, height)

      // 基础渐变背景
      const gradient = ctx.createLinearGradient(0, 0, width, height)
      if (dark) {
        gradient.addColorStop(0, '#0a0e27')
        gradient.addColorStop(0.45, '#12121e')
        gradient.addColorStop(1, '#1a103c')
      } else {
        gradient.addColorStop(0, '#f0f4ff')
        gradient.addColorStop(0.45, '#f8faff')
        gradient.addColorStop(1, '#fff0f5')
      }
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, width, height)

      // 绘制大型柔和光晕
      const glow1 = ctx.createRadialGradient(
        width * 0.2,
        height * 0.3,
        0,
        width * 0.2,
        height * 0.3,
        width * 0.6
      )
      glow1.addColorStop(
        0,
        dark ? 'rgba(139, 92, 246, 0.22)' : 'rgba(59, 130, 246, 0.18)'
      )
      glow1.addColorStop(1, 'rgba(0, 0, 0, 0)')
      ctx.fillStyle = glow1
      ctx.fillRect(0, 0, width, height)

      const glow2 = ctx.createRadialGradient(
        width * 0.8,
        height * 0.7,
        0,
        width * 0.8,
        height * 0.7,
        width * 0.5
      )
      glow2.addColorStop(
        0,
        dark ? 'rgba(236, 72, 153, 0.18)' : 'rgba(236, 72, 153, 0.14)'
      )
      glow2.addColorStop(1, 'rgba(0, 0, 0, 0)')
      ctx.fillStyle = glow2
      ctx.fillRect(0, 0, width, height)

      // 绘制声波条形
      const barCount = 60
      const barWidth = width / barCount
      const waveBase = height * 0.65
      const waveColors = dark
        ? [
            'rgba(139, 92, 246, 0.35)',
            'rgba(59, 130, 246, 0.3)',
            'rgba(236, 72, 153, 0.25)'
          ]
        : [
            'rgba(59, 130, 246, 0.22)',
            'rgba(139, 92, 246, 0.18)',
            'rgba(236, 72, 153, 0.14)'
          ]

      for (let layer = 0; layer < 3; layer++) {
        ctx.beginPath()
        for (let i = 0; i <= barCount; i++) {
          const x = i * barWidth
          const frequency = 0.015 + layer * 0.005
          const amplitude = 60 + layer * 30
          const offset = time * (0.02 + layer * 0.01) + layer * 2
          const y =
            waveBase +
            Math.sin(i * frequency + offset) * amplitude +
            Math.cos(i * frequency * 0.5 + offset) * amplitude * 0.5
          if (i === 0) {
            ctx.moveTo(x, height)
            ctx.lineTo(x, y)
          } else {
            const prevX = (i - 1) * barWidth
            const prevY =
              waveBase +
              Math.sin((i - 1) * frequency + offset) * amplitude +
              Math.cos((i - 1) * frequency * 0.5 + offset) * amplitude * 0.5
            const cpX = (prevX + x) / 2
            ctx.quadraticCurveTo(cpX, prevY, (cpX + x) / 2, (prevY + y) / 2)
            ctx.quadraticCurveTo(x, y, x, y)
          }
          ctx.lineTo(x, height)
        }
        ctx.lineTo(width, height)
        ctx.closePath()
        ctx.fillStyle = waveColors[layer]
        ctx.fill()
      }

      // 绘制粒子
      particles.forEach(p => {
        p.x += p.vx
        p.y += p.vy

        if (p.x < 0 || p.x > width) p.vx *= -1
        if (p.y < 0 || p.y > height) p.vy *= -1

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx.fillStyle = dark
          ? `rgba(255, 255, 255, ${p.alpha})`
          : `rgba(59, 130, 246, ${p.alpha})`
        ctx.fill()
      })

      // 连接临近粒子
      ctx.strokeStyle = dark
        ? 'rgba(255, 255, 255, 0.04)'
        : 'rgba(59, 130, 246, 0.06)'
      ctx.lineWidth = 0.5
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 120) {
            ctx.beginPath()
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.stroke()
          }
        }
      }

      time += 1
      animationId = requestAnimationFrame(draw)
    }

    function handleResize() {
      width = canvas.width = window.innerWidth
      height = canvas.height = window.innerHeight
    }

    window.addEventListener('resize', handleResize)
    draw()

    return () => {
      window.removeEventListener('resize', handleResize)
      if (animationId) cancelAnimationFrame(animationId)
    }
  }

  let canvasCleanup = null

  onMounted(() => {
    canvasCleanup = initCanvasAnimation()
    if (mode.value === 'qrCode') {
      getQrCodeKey()
    }
  })

  onUnmounted(() => {
    clearQrCodeInterval()
    if (captchaTimer) clearInterval(captchaTimer)
    if (canvasCleanup) canvasCleanup()
  })
</script>

<template>
  <div class="login-page">
    <canvas ref="canvasRef" class="ambient-canvas" aria-hidden="true" />

    <button
      class="theme-toggle"
      type="button"
      :aria-label="themeLabel"
      @click="onToggleTheme"
    >
      <Monitor v-if="theme === 'auto'" :size="18" />
      <Sun v-else-if="theme === 'dark'" :size="18" />
      <Moon v-else :size="18" />
    </button>

    <div class="login-card glass">
      <div class="brand-section glass-panel">
        <div class="brand-logo">
          <div class="logo-ring">
            <Music :size="40" class="logo-icon" />
          </div>
          <h1 class="brand-name">听潮</h1>
        </div>
        <p class="slogan">
          发现好音乐
          <br />
          遇见好时光
        </p>
        <div class="decoration">
          <div
            v-for="i in 5"
            :key="i"
            class="wave-bar"
            :style="{ animationDelay: i * 0.1 + 's' }"
          ></div>
        </div>
      </div>

      <div class="form-section glass-panel">
        <div class="form-tabs">
          <button
            class="tab"
            :class="{ active: mode === 'qrCode' }"
            @click="((mode = 'qrCode'), getQrCodeKey())"
          >
            扫码登录
          </button>
          <button
            class="tab"
            :class="{ active: mode === 'account' }"
            @click="((mode = 'account'), clearQrCodeInterval())"
          >
            账号登录
          </button>
        </div>

        <!-- 扫码登录 -->
        <div v-if="mode === 'qrCode'" class="qr-login">
          <div class="qr-wrapper glass-input">
            <img
              v-if="qrCodeSvg"
              :src="qrCodeSvg"
              alt="QR Code"
              class="qr-code"
            />
            <div v-else class="qr-placeholder">
              <QrCode :size="64" class="muted-icon" />
            </div>
          </div>
          <p class="qr-info">{{ qrCodeInformation }}</p>
          <button class="refresh-btn" @click="getQrCodeKey">
            <RefreshCw :size="14" />
            <span>刷新二维码</span>
          </button>
        </div>

        <!-- 账号登录（密码 / 验证码） -->
        <form v-else class="form" @submit.prevent="handleSubmit">
          <div class="credential-tabs">
            <button
              type="button"
              class="credential-tab"
              :class="{ active: credentialType === 'password' }"
              @click="switchCredential('password')"
            >
              密码登录
            </button>
            <button
              type="button"
              class="credential-tab"
              :class="{ active: credentialType === 'captcha' }"
              @click="switchCredential('captcha')"
            >
              验证码登录
            </button>
          </div>
          <div
            class="input-group glass-input"
            :class="{ error: errors.account }"
          >
            <User :size="18" class="input-icon" />
            <input
              v-model="form.account"
              type="text"
              placeholder="请输入网易云手机号"
              @blur="validateAccount"
            />
          </div>
          <div class="error-msg">{{ errors.account }}</div>

          <!-- 密码 -->
          <div
            v-if="credentialType === 'password'"
            class="input-group glass-input"
            :class="{ error: errors.password }"
          >
            <Lock :size="18" class="input-icon" />
            <input
              v-model="form.password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="请输入密码"
              @blur="validatePassword"
            />
            <button
              type="button"
              class="toggle-pwd"
              @click="showPassword = !showPassword"
            >
              <Eye v-if="!showPassword" :size="18" />
              <EyeOff v-else :size="18" />
            </button>
          </div>
          <div v-if="credentialType === 'password'" class="error-msg">
            {{ errors.password }}
          </div>

          <!-- 验证码 -->
          <template v-else>
            <div
              class="input-group glass-input captcha-group"
              :class="{ error: errors.captcha }"
            >
              <ShieldCheck :size="18" class="input-icon" />
              <input
                v-model="form.captcha"
                type="text"
                maxlength="6"
                placeholder="请输入验证码"
                @blur="validateCaptcha"
              />
              <button
                type="button"
                class="send-captcha-btn"
                :disabled="captchaCountdown > 0 || sendingCaptcha"
                @click="sendCaptcha"
              >
                {{
                  captchaCountdown > 0
                    ? `${captchaCountdown}s`
                    : sendingCaptcha
                      ? '发送中'
                      : '获取验证码'
                }}
              </button>
            </div>
            <div class="error-msg">{{ errors.captcha }}</div>
          </template>

          <button type="submit" class="submit-btn" :disabled="loading">
            {{ loading ? '处理中...' : '登 录' }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
  .login-page {
    position: relative;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--spacing-md);
    overflow: hidden;
  }

  .ambient-canvas {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    z-index: 0;
    pointer-events: none;
  }

  .theme-toggle {
    position: fixed;
    top: var(--spacing-lg);
    right: var(--spacing-lg);
    z-index: 10;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-full);
    background: rgba(255, 255, 255, 0.15);
    border: 1px solid rgba(255, 255, 255, 0.25);
    color: var(--color-text);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    cursor: pointer;
    transition: all var(--transition-base);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  }

  .theme-toggle:hover {
    background: rgba(255, 255, 255, 0.25);
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
  }

  [data-theme='dark'] .theme-toggle {
    background: rgba(0, 0, 0, 0.25);
    border-color: rgba(255, 255, 255, 0.1);
    color: var(--color-text-inverse);
  }

  [data-theme='dark'] .theme-toggle:hover {
    background: rgba(0, 0, 0, 0.35);
  }

  .login-card {
    position: relative;
    z-index: 1;
    width: 100%;
    max-width: var(--login-card-width);
    display: flex;
    border-radius: var(--radius-xl);
    overflow: hidden;
    align-items: stretch;
    min-height: 470px;
    border: 1px solid rgba(255, 255, 255, 0.35);
    box-shadow:
      0 24px 48px -12px rgba(0, 0, 0, 0.18),
      0 12px 24px -8px rgba(0, 0, 0, 0.12),
      inset 0 1px 0 rgba(255, 255, 255, 0.4);
  }

  .glass {
    background: rgba(255, 255, 255, 0.22);
    backdrop-filter: blur(24px) saturate(180%);
    -webkit-backdrop-filter: blur(24px) saturate(180%);
  }

  .glass-panel {
    background: rgba(255, 255, 255, 0.12);
    backdrop-filter: blur(16px) saturate(160%);
    -webkit-backdrop-filter: blur(16px) saturate(160%);
  }

  .glass-input {
    background: rgba(255, 255, 255, 0.18);
    border: 1px solid rgba(255, 255, 255, 0.3);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }

  [data-theme='dark'] .login-card {
    border-color: rgba(255, 255, 255, 0.12);
    box-shadow:
      0 24px 48px -12px rgba(0, 0, 0, 0.5),
      0 12px 24px -8px rgba(0, 0, 0, 0.35),
      inset 0 1px 0 rgba(255, 255, 255, 0.08);
  }

  [data-theme='dark'] .glass {
    background: rgba(30, 30, 46, 0.45);
  }

  [data-theme='dark'] .glass-panel {
    background: rgba(30, 30, 46, 0.32);
  }

  [data-theme='dark'] .glass-input {
    background: rgba(0, 0, 0, 0.25);
    border-color: rgba(255, 255, 255, 0.12);
  }

  .brand-section {
    width: 40%;
    padding: var(--spacing-3xl);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    border-right: 1px solid rgba(255, 255, 255, 0.25);
  }

  [data-theme='dark'] .brand-section {
    border-right-color: rgba(255, 255, 255, 0.08);
  }

  .brand-logo {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-lg);
    margin-bottom: var(--spacing-xl);
  }

  .logo-ring {
    width: 88px;
    height: 88px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-full);
    background: rgba(255, 255, 255, 0.25);
    border: 1px solid rgba(255, 255, 255, 0.4);
    box-shadow: 0 8px 24px rgba(59, 130, 246, 0.2);
  }

  [data-theme='dark'] .logo-ring {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.15);
    box-shadow: 0 8px 24px rgba(139, 92, 246, 0.25);
  }

  .logo-icon {
    color: var(--color-primary);
  }

  .brand-name {
    font-size: 34px;
    font-weight: 700;
    color: var(--color-text);
    letter-spacing: -0.02em;
  }

  .slogan {
    font-size: 16px;
    color: var(--color-text-secondary);
    text-align: center;
    line-height: 1.8;
    margin-bottom: var(--spacing-2xl);
  }

  .decoration {
    display: flex;
    gap: 6px;
    align-items: flex-end;
    height: 44px;
  }

  .wave-bar {
    width: 5px;
    height: 100%;
    background: var(--color-primary);
    border-radius: var(--radius-full);
    animation: wave 1.4s ease-in-out infinite;
    opacity: 0.75;
  }

  @keyframes wave {
    0%,
    100% {
      transform: scaleY(0.35);
    }

    50% {
      transform: scaleY(1);
    }
  }

  .form-section {
    width: 60%;
    padding: var(--spacing-3xl);
    display: flex;
    flex-direction: column;
    /* 固定高度，避免扫码/账号模式切换时内容高度突变抖动 */
    min-height: 492px;
  }

  .form-tabs {
    display: flex;
    gap: var(--spacing-lg);
    margin-bottom: var(--spacing-xl);
  }

  /* 凭证类型切换（密码 / 验证码） */
  .credential-tabs {
    display: flex;
    gap: var(--spacing-md);
    margin-bottom: var(--spacing-md);
  }

  .credential-tab {
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text-muted);
    padding: 4px var(--spacing-sm);
    border-radius: var(--radius-full);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .credential-tab:hover {
    color: var(--color-text-secondary);
  }

  .credential-tab.active {
    color: var(--color-primary);
    background: var(--color-primary-bg);
  }

  .captcha-group {
    padding-right: 6px;
  }

  .send-captcha-btn {
    flex-shrink: 0;
    font-size: 13px;
    font-weight: 500;
    color: var(--color-primary);
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: var(--radius-sm);
    white-space: nowrap;
    transition: all var(--transition-fast);
  }

  .send-captcha-btn:hover:not(:disabled) {
    background: var(--color-primary-bg);
  }

  .send-captcha-btn:disabled {
    color: var(--color-text-muted);
    cursor: not-allowed;
  }

  .tab {
    font-size: 18px;
    font-weight: 600;
    color: var(--color-text-muted);
    padding: var(--spacing-xs) 0;
    position: relative;
    cursor: pointer;
    transition: color var(--transition-fast);
  }

  .tab:hover {
    color: var(--color-text-secondary);
  }

  .tab.active {
    color: var(--color-text);
  }

  .tab.active::after {
    content: '';
    position: absolute;
    bottom: -4px;
    left: 0;
    right: 0;
    height: 3px;
    background: var(--color-primary);
    border-radius: var(--radius-full);
    box-shadow: 0 0 10px rgba(59, 130, 246, 0.4);
  }

  /* 扫码登录 */
  .qr-login {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-md);
  }

  .qr-wrapper {
    width: 196px;
    height: 196px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-lg);
    padding: 14px;
    transition: all var(--transition-base);
  }

  .qr-code {
    width: 100%;
    height: 100%;
    color: var(--color-text);
  }

  .qr-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .muted-icon {
    color: var(--color-text-muted);
  }

  .qr-info {
    font-size: 14px;
    color: var(--color-text-secondary);
    text-align: center;
  }

  .refresh-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--color-primary);
    padding: var(--spacing-xs) var(--spacing-md);
    border-radius: var(--radius-md);
    transition: all var(--transition-fast);
  }

  .refresh-btn:hover {
    background: rgba(59, 130, 246, 0.1);
    text-decoration: underline;
  }

  /* 账号密码登录 */
  .form {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    padding-top: var(--spacing-xl);
  }

  .input-group {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    border-radius: var(--radius-md);
    transition: all var(--transition-fast);
  }

  .input-group:focus-within {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
  }

  .input-group.error {
    border-color: var(--color-error);
    box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.12);
  }

  .input-group input {
    flex: 1;
    font-size: 14px;
    color: var(--color-text);
    padding: var(--spacing-xs) 0;
    outline: none;
    background: transparent;
  }

  .input-icon {
    color: var(--color-text-muted);
    flex-shrink: 0;
  }

  .toggle-pwd {
    color: var(--color-text-muted);
    padding: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .toggle-pwd:hover {
    color: var(--color-text);
  }

  .error-msg {
    font-size: 12px;
    color: var(--color-error);
    padding-left: var(--spacing-md);
    min-height: 18px;
    line-height: 18px;
  }

  .submit-btn {
    position: relative;
    overflow: hidden;
    margin-top: var(--spacing-md);
    padding: var(--spacing-md);
    background: var(--color-primary);
    color: #ffffff;
    border-radius: var(--radius-md);
    font-size: 15px;
    font-weight: 600;
    transition:
      background var(--transition-fast),
      transform var(--transition-fast),
      box-shadow var(--transition-base);
    /* 底部投影 + 主题色微光，跟随主题色变化 */
    box-shadow:
      var(--shadow-sm),
      0 4px 12px var(--shadow-glow);
    cursor: pointer;
  }

  /* hover 流动光泽：白光带从左掠过一次，呼应听潮音浪意象 */
  .submit-btn::before {
    content: '';
    position: absolute;
    top: 0;
    left: -60%;
    width: 50%;
    height: 100%;
    background: linear-gradient(
      100deg,
      transparent,
      rgba(255, 255, 255, 0.4),
      transparent
    );
    transform: skewX(-20deg);
    pointer-events: none;
  }

  .submit-btn:hover:not(:disabled)::before {
    animation: shimmer 600ms ease-out;
  }

  @keyframes shimmer {
    to {
      left: 110%;
    }
  }

  .submit-btn:hover:not(:disabled) {
    background: var(--color-primary-hover);
    transform: translateY(-1px);
    /* hover 强化主题色发光 */
    box-shadow:
      var(--shadow-sm),
      0 6px 20px var(--shadow-glow);
  }

  .submit-btn:active:not(:disabled) {
    transform: translateY(0) scale(0.98);
  }

  .submit-btn:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }

  .submit-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
    box-shadow: var(--shadow-sm);
  }
</style>
