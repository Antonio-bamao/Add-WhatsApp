# Bug / 工程异常记录

> 所有会影响推进、质量、节奏或判断的异常都要记录，包括代码、环境、依赖、测试、打包和设计误判。

## 2026-05-21: worktree 删除被预览 EXE 占用

- 症状：`git worktree remove C:\Users\m1591\.config\superpowers\worktrees\Add-WhatsApp\codex-risk-workbench-warning` 解除 Git 登记后，Windows 删除目录失败，提示 `dist\Add WhatsApp 0.1.2.exe` 正在被另一个进程使用。
- 根因：之前打开的 worktree 预览 EXE 进程仍在运行，导致 `dist` 目录无法递归删除。
- 处理：确认占用进程为 `Add WhatsApp 0.1.2`，PID `18388`；停止该进程后，安全校验目标路径位于 worktree 根目录下，再删除残留目录。
- 预防：以后删除构建过 EXE 的 worktree 前，先关闭对应预览窗口或检查该 worktree `dist` 下的 EXE 是否仍在运行。

## 2026-05-26: 后台预览端口未运行

- 症状：用户打开 `127.0.0.1:3220` 时浏览器显示 `ERR_CONNECTION_REFUSED`。
- 根因：后台管理台 v0 只是静态文件；上一步验证时通过临时 `python -m http.server` 提供预览，验证结束后停止了临时服务器，但交付时没有提供固定启动脚本，也没有保持预览服务运行。
- 处理：给 `admin/package.json` 增加 `npm run dev`，命令为 `python -m http.server 3220 -d public`；README 写明启动和访问方式；重新启动预览服务并确认 HTTP 200。
- 预防：以后交付需要浏览器打开的静态预览时，要留下固定启动命令，并在最终状态说明服务是否仍在运行。

## 2026-05-29: Docker Desktop daemon 未就绪导致真实 PostgreSQL 测试阻塞

- 症状：运行 `server\npm run test:postgres` 并设置 `ADD_WHATSAPP_TEST_DATABASE_URL=postgres://addwhatsapp:addwhatsapp_dev_password@127.0.0.1:55433/addwhatsapp` 时，测试连接 PostgreSQL 失败；`docker ps` 报无法连接 `dockerDesktopLinuxEngine`，测试报 `ECONNREFUSED 127.0.0.1:55433`。
- 根因：Docker Desktop 进程已启动，但 Linux engine/Docker API 没有对当前 shell 就绪，项目容器 `add-whatsapp-postgres` 无法启动或访问。
- 处理：尝试启动 Docker Desktop 并轮询 Docker API；Docker API 恢复后发现 `add-whatsapp-postgres` 容器处于 exited 状态，用 `docker start add-whatsapp-postgres` 启动容器；随后真实 `server npm run test:postgres` 通过 2/2。
- 预防：以后运行真实 PostgreSQL 集成测试前，先执行 `docker ps` 和 `docker compose up -d`，确认 `add-whatsapp-postgres` 监听 `127.0.0.1:55433` 后再跑 `server\npm run test:postgres`。

## 2026-05-29: 支付宝沙箱 page-pay 收银台 504 且交易未创建

- 症状：支付宝沙箱 `alipay.trade.page.pay` 使用官方 SDK 生成 POST 表单后，打开沙箱收银台出现 `SYSTEM_ERROR` 或 `504 Gateway Time-out`；二维码模式能显示二维码，但沙箱 App 扫码提示系统繁忙；随后调用 `alipay.trade.query` 查询同一 `out_trade_no` 返回 `ACQ.TRADE_NOT_EXIST`。
- 根因：本地接入侧已使用沙箱 APPID、沙箱网关、官方 `alipay-sdk`、POST `pageExecute`、最小必填参数和公网 `notify_url`；支付宝人工客服确认当前沙箱环境系统异常，开发侧正在处理，暂无明确恢复时间。因此当前阻塞属于支付宝沙箱环境/网关侧未成功创建交易，而不是本地回调或入账代码失败。
- 处理：将下单签名从手写实现切到官方 SDK；补 `paymentHtml` POST 表单；把测试参数收紧为纯数字订单号、`subject=test`、`total_amount=0.01`；配置沙箱应用“应用网关地址”；新增管理员鉴权的 `alipay.trade.query` 排查接口；确认公网 API 可访问，且 query 返回的是支付宝业务响应而非本地网络错误。
- 预防：以后遇到沙箱收银台泛化错误时，不再继续猜参数；优先用官方 SDK + 最小参数 + `trade.query` 判断支付宝侧是否创建交易，并记录 traceId 后交给支付宝客服。真实上线前必须在生产环境另行验收，因为沙箱文档明确沙箱并非 100% 等同生产环境。

## 2026-06-03: 境外服务器直连微信支付主域名超时

- 症状：桌面端点击专业版/商业版 `微信支付` 后，前端调试日志显示按钮点击和 `startWechatTopUp` 已进入，订单创建也已发生，但微信 Native 下单响应为 `fetch failed`，无法生成二维码；服务器直接 curl `https://api.mch.weixin.qq.com/v3/certificates` 时 IPv4 超时、IPv6 无法连接。
- 根因：RackNerd 生产服务器到微信支付主域名 `api.mch.weixin.qq.com` 的出口线路不可用；这不是套餐按钮禁用、token、微信环境变量或订单创建逻辑的问题。ZPAY 之前能通，是因为它走 ZPAY 第三方网关，网络路径不同。
- 处理：服务端先增强错误输出，暴露 `AggregateError` 细节；随后对微信支付相关域名强制 IPv4；最终在微信 Native 下单 provider 中加入多区域官方网关 fallback，依次尝试主域名、香港/东南亚、美国、欧洲接入点。
- 预防：以后接入支付、短信、邮件、对象存储等第三方服务时，如果生产服务器出现连接超时，必须先查官方备用域名、区域 endpoint、SDK 自动重试机制和出口防火墙/DNS 行为，不能只停在“服务器网络不通”。

## 桌面端设置页误显示内部用户 ID 作为 UID
- 现象：设置页 UID 显示 user_c74e30f6-9f85-4ca0-a5fd-b1f94400cb50，而后台用户列表同一账号显示 70865138。
- 触发条件：新增设置页 UID 展示时直接从 cloudUserId/accountId/id fallback，而没有沿用后台的 8 位 shortUserUid。
- 影响：后续管理员按 UID 修改账号时会无法和用户自己设置页对照，容易选错参考标识。
- 根因：主进程 desktopUserFromCloudUser 映射丢掉服务端 public user.uid，渲染层又把内部数据库 ID 当作 UID fallback。
- 解决方案：主进程和 cloudSessionRestorer 保留/计算 uid；渲染层只接受 8 位数字 user.uid，否则显示 -。
- 预防措施：契约测试锁定设置页 UID 只从 user.uid 展示，并用截图里的内部 ID 样本验证可计算出 70865138。
- 状态：fixed

## 2026-06-04: 套餐页刷新权益后卡片被清空
- 现象：套餐页只显示额度规则，套餐卡片区域为空。
- 根因：云端权益刷新返回的 subscription 没有 catalog，renderPlanCards 先清空 planCards 后遍历空 catalog。
- 处理：renderSubscriptionState 缺 catalog 时继承现有 catalog；mapCloudEntitlements 默认带 planCatalog。
- 预防：新增 renderer 回归测试，覆盖刷新权益缺 catalog 时套餐卡仍可见。
- 状态：fixed

## 2026-06-05: 误把 GitHub 推送当成官网已更新
- 现象：本地已重新打包 v0.1.3、同步 `website/public/downloads`、更新 `update.json` 并推送 `origin/main` 后，`https://addwhatsapp.com/downloads/latest/update.json` 仍返回旧的 2026-06-02 文件，`/downloads/releases/0.1.3/Add-WhatsApp-0.1.3.exe` 仍为 404。
- 根因：项目的官网不是由 GitHub push 自动完成线上部署；线上落地页和下载文件由 WhatsApp 机 `/opt/add-whatsapp` 上的服务提供，必须在服务器执行 `git pull --ff-only`、安装依赖、`npm run build --prefix website`、重启 `add-whatsapp-website.service` 并 reload Nginx。本地日志过去反复写“同步到 website latest/release”，但没有把“线上服务器部署命令是最终生效步骤”写成硬约束，导致误判。
- 处理：本地提交 `573e50e` 已包含 v0.1.3 新包，线上服务器需要先处理本地 lockfile 改动，再执行部署：`git stash push -m "server-local-lockfiles-before-deploy" -- package-lock.json website/package-lock.json`，随后 `git pull --ff-only`、`npm ci`、`npm ci --prefix website`、`npm ci --prefix server`、`npm run build --prefix website`、重启 website/API、`nginx -t`、`systemctl reload nginx`。
- 预防：以后每次“更新官网包”必须分清两步：第一步是本地 release unit（EXE、latest、release、update.json、release page、测试、构建、commit、push）；第二步是线上服务器 deploy（`/opt/add-whatsapp` pull/build/restart/reload）。最终必须用 `curl -L https://addwhatsapp.com/downloads/latest/update.json` 和 `curl -I https://addwhatsapp.com/downloads/releases/<version>/Add-WhatsApp-<version>.exe` 证明官网生效，不能只凭本地构建或 GitHub 推送声称完成。
- 状态：recorded

## 2026-06-05: WhatsApp 登录二维码三层连环故障
- 现象：点击“开始任务”后，自动化浏览器能打开 `web.whatsapp.com`，但二维码长期转圈；早期表现为跳转到 `https://web.whatsapp.com/login/?post_logout=1&logout_reason=0` 并显示 `Content Not Found`，后续进入真正登录页后又出现粉色提示 `A database error occurred on your browser. Please relink your device.`。
- 关键 Console 证据：第一阶段有 `post_logout` / app bootstrap 失败；第二阶段有 `[storage] storage bucket persistence denied (acquire-persistent-storage-denied)`；最终阶段仍有 `Failed to execute 'open' on 'CacheStorage': Unexpected internal error` 和 `BackendEventBus: storage_initialization_error`。
- 已排除：不是代理问题，手动 Chrome 走同一代理可出二维码；不是 UA 单点问题，已使用真实 Chrome 148 UA；不是 `navigator.webdriver` 单点检测；不是账号封禁；不是普通缓存损坏，全新 profile 和重启电脑后仍复现。
- 根因 1：`whatsapp-web.js` npm 版 v1.34.x 与 WhatsApp Web 2.3000.x 大面积不兼容。WhatsApp 前端协议和 A/B 灰度变化快，npm 发布版本落后会导致注入脚本失败、Web App 无法 bootstrap，最终落到 `post_logout` 错误页。
- 修复 1：依赖改为作者 GitHub 主分支版 `github:pedroslopez/whatsapp-web.js`；同时把 WhatsApp Web HTML 固定到已验证可用的远端版本，避免库自己拉到过期或灰度版本。当前代码以实际可访问的远端 HTML 为准，不使用 404 的版本号。
- 根因 2：全新的自动化 Chromium profile 互动分为 0，Chrome 拒绝给 `https://web.whatsapp.com` 授予持久化存储，WhatsApp Web 无法初始化 IndexedDB，表现为浏览器数据库错误和二维码不生成。
- 修复 2：不再完全依赖 `whatsapp-web.js` 内部 launch；由程序先用 Puppeteer 按原有参数启动浏览器，在 WhatsApp 页面加载前通过 CDP `Browser.grantPermissions` 给 `https://web.whatsapp.com` 授权 `durableStorage` 和 `notifications`，再把 `browser.wsEndpoint()` 交给 `whatsapp-web.js` 连接。
- 根因 3：Windows 上 Chromium 的 CacheStorage 初始化失败。旧 LocalAuth profile 放在 `C:\Users\m1591\AppData\Roaming\add-whatsapp-desktop\accounts\user_c74e30f6-9f85-4ca0-a5fd-b1f94400cb50\whatsapp-session\session-add-whatsapp-user_c74e30f6-9f85-4ca0-a5fd-b1f94400cb50\Default`，到 `Default` 已约 190 字符；Chromium 继续写 `Service Worker\CacheStorage\<hash>\<hash>\...` 后超过 Windows 260 字符路径上限，导致 CacheStorage 写入失败，进而触发 WhatsApp 的 database error。
- 修复 3：LocalAuth `dataPath` 移到极短的 `%LOCALAPPDATA%\aw`，`clientId` 改为账号 UUID 前 8 位，例如 `c74e30f6`；最终 profile 变为 `C:\Users\m1591\AppData\Local\aw\session-c74e30f6\Default`，长度约 56 字符，给 CacheStorage 深层目录留足空间。
- 必须保留的稳定配置：真实 Chrome/148 UA 仍动态拼接，不能设成 `false`；`ignoreDefaultArgs: ['--enable-automation']` 仍保留；启动参数保留 `--disable-blink-features=AutomationControlled`、`--no-sandbox`、`--disable-setuid-sandbox`、`--disable-dev-shm-usage`；LocalAuth 仍按账号稳定映射，登录成功后不要求每次扫码。
- 进程处理教训：正常关闭必须先 `await client.destroy()`，再 `await browser.close()`，并等待浏览器进程退出；`taskkill /F` 只能作为优雅关闭超时后的最后兜底。一旦发生强杀，下一次启动前必须清理该 profile 的 IndexedDB、Local Storage、Session Storage、Service Worker 和 Cache。
- 单实例教训：同一个 `clientId` / session 目录同一时刻只能有一个浏览器实例。新任务启动前必须确认旧实例已经完全销毁，否则 IndexedDB / CacheStorage 文件锁会把同类错误伪装成浏览器数据库损坏。
- 自愈策略：监听 `disconnected`、`auth_failure`、页面 `database error` / `Please relink your device` 文案，以及 `CacheStorage` / `storage_initialization_error` 类 Console 信号；命中后先销毁 client/browser，等进程退出，再用 `fs.promises.rm(path, { recursive: true, force: true, maxRetries: 15, retryDelay: 300 })` 清理 profile 子目录并最多重试 3 次。
- 验证：用户已反馈“终于成功修复这个 bug”；本轮按用户要求先测试源码版，暂不重新打包。
- 备选但未执行：如果 GitHub 主分支 + 固定 Web 版本未来再次失效，可评估社区 fork `github:alechkos/whatsapp-web.js`；若 `whatsapp-web.js` 继续追不上 WhatsApp 前端变化，则迁移到底层库 WPPConnect / wa-js。
- 预防：后续凡是 WhatsApp Web 登录链路失败，必须同时看网页错误页、Console、CDP 存储权限、profile 路径长度和进程锁，不要只按“代理/UA/账号/缓存”单点处理。这次属于多个根因串联并互相遮蔽的重大故障，任一层修完都会暴露下一层问题。
- 状态：fixed and recorded

## 2026-06-05: WhatsApp 自动重置误删全部短路径 profile 的边界风险
- 现象：短路径方案把所有账号的 WhatsApp profile 放在同一个根目录 `%LOCALAPPDATA%\aw` 下，每个账号使用 `session-<8位clientId>` 子目录；审查发现 `resetStaleSession()` 和 `forceReset()` 仍删除整个 `sessionPath` 根目录。
- 风险：单账号测试不明显，但多账号或未来账号切换场景下，某一个账号登录失效或用户强制重新扫码，可能把同一机器上其他账号的 WhatsApp 登录态一起删掉，引发无关账号也要重新扫码。
- 处理：删除目标从 `this.sessionPath` 收窄为 `getLocalAuthProfilePath(this.sessionPath, this.clientId)`，只清当前账号的 `session-<clientId>`；手动清缓存入口本来就是删当前账号子目录，保持不变。
- 验证：新增回归测试 `stale auth reset deletes only the active LocalAuth profile`，先确认旧逻辑会误删 sibling profile，再修复；`node --test tests\whatsappService.test.js` 8/8 通过；根项目 `npm test` 150/150 通过。
- 状态：fixed

## 2026-06-05: 点击开始任务后 Chrome 窗口残留/累积
- 现象：每次点击“开始任务”后会残留或累积多个 Chrome 窗口，很多是空白“新标签页”；多次尝试后窗口越来越多。
- 根因：`waitForReady()` 失败 reject 后只解绑事件监听，没有关闭当前预启动浏览器；普通非 stale 初始化失败直接 throw，未执行 `client.destroy()` / `browser.close()`，且 `this.client` 未置空；再次 `createClient()` 前没有先关闭已存在浏览器；旧兜底杀进程路径依赖 `client.pupBrowser.process()`，在 `browserWSEndpoint` connect 场景可能拿不到真实 pid。
- 处理：`WhatsAppService` 显式持有 `this.browser` 和 `this.browserProcess`；新增统一 `closeBrowser()`，关闭顺序为 `client.destroy()` -> `browser.close()` -> 仅对本 app launch 并记录的真实 pid 执行 `taskkill /F /T /PID` 兜底；任何失败、重试、重新创建客户端、强制重置、destroy 都先走 `closeBrowser()`，并清空 `this.client` / `this.browser`。
- 处理：`createClient()` 开头若已有 client/browser，会先关闭旧实例再 launch 新浏览器；`ensureReadyWithRetry()` 在非可重试错误或最后一次失败前先关闭浏览器，保证“一次失败 = 关掉一个窗口”；renderer 增加 `taskStartInFlight`，按钮点击后立即禁用，重复点击直接忽略；主进程增加 `before-quit` 兜底清理。
- 预防：禁止按 `chrome.exe` 进程名杀进程，只能关闭已持有 browser 或本 app 记录的 pid；后续所有 WhatsApp 初始化失败路径必须覆盖“浏览器被关闭且引用置空”的测试。
- 验证：先写红灯测试确认旧逻辑不会关闭失败窗口、重复 create 不会先关旧窗口；修复后 `node --test tests\whatsappService.test.js` 10/10、`node --test tests\cloudRendererContract.test.js` 5/5、根项目 `npm test` 152/152 通过。
- 状态：fixed in code; 等用户本机实际点击“开始任务”确认窗口不再残留。

## 2026-06-05: 用户电脑使用 Edge 自动化窗口停在 about:blank
- 现象：打包 EXE 发到另一台电脑后，启动 WhatsApp 自动化浏览器显示 “Microsoft Edge 正由自动测试软件控制”，页面停在 `about:blank`，没有进入 WhatsApp 二维码页。
- 根因：旧实现通过 `chromeCandidates` 探测系统 `chrome.exe` / `msedge.exe` 作为 Puppeteer `executablePath`。用户机器没装 Chrome 时会降级 Edge；用户系统浏览器版本、权限、默认环境和 WhatsApp 固定 Web HTML 不一定匹配，且如果 Chrome/Edge 都不存在会直接失败。
- 处理：采用随包固定 Chromium 方案。新增 `puppeteer` 完整依赖和 `scripts/prepare-browser-bundle.js`，打包前把 Chrome for Testing `146.0.7680.31` 复制到 `build-resources\chromium`；`electron-builder` 通过 `extraResources` 打进 `resources\chromium`；运行时只解析内置 Chromium，不再搜索系统 Chrome/Edge。
- 处理：保留此前已修好的 WhatsApp 链路：GitHub 主分支 `whatsapp-web.js`、固定 WhatsApp Web HTML、真实 Chrome UA、CDP `durableStorage` / `notifications` 授权、短 LocalAuth 路径、单实例和优雅关闭。
- 验证：`node --test tests\whatsappService.test.js` 13/13；根项目 `npm test` 155/155；`npm run prepare:browser` 成功；`npm run build` 成功，新 `dist\Add WhatsApp 0.1.3.exe` 为 `200437877` 字节，`dist\win-unpacked\resources\chromium\chrome-win64\chrome.exe` 存在。
- 预防：以后发布 Windows EXE 前必须校验 `resources\chromium\chrome-win64\chrome.exe` 存在；遇到用户机器 `about:blank` 时先区分网络/代理超时和内置浏览器资源缺失，不再建议用户安装 Chrome 作为默认解决方案。
- 状态：fixed in code and packaged; 仍需在无 Chrome/Edge 的干净 Windows 环境做最终手动扫码验收。
