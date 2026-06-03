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
