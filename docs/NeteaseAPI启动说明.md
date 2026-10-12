# 前后端启动与联调

[文档导航](./README.md) · [项目 README](../README.md)

听潮开发环境需要两个进程：Vite 前端与网易云 API 后端。
前端向 `/api` 请求，Vite 去掉这个前缀后转发到 `http://localhost:3000`。

## 环境准备

需要 npm 和满足 `^22.18.0 || >=24.12.0` 的 Node.js。
在项目根目录检查版本并安装依赖：

```sh
node --version
npm --version
npm ci
npm ci --prefix NeteaseCloudMusicApi --omit=dev
```

推荐使用仓库内的后端副本，以便与项目的依赖锁文件保持一致。
后端包名称及版本见 [NeteaseCloudMusicApi/package.json](../NeteaseCloudMusicApi/package.json)。

## 启动两个服务

终端一，在项目根目录运行后端：

```sh
node NeteaseCloudMusicApi/app.js
```

终端二，在项目根目录运行前端：

```sh
npm run dev
```

后端默认使用端口 3000，前端默认使用 5173。
若前端端口被占用，以 Vite 输出的实际地址为准。
后端窗口需要持续运行；仅启动前端无法获取音乐数据。

也可以使用外部 npm 包启动后端：

```sh
npx @neteasecloudmusicapienhanced/api
```

此方式可能下载与仓库副本不同的版本。一次只运行一种后端，避免端口冲突。

## 检查接口

无需登录即可检查后端歌曲详情：

```sh
curl "http://localhost:3000/song/detail?ids=347230"
```

Windows PowerShell 中可使用：

```powershell
Invoke-RestMethod 'http://localhost:3000/song/detail?ids=347230'
```

正常响应应包含 `code: 200` 和 `songs` 数组。
前端启动后再检查代理：

```powershell
Invoke-RestMethod 'http://localhost:5173/api/song/detail?ids=347230'
```

端口有变化时替换 5173。后端接口正常、代理也正常后，再打开前端并登录。
每日推荐、喜欢列表与用户歌单等需要账号登录，公开接口成功不能替代登录验证。

仓库已经精简后端文档和演示静态页面，联调应直接检查 JSON 接口。

## Windows 启动脚本

| 脚本                      | 行为                                     | 使用条件                          |
| ------------------------- | ---------------------------------------- | --------------------------------- |
| [start.bat](../start.bat) | 安装两端依赖，启动后端与前端，打开浏览器 | 首次运行或需要重新安装依赖        |
| [dev.bat](../dev.bat)     | 跳过安装，启动两端，用 Chrome 打开页面   | 已安装依赖；Chrome 路径与脚本一致 |

脚本会打开服务窗口，并使用固定的 5173 地址打开浏览器。
需要排查错误或调整端口时，优先手动启动，以便查看各自日志。

## 调整后端端口

例如改为 4000，在 PowerShell 中启动：

```powershell
$env:PORT = '4000'
node NeteaseCloudMusicApi/app.js
```

同时把 [vite.config.js](../vite.config.js) 的 `server.proxy['/api'].target`
改为 `http://localhost:4000`，再重启前端。环境变量只需在运行后端的终端设置。

## 构建与部署的区别

- `npm run build` 生成前端静态文件，不启动后端。
- `npm run preview` 检查前端构建结果，本地 API 仍需后端进程；它不会启动 `api/index.js` 的 Vercel 函数。
- Vercel 使用 `api/index.js` 在同一个项目中处理 `/api/*`，无需另起常驻后端进程。
- `.env.development` 和 `.env.production` 均配置 `VITE_NETEASE_API_URL=/api`。

部署步骤见[项目 README](../README.md#部署到-vercel)，
链路说明见[架构总览](./架构总览.md#部署与请求链路)。

## 常见问题

| 现象                     | 检查顺序                                                               |
| ------------------------ | ---------------------------------------------------------------------- |
| Node.js 版本不符合要求   | 对照根目录 `engines`；只有“Node 24”不足以判断小版本是否满足要求        |
| 缺少模块、后端立即退出   | 确认已安装 `NeteaseCloudMusicApi/` 的依赖，查看后端终端错误            |
| 3000 端口占用            | 关闭重复后端，或调整端口并同步修改 Vite 代理                           |
| 请求失败或超时           | 先请求后端地址，再请求前端 `/api` 地址，区分上游故障和代理问题         |
| 登录失败、二维码过期     | 刷新二维码，检查手机端状态与接口响应；其他登录方式也可能受上游校验影响 |
| 接口返回 301             | 可能需要重新登录；以接口返回内容和账号状态为准                         |
| 接口返回 405             | 记录具体接口和响应，可能涉及上游校验或限流，不能一概断言为固定原因     |
| 歌曲只播放一段或没有 URL | 检查账号权限与 `freeTrialInfo`；切换音质不会改变账号权限               |
| 跨域或 Cookie 异常       | 先使用默认同域 `/api`；改用独立 API 域名后需额外检查凭证和跨域配置     |

前端请求超时为 15 秒，配置见 [src/utils/request.js](../src/utils/request.js)。
原先出现过歌单订阅接口 405，当前界面已移除收藏/取消收藏歌单操作；
记录见[功能状态与待办](./VMusic待办事项清单.md)。
