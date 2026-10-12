# NeteaseCloudMusicApi 本地启动说明

听潮 通过 Vite devServer 代理访问本地运行的 NeteaseCloudMusicApi 服务，获取网易云真实数据。开发服务器将 `/api` 代理到 `http://localhost:3000`。

## 前置要求

- Node.js `^22.18.0 || >=24.12.0`

## 启动方式

**方式一：npx（推荐，无需克隆）**

```bash
npx @neteasecloudmusicapienhanced/api
```

**方式二：使用项目内本地副本**

项目根目录已包含 `NeteaseCloudMusicApi/` 副本，可直接启动：

```bash
cd NeteaseCloudMusicApi
npm install   # 首次运行需要
node app.js
```

两种方式默认都监听 `http://localhost:3000`。

## 验证服务

```bash
curl "http://localhost:3000/search?keywords=周杰伦"
```

预期：返回 JSON，包含搜索结果。

## 与 听潮 联调

1. 确保 NeteaseCloudMusicApi 在 `localhost:3000` 运行。
2. 在 听潮 根目录运行 `npm run dev`。
3. 浏览器打开 Vite 输出的本地地址（默认 `http://localhost:5173`）。
4. 页面加载后即可看到真实网易云数据。

## 常见问题

### 端口 3000 被占用

修改 听潮 的 `vite.config.js`，将代理 `target` 改为其他端口（如 `http://localhost:4000`），并在启动 API 服务时指定相同端口。

### 登录接口返回 400

网易云登录接口对账号敏感，建议使用已实名手机号 + 密码测试；首次登录可能需要验证码，可改用二维码登录。

### 操作返回 405「操作过于频繁」

**仅 `/playlist/subscribe`（收藏/取消收藏歌单）受影响**，其他接口正常。

**根因：** 网易云对 subscribe 接口单独加强了校验，拒绝第三方 API 请求（同一 IP 下官方客户端返回 200，本地 API 返回 405）。将 eapi 改为 weapi 无效，具体校验机制未知，待进一步排查。

### CORS 报错

听潮 开发环境通过 Vite devServer 代理访问，无 CORS 问题；生产环境需保证 API 域名允许 CORS 或与前端部署在同域下。
