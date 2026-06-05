# Bug 记录：WhatsApp 登录缓存、旧版 webVersionCache、UA 伪造及文件锁定冲突

> 重要更新：下面早期记录保留为排查历史，其中 `userAgent:false`、`webVersionCache:none` 等结论已经被 2026-06-05 最终复盘推翻。后续维护以本文末尾“2026-06-05 最终复盘”为准：必须保留真实 Chrome/148 UA、固定可访问的 WhatsApp Web HTML、GitHub 主分支 `whatsapp-web.js`、CDP 持久化存储授权，以及短路径 LocalAuth profile。

## 问题现象与反馈
1. **老电脑（存在失效缓存）**：
   在点击“开始任务”时无法重新生成二维码，而是始终跳转并卡在：
   `https://web.whatsapp.com/login/?post_logout=1&logout_reason=0`
   显示 "Content Not Found" (西语: "No se encontró el contenido")。
   即使点击“登录异常时重新扫码”按钮，部分情况下依然卡在此页面。
   
2. **连接超时与加载问题（二维码转圈）**：
   一开始有“扫描登录”界面，但二维码区域一直是加载转圈的状态，随后窗口自动关闭，又重新弹出。

---

## 根本原因深度分析

### 1. 自动化浏览器伪造旧版 User-Agent 被拒绝（核心根因）
- **现象原因**：之前代码的 Puppeteer 参数将 UA 硬编码写死成了 `Chrome/122.0.0.0`。
- **失效点**：现在已经是 2026 年，系统真实内核已是 Chromium 148。WhatsApp Web 服务端在验证浏览器环境时，判定 122 版本（两年前的旧版本）为“过旧且不支持的浏览器”，从而强行将访问重定向到登出错误页：`web.whatsapp.com/login/?post_logout=1&logout_reason=0`，导致二维码无法渲染。

### 2. 废弃的固定 HTML 版本导致重定向
- **现象原因**：`whatsapp-web.js` 默认写死了固定 HTML 版本 `'2.3000.1017054665'`。
- **失效点**：WhatsApp Web 官方已经在服务端将该旧版本彻底下线，强行请求此旧版本会导致与最新 WebSocket 握手失败而无限重定向。

### 3. Windows 独占锁与超长路径删除限制
- **现象原因**：`crashpad_handler.exe` 会锁定崩溃监控文件；且 Puppeteer 的缓存目录极深，超出了 Windows 默认的 260 字符路径上限。
- **失效点**：调用普通的删除命令或 Node.js API 时因长路径拒绝访问抛错而**中断**，导致核心的 Cookies 等 Token 根本没有被物理清空。

---

## 修复与优化方案

### 1. 禁用 `userAgent` 重写以应用原生默认 UA
- **实现**：在构造 `Client` 时显式指定 `userAgent: false`。
- **效果**：禁用 `whatsapp-web.js` 内部强行用旧 Mac UA（Chrome 101）重写网页的机制，放行浏览器真正的 Chromium 148 原生 UA。成功通过 WhatsApp 安全认证。

### 2. 彻底禁用 `webVersionCache` 锁定实时版本
- **实现**：修改缓存配置为 `{ type: 'none' }`。
- **效果**：浏览器始终加载官方线上最新版本的页面。

### 3. 系统级防锁与长路径强删
- **实现**：添加 `--disable-crash-reporter`、`--no-crashpad` 等标志；在 Electron 重置时，通过原生 `cmd /c rd /s /q` 命令彻底清理 `accounts` 目录，完美避开了 Windows 260 字符长路径限制和文件锁。

---

## 2026-06-05 最终复盘：二维码转圈 / database error / CacheStorage 初始化失败

### 结论

这次不是一个普通缓存 bug，也不是代理、UA、webdriver 或账号封禁单点问题，而是 WhatsApp Web 启动链路里三个独立根因串在一起：

1. `whatsapp-web.js` npm 版 v1.34.x 跟 WhatsApp Web 2.3000.x 不兼容，导致注入失败、页面 bootstrap 失败，最终跳 `post_logout=1` / `Content Not Found`。
2. 全新自动化 Chromium profile 未获得 `web.whatsapp.com` 的持久化存储权限，Console 出现 `acquire-persistent-storage-denied`，WhatsApp 无法初始化 IndexedDB。
3. 旧 LocalAuth 路径太深，`Service Worker\CacheStorage\<hash>\<hash>` 写入时超过 Windows 260 字符路径限制，Console 出现 `Failed to execute 'open' on 'CacheStorage': Unexpected internal error` 和 `BackendEventBus: storage_initialization_error`。

### 最终有效方案

- `whatsapp-web.js` 使用 `github:pedroslopez/whatsapp-web.js`，不再用落后的 npm 版。
- `webVersionCache` 固定到实际可访问、已验证可用的 WhatsApp Web 2.3000.x HTML；如果指定版本 raw URL 404，必须从 `wppconnect-team/wa-version` 的 `html/` 目录换成最新可访问版本。
- 保留动态真实 Chrome/148 UA，绝对不要再改成 `false`。
- 保留 `ignoreDefaultArgs: ['--enable-automation']`，以及 `--disable-blink-features=AutomationControlled`、`--no-sandbox`、`--disable-setuid-sandbox`、`--disable-dev-shm-usage` 等启动参数。
- 程序先自行 launch Puppeteer，使用 LocalAuth 实际 profile 目录作为 `userDataDir`；浏览器启动后立刻通过 CDP `Browser.grantPermissions` 给 `https://web.whatsapp.com` 授权 `durableStorage` 和 `notifications`；然后把 `browser.wsEndpoint()` 交给 `whatsapp-web.js`。
- LocalAuth `dataPath` 改到 `%LOCALAPPDATA%\aw`，clientId 改成账号 UUID 前 8 位，例如 `c74e30f6`。最终 profile 变成 `C:\Users\m1591\AppData\Local\aw\session-c74e30f6\Default`，长度约 56 字符。
- 正常关闭必须先 `client.destroy()`，再 `browser.close()`；正常流程禁止 `taskkill /F`。同一个 session 目录必须单实例，不能两个浏览器共用一个 profile。

### 自愈要求

- 监听 `disconnected`、`auth_failure`、页面 database error 文案、`Please relink your device`、`CacheStorage` 和 `storage_initialization_error`。
- 命中后先销毁 client/browser，并等待进程退出。
- 再清理当前 profile 下的 `Default\IndexedDB`、`Default\Local Storage`、`Default\Session Storage`、`Default\Service Worker`、`Default\Cache`。
- 删除必须使用 `fs.promises.rm(path, { recursive: true, force: true, maxRetries: 15, retryDelay: 300 })`，避免文件短暂占用导致误判。
- 清理后重新 initialize，最多重试 3 次，每次重新等待 `qr` 事件。

### 经验

这次最容易误判的地方，是每修好一层，下一层才暴露出来：先是 `post_logout`，再是持久化存储 denied，最后才是 CacheStorage 超长路径。以后遇到 WhatsApp Web 二维码不出，不要只盯一个现象；要同时检查库版本、固定 Web 版本、CDP 权限、profile 路径长度、浏览器 Console 和进程是否双开/强杀。
