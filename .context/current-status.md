# 当前状态

- 当前阶段：Phase 8，后台管理台与云端 API 骨架第一版。
- 主线状态：`C:\Users\m1591\Desktop\Add-WhatsApp` 已新增独立 `admin/` 管理台预览和 `server/` 云端 API 骨架；`website/` 继续作为公开官网，桌面端 `src/` 未参与本轮改动。
- 已完成：`website/` 独立 Next.js App Router 工程已创建；首页、下载页、版本页、公开静态 `/site.css`、站点导航/页脚、`react-globe.gl` 开源 WebGL 地球、`world-atlas` 本地国家边界和下载 manifest 已落地。
- 已完成：当前 Windows 便携版 `dist\Add WhatsApp 0.1.2.exe` 已复制到 `website\public\downloads\latest\Add-WhatsApp.exe` 和 `website\public\downloads\releases\0.1.2\Add-WhatsApp-0.1.2.exe`；`update.json` 已写入版本、文件名、下载路径、发布日期、大小和 SHA256。
- 已完成：新增 `docs/repository-structure.md` 记录当前单仓库分目录边界，明确官网不放 API 密钥、后台逻辑、客户数据或 WhatsApp session，并新增 `admin/` 管理台边界。
- 已完成：新增 `admin/` 静态管理台 v0，按云端商业化文档一一对应 8 个后台模块：用户与云端账号、套餐与订阅、额度账本、用量限额、订单与入账、推荐审核、设备与工作台、审计日志；后台 UI 已改为“一个模块一个页面”，不再把全部模块详情挤在同一个长页面。
- 已完成：`admin/` 将桌面端探索方案 5 个页面映射到后台管理面：套餐页、用量页、额度页、账单页、推荐奖励页。
- 已完成：新增 `server/` 本地预览 API，包含云端账号注册/登录、权益查询、成功添加扣费、人工调账、订单创建/人工入账、工作台租约和审计日志；新增 `server/src/db/schema.sql` 记录 PostgreSQL 目标表。
- 进行中：等待确认是否把 `admin/` 管理台接入 `server/` API，并继续补真实数据库迁移、管理员权限和登录。
- 验证：`website\npm test` 通过 6/6；`website\npm run build` 成功；根项目 `npm test` 通过 77/77；本地 `http://localhost:3100` 桌面/移动端 Chrome headless 截图已复查，样式不再退化为裸 HTML；浏览器插件调试确认首屏只剩 1 个 WebGL canvas、无旧 `.globe-static` SVG 叠加、无 Server Error，地球 HUD 文案已删除，路线扩展到 20 条；下载页返回 200，`/downloads/latest/Add-WhatsApp.exe` HEAD 长度为 `77060652`。
- 验证：`admin\npm test` 通过 4/4；本地 `http://127.0.0.1:3220/` 浏览器验证模块数 8、映射行 5、运营队列 3、无 console error/warning、无横向溢出；`admin` 已新增 `npm run dev` 固定预览命令，当前 `http://127.0.0.1:3220/` 返回 200。
- 验证：后台拆页后，浏览器验证运营首页只显示 8 个模块入口且不渲染 8 个模块详情；`#/referrals` 只显示推荐审核模块详情，3 个详情区、3 条记录、无 console error/warning、无横向溢出。
- 验证：`server\npm test` 通过 7/7，覆盖 14 张目标表、权益计算、幂等扣费、人工调账审计、订单入账和工作台租约限制。
- 下一步：把 `admin/` 的本地预览数据切换为调用 `server/` API；再补真实 PostgreSQL 迁移、管理员角色权限、API token 存储和桌面端云端登录。
- 阻塞项：真实数据库连接、管理员登录方式、支付渠道/人工收款流程、生产域名和部署平台还未最终确定。
