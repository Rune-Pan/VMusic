import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { constructServer } = require('../NeteaseCloudMusicApi/main.js')
const generateConfig = require('../NeteaseCloudMusicApi/generateConfig.js')

let appPromise

export default async function handler(req, res) {
  appPromise ??= generateConfig().then(() => constructServer())
  const app = await appPromise

  req.url = req.url.replace(/^\/api(?=\/|\?|$)/, '') || '/'
  return app(req, res)
}
