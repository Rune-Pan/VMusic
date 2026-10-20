import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { usePlayerStore } from './stores/player'

import './assets/styles/variables.scss'
import './assets/styles/global.scss'
import './assets/styles/transitions.scss'
import './assets/styles/desktop.scss'

const app = createApp(App)

app.use(createPinia())
// 先恢复暂停状态，再挂载路由页面；详情页不能抢先启动播放。
usePlayerStore().restore()
app.use(router)

app.mount('#app')
