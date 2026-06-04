# 任务拆解

## 当前优先级

1. 补后台真实操作表单：人工调账、订单入账、工作台释放和账号冻结。
2. 补支付/人工入账流程，把订单创建、人工确认和额度入账做成后台可操作闭环。
3. 确认 `addwhatsapp.com` 官网部署平台，以及 `admin.addwhatsapp.com`、`api.addwhatsapp.com` 后续拆分方式。
4. 明确下载包发布流程：每次桌面端打包后复制到 `website/public/downloads`、生成 SHA256、更新 `update.json` 和版本页；推送 GitHub 后必须登录线上 WhatsApp 机执行 `/opt/add-whatsapp` 的 `git pull --ff-only`、`npm ci --prefix website`、`npm run build --prefix website`、重启 `add-whatsapp-website.service`、`nginx -t` 和 `systemctl reload nginx`，否则 `addwhatsapp.com` 仍会下载旧包。
5. 决定是否补代码签名证书、安装器、自动更新和浏览器下载信任提示说明。
6. 继续推进后台真实操作表单、支付/人工入账流程和异常工作台租约管理。

## 依赖关系

- 桌面界面依赖自动化核心模块先拆分清楚。
- 发送任务依赖号码解析和语言识别先稳定。
- 打包 EXE 依赖 Electron 主进程、渲染界面和任务执行链路跑通。
- 官网下载页依赖桌面端已生成可交付 EXE，并需要同步版本号、文件大小和 SHA256；线上官网还依赖生产服务器手动拉取和重启 website 服务，不能把本地 GitHub 推送误认为官网已经生效。
- 官网部署必须和后台/API 分域或分服务，避免把公开官网和管理能力耦合。
- 管理后台依赖云端模块边界先稳定；已通过 `/v1/admin/console` 接入本地 API，并通过 `/v1/admin/auth/login` 获取管理员 token；生产化前不得把生产密钥、数据库 URL 或客户数据写入 `admin/`。
- 后台人工改套餐、补额度、释放工作台和推荐审核必须依赖审计日志，不允许静默修改权威状态。
- `server/` 默认使用内存存储用于 API 运行时预览；本地 PostgreSQL 已初始化并迁移 16 张表，设置 `DATABASE_URL` 后可切换到 PostgreSQL runtime。生产化必须继续保留管理员鉴权，并保留 `credit_ledger`、`usage_daily` 和 `admin_audit_logs` 的事务边界。
- 桌面端已支持云端登录、权益读取、成功添加扣费和第二工作台云端租约申请/续租/释放；后台工作台页后续需要提供人工释放异常租约能力。
