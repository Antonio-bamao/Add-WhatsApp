# 工作日志

> 每完成一个明确步骤就追加一条记录，不写流水账。

## 2026-05-17

- 步骤：初始化 `.context/` 项目记忆。
- 结果：创建总体计划、当前状态、任务拆解、工作日志、风险和决策文件。
- 下一步：写入正式 Markdown 计划、添加 `.gitignore`、初始化 Git 并提交第一次代码。

- 步骤：固化项目计划与仓库忽略规则。
- 结果：创建 `docs/whatsapp-desktop-plan.md`，添加 `.gitignore`，排除客户数据、登录缓存、进度文件、依赖和构建产物。
- 下一步：提交第一次项目文档。

- 步骤：初始化 Git 仓库并完成第一次提交。
- 结果：提交 `chore: initialize whatsapp desktop project`，包含项目上下文、计划文档和 `.gitignore`。
- 下一步：开始搭建 Electron/Node 项目骨架。

- 步骤：搭建 Electron 桌面骨架和 WhatsApp 风格 UI v0。
- 结果：新增 Electron 主进程、preload、导入预检界面、号码解析模块、语言规则模块、表格导入模块和 Node 测试。
- 验证：`npm test` 通过 11 个测试；Electron 启动冒烟检查返回 `electron-started`。
- 下一步：接入 WhatsApp 登录和发送任务执行器。

- 步骤：接入 WhatsApp 登录复用、任务执行和续跑进度。
- 结果：新增 `WhatsAppService` 使用 `LocalAuth` 保存扫码登录状态；新增任务引擎、JSON 进度存储、按导入文件独立续跑、每日限额、随机间隔、未注册跳过、失败记录和暂停任务。
- 验证：`npm test` 通过 17 个测试；`npm run build` 成功生成 `dist/Add WhatsApp 0.1.0.exe`。
- 下一步：用小样本表格做真实 WhatsApp 手动试跑，并继续完善模板编辑和历史页面。

- 步骤：补齐发送任务、模板文案和历史报表页面。
- 结果：左侧导航现在切换四个真实页面；模板文案支持 EN/ES/FR 编辑保存；发送任务页展示运行统计和日志；历史报表页展示每次任务运行结果。
- 验证：`npm test` 通过 22 个测试；Electron 启动检查返回 `electron-started`；`npm run build` 成功生成便携版 EXE。
- 下一步：真实小样本试跑。

- 步骤：替换应用图标。
- 结果：新增 WhatsApp 风格绿色气泡电话图标，配置为 Electron 窗口图标和 `electron-builder` 打包图标。
- 验证：`npm test` 通过 22 个测试；Electron 启动检查返回 `electron-started`；`npm run build` 成功重新生成带图标的便携版 EXE。
- 下一步：如需消除 Smart App Control 拦截，需要配置正式代码签名证书。

- 步骤：优化小尺寸图标、模板数量和文件夹图标。
- 结果：重生成透明背景多尺寸 ICO，移除旧深色方形背景；NSIS 打包阶段使用该图标；项目文件夹和 `dist` 文件夹写入 `desktop.ini` 图标配置；默认 EN/ES/FR 模板各扩展到 4 条。
- 验证：`npm test` 通过 22 个测试；`npm run build` 生成 77MB 便携版 EXE，关联图标可提取为新透明图标。
- 下一步：如 Windows 仍显示旧图标，需要刷新资源管理器图标缓存或重新打开文件夹。

## 2026-05-20

- 步骤：实现本地账号体系、WhatsApp 缓存隔离和跨设备同步包。
- 结果：新增本地注册登录、密码 `scrypt` 加盐哈希、恢复码下载、7 天 session、账号级数据目录、账号级 WhatsApp session、清除当前账号 WhatsApp 缓存、加密同步包导入/导出、历史与进度迁移；未上数据库、未上服务器。
- 验证：主线提交前 `npm test` 通过；`npm run build` 成功生成便携版 EXE。
- 下一步：继续观察用户已有历史数据迁移是否符合预期，避免新注册后误以为旧记录丢失。

- 步骤：修复 UI 与布局反馈。
- 结果：重新设计登录注册页、设置页和主工作台视觉；左侧导航固定在窗口内，不再随右侧内容滚动；账号与同步页面重命名为设置；修复中等窗口下代理弹窗内容遮挡，移除原生下拉并改为分段按钮。
- 验证：`npm test` 通过；`npm run build` 成功。
- 下一步：如继续改 UI，需要优先验证中等窗口和小高度窗口。

- 步骤：创建独立 worktree 预览“第二工作台 / 另一个账号”能力。
- 结果：使用 worktree `C:\Users\m1591\.config\superpowers\worktrees\Add-WhatsApp\codex-risk-workbench-warning` 和分支 `codex-risk-workbench-warning` 开发，不污染主目录；主工作台可以打开一个独立工作台，独立工作台不能继续无限多开；打开前弹出风控提示。
- 验证：worktree 中 `npm test` 通过。
- 下一步：用户确认后再决定是否合并，不满意可直接删除 worktree。

- 步骤：实现第二工作台代理风控预检与运行中巡检。
- 结果：第二工作台设置页新增 IP 设置按钮；主账号不显示 IP 设置；保存代理前真实执行 SOCKS5 握手、认证、出站连接和出口 IP 查询；保存成功后记录出口 IP 基线；开始任务前重新检测代理；任务运行中每 5 分钟巡检一次，代理失败或出口 IP 变化会报警并请求任务在当前号码处理完后暂停。
- 结果：新增本地代理桥，Chromium/WhatsApp 浏览器连接本机临时 HTTP 代理，代理桥再携带账号密码连接用户 SOCKS5，避免把代理账号密码直接放入 Chromium 启动参数。
- 验证：worktree 中 `node --check` 通过，`npm test` 通过 72/72，`git diff --check` 无空白错误但有 Windows LF/CRLF 提示，`npm run build` 成功生成 `C:\Users\m1591\.config\superpowers\worktrees\Add-WhatsApp\codex-risk-workbench-warning\dist\Add WhatsApp 0.1.2.exe`。
- 下一步：用户手动试用预览 EXE；真实填写 SOCKS5，确认出口 IP 能检测、第二工作台能扫码、任务开始前能拦截异常代理。

## 2026-05-21

- 步骤：合并并清理第二工作台代理 worktree。
- 结果：在 worktree 中先提交 `b4264db feat: add secondary workspace proxy guardrails`，主线快进合并该分支；合并后安装依赖、测试和构建均通过；随后删除 Git worktree 登记和磁盘残留目录。
- 验证：worktree 合并前 `npm test` 通过 72/72；主线合并后 `npm test` 通过 72/72，`npm run build` 生成 `dist\Add WhatsApp 0.1.2.exe`；`git worktree list` 只剩主目录。
- 下一步：在主线继续实现套餐价格页和功能限制。

- 步骤：建立套餐价格和限制核心规则。
- 结果：新增 `src/core/billingPlans.js`，统一定义免费、进阶、专业、商业四档套餐；规则明确账户余额长期保留、每日上限 00:00 重置、进阶/专业/商业工作台数量分别为 2/3/5；任务启动时每日上限按当前套餐封顶；主工作台重复打开独立工作台会按套餐上限拦截。
- 验证：先写 `tests/billingPlans.test.js` 并确认测试因模块缺失失败；实现后 `npm test` 通过 76/76。
- 下一步：补齐套餐 UI 和用量展示。

- 步骤：在设置上方新增探索方案标签页。
- 结果：侧栏新增可展开“探索方案”，包含套餐、用量、积分、账单、推荐奖励；套餐页展示推荐价格方案；用量页展示当前套餐、余额、今日已用、今日可用、工作台占用；积分/账单/推荐奖励先作为规则说明和未来接入占位。
- 验证：`node --check src\renderer\renderer.js`、`node --check src\main\main.js`、`node --check src\core\billingPlans.js` 通过；`npm run build` 成功生成 `dist\Add WhatsApp 0.1.2.exe`。
- 下一步：人工打开 EXE 检查套餐页面视觉、侧栏展开交互、重复打开工作台拦截和每日上限封顶体验。

- 步骤：参考 AI 后台样式优化探索方案子页面。
- 结果：将“积分”改为“额度”；用量页重做为添加额度使用明细、本日使用情况、本月使用情况和工作台占用；额度页加入余额卡、会员卡、额度包购买区和额度规则；账单页加入账单摘要、当前套餐和账单历史表；推荐奖励页加入推荐概览、推荐码、推荐链接和推荐记录；探索方案子菜单展开/收缩改成高度、透明度和位移过渡，避免硬切。
- 验证：新增 `usageSummary` 测试先失败后实现；`node --check src\renderer\renderer.js`、`node --check src\main\main.js`、`node --check src\core\billingPlans.js` 通过。
- 下一步：跑完整测试和构建后，人工打开 EXE 验证视觉效果。

- 步骤：把额度页会员卡改为镭射订阅卡。
- 结果：套餐规则新增卡片等级映射：免费版 `FREE` 银卡，进阶版 `PLUS` 金卡，专业版 `PRO` 金卡，商业版 `ULTRA` 金卡；额度页会员卡改为带芯片式头像、持卡人、等级和接触式标识的卡面；鼠标悬停时卡片保持布局位置不变，仅通过透视倾斜、侧边高光和镭射光带响应指针位置。
- 验证：新增套餐卡等级字段测试先失败后实现；`node --check src\renderer\renderer.js`、`node --check src\core\billingPlans.js`、`node --check src\main\main.js` 通过。
- 下一步：重新打包后人工在 EXE 中确认银卡/金卡质感和鼠标跟随效果。

- 步骤：更新服务器商业化落地计划。
- 结果：`docs/whatsapp-desktop-plan.md` 已补充云端商业化架构，明确桌面端继续本地执行，服务器负责云端账号、套餐权益、额度账本、日/月用量、支付订单、账单、推荐奖励、工作台租约和管理审计；文档详细列出数据库表、API 合同、扣费流程、幂等键、跨天重置、断网补扣、退款拒付、推荐反作弊、套餐升降级和服务不可用等边界。
- 验证：占位词扫描无命中；`validate_context.py --project-root .` 返回 `context is valid`。
- 下一步：先落地最小云端闭环：云端账号 + 套餐权益 + 额度账本 + 桌面端鉴权。

## 2026-05-24

- 步骤：落地 Add WhatsApp 官网第一版。
- 结果：新增独立 `website/` Next.js 应用，包含深色全球科技风首页、下载页、版本页、站点导航/页脚、Three.js 定制大地球、官网直链下载目录和 `update.json`；新增 `docs/repository-structure.md` 记录官网、桌面端和未来后台/API 的边界。
- 结果：将当前构建产物 `dist\Add WhatsApp 0.1.2.exe` 复制为 `website\public\downloads\latest\Add-WhatsApp.exe` 和 `website\public\downloads\releases\0.1.2\Add-WhatsApp-0.1.2.exe`，manifest 使用 SHA256 `c733f26ee257b5333ece4a9e9e3d16a4a39b511bb708b89190e54fb8ec2111f2`。
- 验证：先写 `website\tests\website-structure.test.mjs` 并确认测试因官网缺失失败；实现后 `website\npm test` 通过 5/5，`website\npm run build` 成功；本地 Chrome headless 截图检查桌面和移动端首屏，下载页与下载文件 HEAD 检查通过。
- 下一步：用户确认视觉方向后，继续补正式部署配置、SEO/社交分享图、隐私/条款页和长期版本发布流程。

- 步骤：修复官网本地预览退化为裸 HTML 的问题。
- 结果：定位到 Next dev 输出的 `/_next/static/css/app/layout.css?...` 在当前环境返回 404，导致用户浏览器看不到设计样式；将主样式改为公开静态 `/site.css`，并从 `app/layout.js` 显式加载；同时移除 `next/dynamic({ ssr:false })` 的地球挂载方式，改为直接使用 Client Component，并增强 CSS fallback，避免客户端 JS 慢加载时首屏无地球。
- 验证：`/site.css` 返回 200；清理坏掉的 `.next` 缓存并重启 dev server 后，Chrome headless 桌面/移动端截图显示样式和大地球正常；`website\npm test` 通过 5/5，`website\npm run build` 成功，根项目 `npm test` 通过 77/77。
- 下一步：继续按用户反馈精修视觉，而不是再交付未验证的裸页面。

- 步骤：用浏览器插件调试官网地球地图缺失。
- 结果：浏览器里确认 `.globe-shell` 和 HUD 已渲染，但 Three.js canvas 未挂载且无控制台错误，导致用户看到的地球仍像空壳；新增服务端直接渲染的 SVG 地球底图，包含发光球体、经纬网格、陆地区块、全球路线和动态节点，Three.js 继续作为增强层，不再作为首屏地图唯一来源。
- 验证：浏览器插件复查 `http://localhost:3100`，SVG 地球可见，路线 4 条、节点 6 个、陆地区块 4 个，控制台日志为空；`website\npm test` 通过 5/5，`website\npm run build` 成功，根项目 `npm test` 通过 77/77。
- 下一步：用户确认当前视觉后，再继续做正式部署配置、SEO/社交分享图、隐私/条款页和长期版本发布流程。

- 步骤：修复官网预览 Server Error。
- 结果：确认报错 `Cannot find module './819.js'` 是因为 Next dev server 仍在运行时执行了 `next build`，生产构建覆盖 `.next` 后，旧 dev server 继续引用已经不存在的热更新 chunk；停止占用 `3100` 的旧 Node 进程，清理 `website\.next`，重新启动 dev server。
- 验证：`http://localhost:3100` 返回 200 且页面内容不包含 `Server Error` 或 `Cannot find module`；浏览器插件打开首页确认 `Add WhatsApp` 首屏、SVG 地球、4 条路线、6 个节点和 1 个 Three canvas 均存在。
- 下一步：本地预览期间不要在同一个 `.next` 目录上边跑 dev 边跑 build；如需重新生产构建，构建后必须重启 dev server。

- 步骤：重做官网首屏地球视觉。
- 结果：参考 Stripe globe、globe.gl 和 react-globe 这类成功案例的共同思路，将 Three.js 中乱飘的 3D 飞线移除，Three 只保留空间氛围、球体深度和星点；核心地图改为 SVG 正交投影层，新增大陆轮廓、国家/地区边界线、球面内统一弧线和克制节点，避免路线飞出球外或弧度不一致。
- 验证：浏览器插件复查 `http://localhost:3100`，无 Server Error；首屏存在 1 个 canvas、SVG 地球、7 个陆地区块、21 条国家/地区边界线、4 条统一路线和 8 个节点；`website\npm test` 通过 5/5，`website\npm run build` 成功；构建后已清理 `.next` 并重启 dev server，`http://localhost:3100` 返回 200 且不包含 `Server Error` 或 `Cannot find module`。
- 下一步：继续按用户视觉反馈精修地球精度和品牌首屏，不再把临时 demo 级视觉当正式官网交付。

- 步骤：把官网地球替换为开源方案。
- 结果：安装 `react-globe.gl`、`topojson-client` 和 `world-atlas`；删除手写 SVG 地球和自研 Three 飞线，改为单一 `react-globe.gl` canvas；使用 `world-atlas/countries-110m.json` 本地国家边界渲染 polygons，并配置 4 条 arc links、8 个 markers 和前 4 个节点 rings。
- 验证：浏览器插件复查 `http://localhost:3100`，无 Server Error，首屏 `canvasCount=1`、`staticSvgCount=0`，确认没有双地球叠加；`website\npm test` 通过 5/5，`website\npm run build` 成功，根项目 `npm test` 通过 77/77；构建后已清理 `.next` 并重启 dev server，页面返回 200 且不包含 `Server Error` 或 `Cannot find module`。
- 下一步：继续基于开源地球调视觉参数，不再回到手写叠层地球方案。

- 步骤：按反馈精简地球浮层并增加线路密度。
- 结果：删除首屏地球上的 `Live route intelligence` 和 `Country polygons · Arc links` 两个 HUD 文案；将 arc links 从 12 条扩展到 20 条，增加非洲、欧洲、中东可见半球线路；拉长 dash 段并提高最小线宽，让射线在截图和浏览器预览中更明显。
- 验证：浏览器插件复查 `http://localhost:3100`，无 Server Error，`canvasCount=1`、`hudCount=0`，页面文本不再包含 `Live route intelligence` 或 `Country polygons`；`website\npm test` 通过 5/5，`website\npm run build` 成功，根项目 `npm test` 通过 77/77；构建后已清理 `.next` 并重启 dev server，页面返回 200 且不包含 `Server Error` 或 `Cannot find module`。
- 下一步：如继续增强地球视觉，应优先调 `react-globe.gl` 的 arcs/points 参数，不再增加额外浮层文案。

- 步骤：删除官网 FAQ 区块和占位邮箱。
- 结果：首页移除“上线前最常见的问题”整块 FAQ；页脚移除 `support@addwhatsapp.com`，只保留官方下载和版本记录；结构测试新增断言，防止占位邮箱和 FAQ 文案重新出现。
- 验证：`website\npm test` 通过 6/6，`website\npm run build` 成功；重启 `http://localhost:3100` 后返回 200 且不包含 `support@addwhatsapp.com`、`上线前最常见的问题` 或 Server Error；浏览器插件确认页脚仅显示 Add WhatsApp、说明文案、官方下载和版本记录。
- 下一步：如后续需要联系方式，先确认真实邮箱或客服入口后再加回官网。

## 2026-05-26

- 步骤：新增后台管理台 v0。
- 结果：新增独立 `admin/` 静态管理台预览，不放进 `website/`；页面按云端商业化文档一一对应用户与云端账号、套餐与订阅、额度账本、用量限额、订单与入账、推荐审核、设备与工作台、审计日志 8 个后台模块；同时把桌面端套餐页、用量页、额度页、账单页、推荐奖励页对应到后台管理面、权威数据源和核对项。
- 结果：新增 `admin/tests/admin-structure.test.mjs` 锁定后台独立边界、模块映射、桌面页映射和敏感操作审计可见性；更新 `docs/repository-structure.md` 与 `.context/current-status.md` / `.context/task-breakdown.md`，记录 `admin/`、`website/`、`src/` 的边界。
- 验证：先运行 `admin\npm test` 确认 4 个测试因缺少后台文件失败；实现后 `admin\npm test` 通过 4/4；本地 `http://127.0.0.1:3220/` 浏览器验证模块数 8、映射行 5、运营队列 3、无 console error/warning、无横向溢出；临时静态服务器已停止。
- 下一步：确认后台管理台 v0 信息架构后，进入真实 `server/` API、数据库 schema、管理员登录权限和审计写入。

- 步骤：修复后台预览打不开。
- 结果：确认 `127.0.0.1:3220` 连接被拒绝是因为上一步验证后临时静态服务器已停止；新增 `admin` 的 `npm run dev` 固定启动脚本，README 写明启动后打开 `http://127.0.0.1:3220/`。
- 验证：先补结构测试断言 `dev` 脚本并确认测试失败；补脚本后 `admin\npm test` 通过 4/4；启动预览后 `Invoke-WebRequest http://127.0.0.1:3220/` 返回 200。
- 下一步：用户预览后台 v0 后确认是否继续接真实 API。

- 步骤：新增云端 API 和账本服务骨架。
- 结果：新增独立 `server/`，包含无外部依赖的本地预览 HTTP API、`billingService` 服务层和 `src/db/schema.sql` PostgreSQL 目标表；实现云端账号注册/登录、权益查询、成功添加幂等扣费、人工调账审计、订单创建/人工入账、工作台租约上限和审计日志查询。
- 结果：新增 `server/tests/billing-service.test.mjs` 和 `server/tests/http-api.test.mjs`，先确认缺少服务文件导致测试失败，再实现服务端模块；更新仓库结构和 `.context` 记录 `server/` 边界。
- 验证：`server\npm test` 通过 7/7，覆盖 14 张目标表、权益计算、幂等扣费、人工调账审计、订单入账和工作台租约限制。
- 下一步：把 `admin/` 管理台接入 `server/` API，替换本地预览数据。

- 步骤：将后台管理台从总览长页改为每模块独立页面。
- 结果：`admin/` 首页只保留运营摘要、模块入口、待处理队列和桌面端页面映射；8 个后台模块改为 hash 路由独立页：`#/users`、`#/plans`、`#/credits`、`#/usage`、`#/orders`、`#/referrals`、`#/workspaces`、`#/audit`。
- 结果：新增每个模块的页面标题、说明、详情区、记录表和守则区；侧栏当前模块高亮，不再在同一页面堆叠全部模块详情。
- 验证：先改 `admin/tests/admin-structure.test.mjs` 要求单页面出口、模块路由和页面配置并确认测试失败；实现后 `admin\npm test` 通过 4/4；浏览器验证运营首页 `moduleLinks=8`、`modulePanels=0`，`#/referrals` 页面只显示推荐审核详情，`detailSections=3`、`recordRows=3`、无 console error/warning、无横向溢出。
- 下一步：继续把每个模块页接入 `server/` API。

- 步骤：联调后台管理台与本地云端 API，并初始化项目数据库。
- 结果：`server/` 新增 `/v1/admin/console` 快照接口，按后台 8 个模块返回运行时摘要、模块记录、待处理队列和审计日志；`admin/` 运行时优先从 `http://127.0.0.1:4110/v1/admin/console` 拉取数据，API 不通时回退本地预览数据。
- 结果：新增 `server/docker-compose.yml` 和 `server/scripts/apply-schema.ps1`；`server/src/db/schema.sql` 改为幂等建表并写入 FREE、PLUS、PRO、ULTRA 4 个套餐种子；本机 Docker 已启动 `add-whatsapp-postgres`，端口 `55433->5432`，状态 healthy。
- 验证：先新增后台 fetch/API 快照测试和 Docker 迁移入口测试并确认失败；实现后 `server\npm test` 通过 8/8，`admin\npm test` 通过 5/5，根项目 `npm test` 通过 77/77，`website\npm test` 通过 6/6；`/v1/health`、`/v1/admin/console` 和 `http://127.0.0.1:3220/` 均返回 200；PostgreSQL `plans` 表已查询到 4 个套餐。
- 下一步：把 `server/` 的内存预览存储替换为 PostgreSQL 仓储层，再补管理员登录/权限和桌面端云端登录。

- 步骤：将 `server/` 运行时接入 PostgreSQL 持久化。
- 结果：新增 runtime 抽象，`createAppServer` 不再硬编码内存 store；新增 `createRuntimeFromEnv`，默认内存预览，设置 `DATABASE_URL` 后切换到 PostgreSQL；新增 `server/src/db/postgresRuntime.js`，覆盖注册、登录、权益、调账、扣费、订单、工作台租约、审计日志和后台快照读取。
- 结果：新增 `server\npm run test:postgres`，用 `ADD_WHATSAPP_TEST_DATABASE_URL` 指向本地 `add-whatsapp-postgres` 做真实持久化验证；新增 `pg` 依赖。
- 验证：先写 runtime 抽象测试和 Postgres 持久化测试并确认失败；实现后 `server\npm test` 通过 10/10，`server\npm run test:postgres` 通过 1/1；用 `DATABASE_URL` 临时启动 API 后，`/v1/health` 返回 `mode: postgres`，`/v1/admin/console` 返回 `source: postgres` 并读取数据库中的用户、套餐、账本和审计。
- 下一步：补管理员登录/权限，避免后台敏感接口继续借用普通用户 token；随后接桌面端云端登录和扣费。

- 步骤：补后台管理员登录和敏感接口鉴权。
- 结果：`server/` 新增 `/v1/admin/auth/login`，内存 runtime 和 PostgreSQL runtime 均支持管理员登录；后台调账、订单入账和审计日志读取改为要求管理员 token，普通用户 token 调用调账接口返回禁止。
- 结果：PostgreSQL schema 新增 `admin_users`、`admin_sessions`，本地迁移写入 `admin-preview` 管理员哈希种子；`admin/` 侧边栏新增本地管理员登录表单，登录后将 `adminAccessToken` 写入 sessionStorage 并带 token 请求 API。
- 验证：先写普通用户不能调用后台调账、管理员登录后才能调账、schema 管理员表和后台登录 UI 的失败测试；实现后 `server\npm test` 通过 10/10，`admin\npm test` 通过 5/5，真实 `server\npm run test:postgres` 通过 1/1。
- 下一步：接桌面端云端登录、权益读取和成功添加扣费。

## 2026-05-28

- 步骤：接桌面端云端登录、权益读取和成功添加扣费。
- 结果：新增 `src/core/cloudApiClient.js`、`src/core/cloudSessionStore.js`、`src/main/cloudDesktopController.js` 和 `src/core/taskBilling.js`；桌面端主进程使用 `ADD_WHATSAPP_API_URL` 或默认 `http://127.0.0.1:4110` 连接云端 API，云端 token 存在本机 `cloud-session.json`，不保存云端密码。
- 结果：`src/renderer/index.html` 设置页新增“云端账号和套餐”卡片，支持云端登录、刷新套餐和退出云端；`authState()` 会返回 `cloud` 状态，云端权益会映射到现有套餐/额度/工作台显示。
- 结果：发送任务结束后用 `selectNewlySentRows` 只选本轮新增成功发送行，再通过 `cloudController.consumeSuccessfulAdds` 逐条调用 `/v1/credits/consume`；历史进度里的旧成功行不会再次扣费，云端同步失败只写任务日志，不打断本地任务记录。
- 验证：先写云端 client/session/controller/renderer/taskBilling 测试并确认失败；实现后根项目 `npm test` 通过 87/87，`server\npm test` 通过 10/10，`admin\npm test` 通过 5/5，`website\npm test` 通过 6/6，根项目 `npm run build` 成功生成 `dist\Add WhatsApp 0.1.2.exe`。
- 下一步：把工作台云端租约接到主/第二工作台启动流程，然后补后台真实操作表单和支付/人工入账流程。

- 步骤：接第二工作台启动前的云端租约申请。
- 结果：`CloudApiClient` 新增租约请求测试覆盖，`cloudDesktopController.issueWorkspaceLease` 会在存在云端 session 时调用 `/v1/workspaces/leases`，并带上 `deviceId`、`workspaceKind` 和作为 `processNonce` 的新工作台 ID；无云端 session 时返回 skipped，保留本地预览模式。
- 结果：`workspace:open-another-account` 在真正启动第二工作台进程前先申请云端租约；后台返回 `WORKSPACE_LIMIT_REACHED` 时会阻止新窗口启动，并显示云端工作台上限提示。
- 验证：先写 controller lease 测试并确认缺少方法失败；实现后根项目 `npm test` 通过 90/90，`server\npm test` 通过 10/10，`admin\npm test` 通过 5/5，`website\npm test` 通过 6/6，根项目 `npm run build` 成功生成 `dist\Add WhatsApp 0.1.2.exe`。
- 下一步：补云端工作台 lease 续租/释放 API 和后台真实操作表单，避免 60 秒一次性租约在长期工作台中失真。

- 步骤：补云端工作台租约续租/释放生命周期。
- 结果：`server/` 新增用户鉴权的 `/v1/workspaces/leases/:id/renew` 和 `/v1/workspaces/leases/:id/release`；内存 runtime 与 PostgreSQL runtime 均实现 `renewWorkspaceLease` / `releaseWorkspaceLease`，只允许租约所属用户续租或释放。
- 结果：桌面端 `CloudApiClient` 与 `cloudDesktopController` 新增 renew/release 方法；主进程在打开第二工作台后记录 `leaseId`，每 30 秒续租一次，第二工作台子进程退出时释放租约，续租/释放失败会进入任务日志但不破坏本地窗口清理。
- 验证：先写 server 和 desktop 续租/释放测试并确认失败；实现后 `server\npm test` 通过 11/11，真实 `server\npm run test:postgres` 通过 1/1，根项目 `npm test` 通过 92/92，`admin\npm test` 通过 5/5，`website\npm test` 通过 6/6，根项目 `npm run build` 成功生成 `dist\Add WhatsApp 0.1.2.exe`。
- 下一步：补后台真实操作表单，尤其是人工调账、订单入账、异常工作台租约释放和账号冻结。

## 2026-05-29

- 步骤：补后台真实运营操作表单。
- 结果：`admin/` 在用户、额度、订单、工作台模块分别新增冻结/恢复账号、人工调账、人工标记已支付、释放异常租约表单；表单要求管理员登录 token，提交后刷新后台 API 快照。
- 结果：`server/` 新增 `/v1/admin/users/:id/status` 和 `/v1/admin/workspaces/leases/:id/release`；内存 runtime 与 PostgreSQL runtime 均写入审计日志，冻结用户后云端权益请求返回未授权。
- 验证：先写 admin/server 失败测试确认缺少表单和接口；实现后根项目 `npm test` 通过 92/92，`admin\npm test` 通过 6/6，`server\npm test` 通过 12/12，真实 PostgreSQL `server\npm run test:postgres` 通过 1/1，`website\npm test` 通过 6/6，根项目 `npm run build` 成功；浏览器验证 `http://127.0.0.1:3220/#/credits` 无 console error/warning，额度页显示真实操作表单并读取 PostgreSQL 快照；`.context` 校验通过。
- 下一步：补支付回调、`paid_pending_credit` 补偿队列和后台列表筛选/复制 ID 能力。

## 2026-05-29T00:00:00+08:00｜补支付回调幂等与订单补偿队列底座
- 目标：补支付回调幂等与订单补偿队列底座
- 动作：在 server 内存 runtime 和 PostgreSQL runtime 中新增支付事件处理 processPaymentEvent、paid_pending_credit 补偿 processPendingOrderCredits，并接入 /v1/payments/events 与 /v1/admin/orders/compensate；补充服务层和 HTTP 层测试覆盖重复回调不重复入账、待入账订单补偿只执行一次。
- 结果：支付侧最小闭环已建立：provider_event_id 防重复事件，credit_ledger purchase:{orderId} 防重复入账，人工入账、支付回调、补偿队列共享同一 purchase 账本幂等键。
- 验证：server npm test 14/14 通过；server npm run test:postgres 1/1 通过；根项目 npm test 92/92 通过。
- 下一步：继续补后台订单/支付事件列表筛选、支付渠道签名校验配置，以及更严格的 PostgreSQL 测试数据清理策略。

## 2026-05-29T00:00:00+08:00｜补支付渠道抽象和 mock_alipay webhook 签名校验框架
- 目标：补支付渠道抽象和 mock_alipay webhook 签名校验框架
- 动作：新增 server/src/services/paymentProviders.js，提供 mock_alipay HMAC 签名生成、验签和字段映射；新增 /v1/payments/mock-alipay/notify webhook 路由，验签后转入现有 processPaymentEvent 幂等入账；扩展服务层、HTTP 和 PostgreSQL 测试覆盖签名成功、重复通知、篡改拒绝和数据库 runtime 入账。
- 结果：真实支付宝接入前的服务器侧支付适配层已建立；支付密钥通过 server 环境变量 MOCK_ALIPAY_WEBHOOK_SECRET 注入，桌面端、官网和后台前端不接触密钥。
- 验证：server npm test 17/17 通过；server npm run test:postgres 1/1 通过；根项目 npm test 92/92 通过。
- 下一步：继续补真实支付宝/微信支付接入前的生产配置清单、webhook RSA 验签适配点，以及后台支付事件运营视图。

## 2026-05-29T00:00:00+08:00｜收紧通用支付事件入口权限
- 目标：收紧通用支付事件入口权限
- 动作：将 /v1/payments/events 改为必须管理员鉴权；外部支付通知只允许走带签名校验的 provider webhook，例如 /v1/payments/mock-alipay/notify；补测试证明匿名通用支付事件会被拒绝，管理员事件仍可用于人工/内部联调。
- 结果：支付事件入口边界更清晰：公开 webhook 必须验签，通用内部事件必须管理员鉴权，避免匿名请求绕过 provider 签名直接触发订单入账。
- 验证：server npm test 17/17 通过；server npm run test:postgres 1/1 通过；根项目 npm test 92/92 通过。
- 下一步：继续补后台支付事件运营视图和真实支付宝 RSA 验签适配。

## 2026-05-29T00:00:00+08:00｜补后台订单页支付回调运营视图
- 目标：补后台订单页支付回调运营视图
- 动作：在 server admin console snapshot 的 orders 模块增加 paymentEvents 行数据；PostgreSQL runtime 同步输出 payment_events；admin 订单与入账页新增支付回调事件表、筛选输入、事件/订单 ID 复制按钮和 paid_pending_credit 补偿队列表单；修复移动端表格撑开页面的横向溢出。
- 结果：后台订单页可以同时看订单记录和支付回调事件，运营可筛选 provider/event/order，复制事件号或订单号，并从同页触发待入账补偿；8 个后台模块结构保持不变。
- 验证：admin npm test 6/6 通过；server npm test 17/17 通过；server npm run test:postgres 1/1 通过；根项目 npm test 92/92 通过；Playwright 打开 http://127.0.0.1:3220/#/orders 验证桌面/390px 移动宽度无 console error/warning 且无页面级横向溢出。
- 下一步：继续补真实支付宝 RSA 验签适配点、支付事件生产配置清单，以及支付事件列表的分页/状态筛选 API。

## 2026-05-29T00:00:00+08:00｜补真实支付宝 RSA2 webhook 适配点和生产配置清单
- 目标：补真实支付宝 RSA2 webhook 适配点和生产配置清单
- 动作：参考支付宝异步通知规则，新增 parseAlipayNotification RSA2 验签；新增 /v1/payments/alipay/notify，支持 application/x-www-form-urlencoded POST，验签后映射统一支付事件并返回纯文本 success；新增 docs/payment-production-checklist.md 并补 server README 的支付回调环境变量说明。
- 结果：真实支付宝接入前的服务端适配点已具备：ALIPAY_PUBLIC_KEY/ALIPAY_APP_ID 环境变量、RSA2 验签、app_id 校验、表单通知解析、幂等入账和 success 响应；仍未放入任何真实商户密钥。
- 验证：server npm test 20/20 通过；admin npm test 6/6 通过；server npm run test:postgres 1/1 通过；根项目 npm test 92/92 通过。
- 下一步：继续补支付事件列表分页/状态筛选 API，或在拿到真实商户信息后接订单创建签名和支付宝沙箱联调。

## 2026-05-29T00:00:00+08:00｜补支付事件列表分页和状态筛选 API
- 目标：补支付事件列表分页和状态筛选 API
- 动作：新增 runtime.listPaymentEvents；内存 runtime 和 PostgreSQL runtime 均支持 provider、eventType、processed、q、limit、offset 过滤；新增 GET /v1/admin/payment-events 管理员鉴权路由；补 README 查询示例并扩展 HTTP 与 PostgreSQL 集成测试。
- 结果：后台运营现在可以通过独立 API 查询支付事件，不再只能依赖 admin console 快照；接口支持分页、渠道筛选、事件类型筛选、processed/pending 状态筛选和文本搜索。
- 验证：server npm test 21/21 通过；admin npm test 6/6 通过；server npm run test:postgres 1/1 通过；根项目 npm test 92/92 通过。
- 下一步：继续补真实支付宝订单创建签名和沙箱联调所需的 order create/precreate 适配层，或把 admin 订单页切到分页 API。

## 2026-05-29T00:00:00+08:00｜补支付宝 page-pay 下单签名适配层
- 目标：补真实支付宝订单创建签名和沙箱联调所需的服务端适配层。
- 动作：新增 `buildAlipayPagePayRequest`，从现有订单派生 `alipay.trade.page.pay` 请求参数、`FAST_INSTANT_TRADE_PAY` biz_content 和 RSA2 签名；新增 `/v1/orders/:id/payments/alipay/page-pay`，用户 token 只能为自己的未支付订单生成签名支付 URL；内存 runtime 与 PostgreSQL runtime 均新增订单归属读取接口。
- 结果：支付宝下单侧已具备服务端签名能力，私钥只通过 `ALIPAY_APP_PRIVATE_KEY` 留在 server 环境变量中，Electron、官网和后台前端只拿到签名后的公开参数和 paymentUrl；实际入账仍以 webhook RSA2 验签结果为准。
- 验证：先写 provider/HTTP/PostgreSQL 失败测试；实现后 `server npm test` 23/23 通过，真实 PostgreSQL `server npm run test:postgres` 1/1 通过。
- 下一步：拿到商户沙箱 app_id、应用私钥、支付宝公钥、公网 HTTPS notify_url 后做真实沙箱联调；或先把后台订单页切到 `/v1/admin/payment-events` 分页 API。

## 2026-05-29T00:00:00+08:00｜后台订单页切到支付事件分页 API
- 目标：把后台订单页支付回调事件从 admin console 快照升级为独立分页 API 查询。
- 动作：`admin/public/admin.js` 新增 `loadPaymentEvents`、`paymentEventsQuery`、`paginatePaymentEvents` 和 `handlePaymentEventControlChange`；订单页管理员登录后调用 `GET /v1/admin/payment-events`，支持 provider、processed、q、limit、offset；未登录或接口失败时继续渲染快照支付事件表。
- 结果：后台订单页现在可以直接按渠道、处理状态和搜索词查询真实支付事件分页数据，仍保留复制事件 ID/订单 ID 和补偿队列操作；移动端筛选控件保持单列，不再撑开页面。
- 验证：先写 admin 结构失败测试；实现后 `admin npm test` 7/7 通过；Playwright 打开 `http://127.0.0.1:3220/#/orders`，登录管理员后确认请求 `/v1/admin/payment-events?limit=20&offset=0` 返回 200，桌面和 390px 移动宽度无 console error/warning、无页面级横向溢出。
- 下一步：继续补真实支付宝沙箱联调，或先收紧 PostgreSQL 测试数据清理策略。

## 2026-05-29T00:00:00+08:00｜补 PostgreSQL 集成测试数据清理策略
- 目标：避免真实 PostgreSQL 集成测试在本地数据库中长期留下测试用户、订单、账本、支付事件和工作台租约。
- 动作：新增 `server/tests/helpers/postgresTestCleanup.mjs`，只接受 `pg_test_*_` 安全用户名作用域；清理时先按用户名查用户，再按用户/订单/租约删除 admin_audit_logs、payment_events、referral_records、referral_codes、workspace_leases、usage_daily、usage_monthly、credit_ledger、orders、sessions、devices、subscriptions 和 users；新增 `postgres-cleanup.test.mjs` 验证清理不会删除 plans 和 admin-preview 种子；`postgres-runtime.test.mjs` 改用同一清理 helper 做前置/后置清理；`test:postgres` 改为单并发。
- 结果：PostgreSQL 测试现在有明确的测试数据作用域和清理顺序，不再依赖 Date.now 用户长期堆在共享本地库里。
- 验证：先写缺失 helper 的失败测试；实现后 `server npm test` 23/23 通过，根项目 `npm test` 92/92 通过；启动 `add-whatsapp-postgres` 后，真实 `server npm run test:postgres` 通过 2/2。
- 下一步：继续真实支付宝沙箱联调准备。

## 2026-05-29T20:55:00+08:00｜支付宝沙箱电脑网站支付联调排查
- 目标：用支付宝沙箱应用验证 `alipay.trade.page.pay` 电脑网站支付从下单、收银台、异步通知到幂等入账的真实闭环。
- 动作：配置沙箱 APPID `9021000164625333`、沙箱网关 `https://openapi-sandbox.dl.alipaydev.com/gateway.do`、支付宝公钥和应用私钥；用 cpolar 暴露本地 API 到 `https://6597bbe8.r36.cpolar.top`；设置 `ALIPAY_NOTIFY_URL` 和沙箱应用“应用网关地址”为 `/v1/payments/alipay/notify`；确认本地和公网 `/v1/health` 均返回 `mode: postgres`。
- 动作：将 page-pay 下单侧从手写签名切到官方 `alipay-sdk` 的 `AlipaySdk.pageExecute("alipay.trade.page.pay", ...)`；新增返回 `paymentHtml` 的 POST 自动提交表单；按私钥 PEM 头自动选择 `PKCS1/PKCS8` keyType；把沙箱测试参数收紧为纯数字 `out_trade_no`、`total_amount=0.01`、`subject=test`、`product_code=FAST_INSTANT_TRADE_PAY`。
- 动作：补管理员鉴权的 `GET /v1/admin/alipay/trades/:orderNo/query`，通过官方 SDK 调 `alipay.trade.query` 查询支付宝侧订单状态；修正查询路由一度把订单号取成 `trades` 的路径索引 bug，并把 SDK 请求超时从默认 5 秒调到 20 秒。
- 结果：本地服务端代码侧已形成官方 SDK + 最小参数 + POST form + trade.query 排查能力；公网回调地址可访问，支付宝沙箱收银台能进入二维码页，但扫码后沙箱 App 提示系统繁忙；PC 登录支付和最小参数 POST 表单仍出现 `SYSTEM_ERROR` 或 `504 Gateway Time-out`。
- 结果：`alipay.trade.query` 查询订单 `1780057649205` 和 `1780058889665` 均返回 `ACQ.TRADE_NOT_EXIST`，traceId 分别为 `06020e08178005840987424779963` 和 `060108ce178005897721617306789`；说明支付宝侧没有成功创建交易，回调和本地入账尚未被触发。
- 外部反馈：支付宝人工客服确认“沙箱环境系统有点异常，开发侧也在处理，目前没有具体时间，处理完成后会在工单内同步”。
- 验证：多轮修改后均执行 `server npm test`，当前通过 23/23；公网 `https://6597bbe8.r36.cpolar.top/v1/health` 返回 200 且 `mode: postgres`；trade.query 能正常拿到支付宝沙箱业务响应。
- 下一步：暂不继续改支付参数；等待支付宝沙箱恢复或更换沙箱应用后，用现有 POST 表单重新生成新订单验证；若恢复后仍失败，再带 traceId 和最小参数继续向支付宝客服追踪。

## 2026-05-29T22:15:00+08:00｜支付宝沙箱维护期间补桌面端套餐功能边界
- 目标：支付宝沙箱维护期间补桌面端套餐功能边界
- 动作：新增套餐能力矩阵、任务启动余额/每日上限守卫、导出/工作台/代理/模板保存锁定和支付维护提示；渲染层同步展示当前套餐可用与不可用能力。
- 结果：桌面端在支付暂不可用时仍能按套餐限制功能：免费版锁导出/新工作台/代理，付费套餐按余额与今日剩余控制任务，自定义模板按套餐上限保存，线上支付统一显示维护中。
- 验证：先写失败测试后实现；node --test tests\\billingPlans.test.js tests\\templateStore.test.js 通过 13/13；npm test 通过 97/97；npm run build 成功生成 dist\\Add WhatsApp 0.1.2.exe。
- 下一步：如果支付宝沙箱恢复，再继续用现有 page-pay POST 表单和 trade.query 做真实支付闭环；否则先走人工开通/调账流程。

## 2026-05-30T00:20:00+08:00｜同步已打包桌面端到官网下载交付物
- 目标：同步已打包桌面端到官网下载交付物
- 动作：确认 dist 新 EXE 与 website downloads 旧 EXE 哈希不同；将 dist\\Add WhatsApp 0.1.2.exe 复制到 latest 和 releases\\0.1.2；更新 latest\\update.json 的 releaseDate、sizeBytes 和 sha256；抽查 app.asar 内包含支付维护和套餐锁定文案。
- 结果：官网下载目录和 dist 目录现在指向同一个新 EXE，用户从 website/public/downloads/latest/Add-WhatsApp.exe 打开时会看到套餐边界改动。
- 验证：三个 EXE SHA256 均为 d2a497cfb0eff91b5ae77262c5c246221a11917c56a7ff8f12af3dd3ab6cf09f；update.json sizeBytes=77064717；asar 抽查返回新文案存在。
- 下一步：如需发给别人，直接使用 website\\public\\downloads\\latest\\Add-WhatsApp.exe 或 dist\\Add WhatsApp 0.1.2.exe；避免打开 5/21 的旧副本。

## 2026-05-30T00:35:00+08:00｜让套餐页首屏明确显示支付维护和套餐锁定
- 目标：让套餐页首屏明确显示支付维护和套餐锁定
- 动作：定位 dist 包已有部分新文案但套餐页视觉变化不明显；新增 planPaymentNotice；套餐卡片增加锁定功能列表；非当前套餐按钮改为支付维护中/联系人工开通；补 renderer contract 测试。
- 结果：套餐页打开后首屏可直接看到支付宝沙箱维护提示和每个套餐被锁定的功能，不需要切到额度/账单页才能发现变化。
- 验证：node --test tests\\cloudRendererContract.test.js 通过 2/2；node --check src\\renderer\\renderer.js 通过。
- 下一步：重新打 dist EXE，并同步 latest/release 下载包与 update.json。

## 2026-05-30T17:25:00+08:00｜重新打包 dist 交付包并同步下载清单
- 目标：重新打包 dist 交付包并同步下载清单
- 动作：运行 npm test 和 npm run build；复制新 dist EXE 到 website latest/release；更新 latest update.json 的 sizeBytes 和 sha256；抽查 dist app.asar 包含 planPaymentNotice、支付维护提示、支付维护中/联系人工开通和 lockedFeatureList。
- 结果：用户截图中的 dist\\Add WhatsApp 0.1.2.exe 已重新生成，修改时间为 2026-05-30 17:21:30；套餐页首屏现在能直接看到支付维护和锁定功能。
- 验证：根项目 npm test 通过 98/98；npm run build 成功；website npm test 通过 6/6；三个 EXE SHA256 均为 1453967f86a67a6ca71606ed5f2898838084f2efb8b207ae7cd0b5b94da44be5。
- 下一步：打开新包前先完全退出托盘旧进程，再运行 dist\\Add WhatsApp 0.1.2.exe 验证套餐页。

## 2026-05-30T17:48:00+08:00｜修正套餐模板/任务间隔真实锁定并重新打包
- 目标：修正套餐模板/任务间隔真实锁定并重新打包
- 动作：按用户反馈将模板限制改为每种语言模板池限制：免费 1、Plus 2、Pro 4、Business 不限；添加按钮达到套餐上限即禁用；模板保存按语言数量硬锁；每日上限输入默认设为套餐最高；最小间隔 UI 和主进程统一不低于 44 秒；结束旧 Add WhatsApp 进程后重新 build。
- 结果：dist\\Add WhatsApp 0.1.2.exe 已重新生成并同步到 website latest/release，包内已确认包含 44 秒下限、套餐 dailyLimit 默认值、模板池上限和按钮锁定逻辑。
- 验证：根项目 npm test 通过 99/99；website npm test 通过 6/6；npm run build 成功；三个 EXE SHA256 均为 aa61e5953dc43efd6a8a47452ffc1e8f75360d33cfda6e1cdf780f9591df60c6；asar 抽查四项新逻辑均为 true。
- 下一步：用户重新打开 dist\\Add WhatsApp 0.1.2.exe 验证模板页 Plus 只能保留/添加每语言 2 条，发送任务最小间隔不能低于 44 秒。

## 2026-05-30T17:56:00+08:00｜调整付费套餐成功添加单价并重新打包
- 目标：按用户要求将付费套餐单价改为 0.40、0.30、0.20。
- 动作：更新桌面端套餐源、服务端套餐源、PostgreSQL plans 种子和套餐文档；补充桌面端与服务端测试断言；结束旧 Add WhatsApp 进程后重新 build；同步新 EXE 到 website latest/release 并更新 update.json。
- 结果：进阶版显示 ¥0.40，专业版显示 ¥0.30，商业版显示 ¥0.20；dist\\Add WhatsApp 0.1.2.exe 已重新生成，网站下载包与 dist 包哈希一致。
- 验证：node --test tests\\billingPlans.test.js server\\tests\\billing-service.test.mjs 通过 19/19；根项目 npm test 通过 99/99；server npm test 通过 23/23；website npm test 通过 6/6；npm run build 成功；asar 抽查 unitPriceCents 40/30/20 均为 true；三个 EXE SHA256 均为 837d84b7272723a8541de6cc3d4175dcaff27354d77cd35a8a48ad67448cce9f。
- 下一步：打开 dist\\Add WhatsApp 0.1.2.exe 验证套餐页价格依次为 0.40、0.30、0.20。

## 2026-06-01T23:05:00+08:00｜桌面端接入支付宝线上购买入口
- 目标：用户已有公网后，把桌面端从“支付维护中”切到真实支付宝 page-pay 购买入口。
- 动作：先写失败测试覆盖 `CloudApiClient.createOrder/createAlipayPagePay`、`createCloudDesktopController.createAlipayTopUp`、套餐线上支付能力和渲染契约；随后实现桌面端云端下单、支付宝 page-pay 换链、Electron `shell.openExternal` 打开收银台、preload API、套餐卡/额度页/账单页支付按钮和文案切换。
- 动作：继续保持资金边界：Electron 只发送套餐 ID，订单金额和额度由主进程按本地套餐目录计算，服务端仍从订单行派生支付宝签名参数，支付宝私钥/公钥只通过 `server/` 环境变量注入。
- 结果：付费套餐 `onlinePayment` 已打开；用户登录云端账号后可从套餐卡、额度页或账单页拉起支付宝收银台；未登录云端时按钮禁用并提示先登录云端。
- 结果：重新打包 `dist\\Add WhatsApp 0.1.2.exe`，并同步到 `website\\public\\downloads\\latest\\Add-WhatsApp.exe` 与 `website\\public\\downloads\\releases\\0.1.2\\Add-WhatsApp-0.1.2.exe`；`update.json` 已更新为 2026-06-01、77064284 bytes、SHA256 `d3b6ce1e083fb28866339b8c4bf6aac1cedd0c13d995b5d482251c244a02f136`。
- 验证：红灯测试先失败在缺少 `createOrder/createAlipayPagePay/createAlipayTopUp` 和维护态文案；实现后 `node --test tests\\cloudApiClient.test.js` 5/5、`node --test tests\\cloudMainIntegration.test.js` 8/8、`node --test tests\\billingPlans.test.js` 9/9、`node --test tests\\cloudRendererContract.test.js` 3/3 全部通过。
- 验证：根项目 `npm test` 102/102 通过；`server npm test` 25/25 通过；`website npm test` 6/6 通过；根项目 `npm run build` 成功；latest/release 两个 EXE SHA256 均为 `d3b6ce1e083fb28866339b8c4bf6aac1cedd0c13d995b5d482251c244a02f136`。
- 下一步：用真实公网 API 环境变量启动 server，并让桌面端通过 `ADD_WHATSAPP_API_URL` 指向公网 API，创建一笔新订单完成支付宝端到端付款和异步通知入账验证。

## 2026-06-01T23:35:00+08:00｜桌面端账号改为单一数据库账号
- 目标：移除用户可见的“本地账号 + 云端账号”双账号模型，让软件登录/注册直接使用后台数据库账号，支付宝支付按当前登录账号归属。
- 动作：先写失败测试覆盖 `CloudApiClient.register`、`createCloudDesktopController.register` 和渲染契约；随后实现 `auth:register` / `auth:login` 直接调用云端 API，使用云端 `user.id` 作为桌面账号数据目录 ID，删除 preload 中第二套云端登录/退出 API。
- 动作：清理登录页、设置页和支付锁定文案：删除恢复码/忘记密码入口、删除设置页云端登录面板，把“本地账号”改为单一“账号”，保留 WhatsApp 缓存和同步包作为账号下的本机数据能力。
- 结果：用户打开客户端只需要注册或登录一个账号；套餐、余额、支付订单和本机数据目录都挂到同一个数据库账号，不再需要额外在设置页登录云端。
- 结果：重新打包 `dist\\Add WhatsApp 0.1.2.exe` 并同步到 website latest/release；`update.json` 当前 `sizeBytes=77064878`，SHA256 `1e2cf253edc40e8fe7dcba8460cf114d3b434940f0397983db622683a8bbad2b`。
- 验证：`node --test tests\\cloudApiClient.test.js tests\\cloudMainIntegration.test.js tests\\cloudRendererContract.test.js` 通过 18/18；根项目 `npm test` 通过 104/104；根项目 `npm run build` 成功；`server npm test` 通过 25/25；`website npm test` 通过 6/6。
- 下一步：部署或更新桌面端运行环境后，用公网 API 登录一个数据库账号，点击套餐/额度/账单页支付宝支付，验证 `/v1/orders`、page-pay 打开和 `/v1/payments/alipay/notify` 入账。

## 2026-06-02T00:10:00+08:00｜后台显示注册用户列表
- 目标：用户要求后台能看到账号注册情况，并确认账号密码是否进入数据库。
- 动作：先写失败测试锁定后台用户模块为“注册用户”列表，要求显示注册时间、用户 ID、账号、状态、套餐、余额和会话，且不暴露 password/password_hash 字段；随后更新 admin 文案和表格表头。
- 动作：更新 `/v1/admin/console` users 模块，内存 runtime 与 PostgreSQL runtime 均输出注册用户行；PostgreSQL 路径额外聚合 active subscription、credit_ledger 余额和未撤销 session 数。
- 结果：后台用户页现在用于看注册情况；密码只在数据库里以不可逆校验值保存，后台快照不返回原始密码或密码字段。
- 验证：`admin npm test` 通过 8/8；`server npm test` 通过 25/25。
- 下一步：部署最新 server/admin 后，登录后台打开 `#/users` 查看真实数据库注册账号。

## 2026-06-02T00:35:00+08:00｜桌面端默认连接公网 API
- 目标：支付联调继续推进时，确保给用户下载的打包客户端默认连接 `https://api.addwhatsapp.com`，而不是开发机 localhost。
- 动作：先写失败测试锁定 `DEFAULT_API_BASE_URL` 必须是生产 API 域名；实现后保留 `ADD_WHATSAPP_API_URL` 作为本地开发覆盖开关。
- 动作：重新打包 `dist\\Add WhatsApp 0.1.2.exe`，同步到 `website\\public\\downloads\\latest\\Add-WhatsApp.exe` 与 `website\\public\\downloads\\releases\\0.1.2\\Add-WhatsApp-0.1.2.exe`，并更新 latest `update.json`。
- 结果：新 EXE 打开后会直接请求公网 API；只要 server 环境变量配置好支付宝和 PostgreSQL，桌面端注册、登录、下单、page-pay 都会走线上 API。
- 验证：`node --test tests\\cloudApiClient.test.js` 通过 7/7；根项目 `npm test` 通过 105/105；`npm run build` 成功；打包 asar 抽查包含 `https://api.addwhatsapp.com`；`website npm test` 通过 6/6；`website npm run build` 成功；新下载包 SHA256 `2e4025e235ebbae906dc6c3b5b0c37a9a74d236dfb952a96b919d2f79ec8958d`。
- 下一步：在生产 API 部署环境配置 `DATABASE_URL` 和支付宝 7 个环境变量，重启 server 后用新版 EXE 创建订单并打开支付宝收银台。

## 2026-06-02T01:25:00+08:00｜切换为人工收款码和后台充值
- 目标：放弃当前阶段的支付宝/微信官方自动支付接入，先用人工收款码收款，并由后台给对应注册账号充值。
- 动作：先写失败测试覆盖桌面端手动支付接口、主进程 controller、服务端 `/v1/orders/:id/payments/manual`、后台账号充值表单和订单号入账；随后实现手动付款指引、付款备注、二维码 URL 环境变量、后台按账号用户名调账、后台按订单号标记已支付。
- 结果：桌面端套餐卡、额度页和账单页从“支付宝支付/充值”改为“生成付款订单”；生成订单后显示订单号、金额、付款备注和收款码区域；服务端通过 `MANUAL_PAYMENT_ALIPAY_QR_URL` / `MANUAL_PAYMENT_WECHAT_QR_URL` 控制二维码图片。
- 结果：后台 `#/credits` 的人工调账表单可以直接填注册账号用户名或用户 ID；`#/orders` 的人工标记已支付可以填订单号或订单 ID，减少复制内部 ID 的操作成本。
- 结果：重新打包 `dist\\Add WhatsApp 0.1.2.exe`，同步到 website latest/release，并更新 `update.json` 为 `sizeBytes=77063741`、SHA256 `2edf0e6cc87396ad1f60d25c43aad772545a26e76dd366eab3586f2ef544cb46`。
- 验证：`node --test tests\\cloudApiClient.test.js` 8/8、`node --test tests\\cloudMainIntegration.test.js` 11/11、`node --test tests\\cloudRendererContract.test.js` 3/3 通过；根项目 `npm test` 108/108 通过；`server npm test` 25/25 通过；`admin npm test` 8/8 通过；`website npm test` 6/6 通过；根项目 `npm run build` 成功；`website npm run build` 成功；asar 抽查包含 `cloud:manual-top-up`。
- 下一步：把收款码图片放到公网静态地址，服务器 env 写入 `MANUAL_PAYMENT_ALIPAY_QR_URL`，重启 API 后用新版客户端生成订单并在后台按账号充值验证。

## 2026-06-02T02:15:00+08:00｜内置收款码并替换应用图标
- 目标：用户已把收款码和新图标放进项目，要求无需公网图片地址，直接在安装包里显示收款码，并把桌面端、官网 logo 和浏览器标签页图标全部换成新图标，同时去掉白底。
- 动作：把 `assets/pay/alipay-qr.jpg` 转换为桌面端默认读取的 `assets/pay/alipay-qr.png`；桌面端手动付款渲染改为服务端二维码 URL 优先、无 URL 时默认使用 `../../assets/pay/alipay-qr.png`。
- 动作：用边缘白底识别生成透明底 `assets/icon.png`，并生成 Windows `assets/icon.ico`、官网 `website/public/logo.png`、`website/public/icon.png` 和 Next App Router `website/app/icon.png`；桌面端登录页/侧边栏/关闭弹窗、官网导航/页脚和 metadata icons 均改为引用新图。
- 结果：人工收款码不再需要额外上传公网静态图片；新版 EXE 自带二维码和新图标。若生产 API 仍配置 `MANUAL_PAYMENT_ALIPAY_QR_URL`，服务端返回的 URL 仍会覆盖本地二维码，想走内置图需要删除或留空该 env。
- 结果：重新打包 `dist\\Add WhatsApp 0.1.2.exe`，同步到 website latest/release，并更新 `update.json` 为 `sizeBytes=78645319`、SHA256 `ab6b513ccc82f5a2487ffd36854eb1c618d1b3ccb313b4313e87a345a8fc8860`。
- 验证：`node --test tests\\cloudRendererContract.test.js` 3/3 通过；`npm test` 108/108 通过；`server npm test` 25/25 通过；`admin npm test` 8/8 通过；`website npm test` 6/6 通过；`website npm run build` 成功；根项目 `npm run build` 成功；透明图标左上角 alpha 为 0；`.context` 校验通过。
- 下一步：部署最新 website，让官网下载链接指向新 EXE；用户重新下载后生成付款订单即可看到内置支付宝收款码，付款后后台按账号或订单号充值。

## 2026-06-02T02:45:00+08:00｜修正后台 logo 与图标白底
- 目标：修正上一版图标替换不完整的问题：后台管理台仍显示 `AW`，官网/标签页/桌面端展示仍带白底或图标容器底色。
- 动作：重新从 `assets/iconn.png` 生成透明底图标，这次按“边缘连通非绿色区域”移除背景，保留绿色主体和内部白色电话；输出 `assets/icon.png`、`assets/icon.ico`、官网 logo/icon/favicon、后台 logo/favicon。
- 动作：后台 `admin/public/index.html` 左侧品牌从 `AW` 改为 `<img src="./logo.png">`；后台、官网、桌面端普通品牌图标 CSS 去掉白色背景/边框/圆底；官网 metadata 改为优先 `/favicon.ico`，并保留 `/icon.png`。
- 结果：后台管理台、官网落地页导航 logo、页脚 logo、官网标签页、后台标签页和桌面端品牌图标都使用透明底新图；新 EXE 已同步到 website latest/release，`update.json` 为 `sizeBytes=78742200`、SHA256 `0757ba33927f74564e23aa88647bbc851a4cd20f303c9490a67b14b0b60d9d04`。
- 验证：`admin npm test` 8/8 通过；`website npm test` 6/6 通过；`node --test tests\\cloudRendererContract.test.js` 3/3 通过；根项目 `npm test` 108/108 通过；`website npm run build` 成功；根项目 `npm run build` 成功；图标文件左上角 alpha 均为 0；`.context` 校验通过。
- 下一步：部署最新 admin/website 后，强制刷新浏览器缓存或用无痕窗口确认后台 logo、官网 logo 和标签页 favicon 已更新。

## 2026-06-02T15:20:00+08:00｜接入 ZPAY 聚合支付自动入账
- 目标：用户已选择 ZPAY 聚合支付后，把当前默认购买路径从人工收款改为 ZPAY 收银台，并继续保留人工收款备用。
- 动作：按 TDD 先补失败测试，覆盖 ZPAY 易支付 MD5 签名、page-pay URL、GET/POST 回调验签、云端 API client、桌面端 controller、渲染契约和 HTTP 端到端入账。
- 动作：实现 `server/src/services/paymentProviders.js` 的 `signZpayPayload`、`buildZpayPagePayRequest`、`parseZpayNotification`；新增 `/v1/orders/:id/payments/zpay/page-pay` 和 `/v1/payments/zpay/notify`；桌面端新增 `createZpayTopUp`、`cloud:zpay-top-up`、`startZpayTopUp` 并把套餐/额度/账单支付按钮切到 ZPAY。
- 动作：重新打包 `dist\\Add WhatsApp 0.1.2.exe`，同步到 website latest/release，并更新 `website\\public\\downloads\\latest\\update.json`。
- 结果：新版客户端点击购买会创建云端订单并打开 `https://zpayz.cn/submit.php?...` 收银台；ZPAY 回调验签成功后进入现有 `payment_events` 和 `purchase:{orderId}` 双层幂等入账；人工收款码仍可作为后台备用入口。
- 结果：新下载包 `sizeBytes=78742578`，SHA256 `5d5eee9068f228c0cc867b1b0703542812938435f48d82ca97eafa418d227ae5`。
- 验证：`node --test server\\tests\\payment-providers.test.mjs` 6/6；`node --test tests\\cloudApiClient.test.js` 9/9；`node --test tests\\cloudMainIntegration.test.js` 13/13；`node --test tests\\cloudRendererContract.test.js` 3/3；`node --test server\\tests\\http-api.test.mjs` 9/9；根项目 `npm test` 111/111；`server npm test` 27/27；`admin npm test` 8/8；`website npm test` 6/6；根项目 `npm run build` 成功；`website npm run build` 成功。
- 下一步：用户从 ZPAY 后台“发送到邮箱”拿 KEY；服务器 `/etc/add-whatsapp-api.env` 写入 ZPAY 变量并重启 API；部署最新代码和下载包；用新版 EXE 生成测试订单，付款后在后台 payment-events 和注册用户余额里确认自动入账。

## 2026-06-02T17:20:00+08:00｜修复 ZPAY 支付按钮无反应兜底
- 目标：用户反馈官网下载的新客户端点击右侧深色 `ZPAY 支付` 按钮没有弹出浏览器，需要定位是不是后端、环境变量或桌面端打开外部链接问题。
- 动作：先用生产 API 直测注册、创建订单和 `/v1/orders/:id/payments/zpay/page-pay`，确认后端返回 200 且 `paymentUrl` 能在浏览器打开 ZPAY 微信收银台二维码；随后把问题收敛为桌面端 `shell.openExternal` 没有可见反馈。
- 动作：主进程 `cloud:alipay-top-up` 和 `cloud:zpay-top-up` 捕获 `shell.openExternal` 错误并保留订单/支付结果；新增 `app:open-external-url` IPC；preload 暴露 `openExternalUrl` 和 `copyText`；渲染层 ZPAY 结果卡片新增支付链接、再次打开和复制按钮。
- 结果：即使系统浏览器没自动弹出，用户也会在客户端看到完整支付链接，可点击再次打开或复制到浏览器，不再表现为“按钮没反应”。
- 结果：重新打包 `dist\\Add WhatsApp 0.1.2.exe`，同步到 website latest/release，并更新 `update.json` 为 `sizeBytes=78741586`、SHA256 `2969c6af5dcac59ab44b6b428baf2e310dffd77402cee2e960ee7b9944988159`。
- 验证：`node --test tests\\cloudRendererContract.test.js` 3/3；`node --test tests\\cloudMainIntegration.test.js` 13/13；`node --test tests\\cloudApiClient.test.js` 9/9；根项目 `npm test` 111/111；`server npm test` 27/27；`admin npm test` 8/8；`website npm test` 6/6；根项目 `npm run build` 成功；`website npm run build` 成功。
- 下一步：部署最新 website 下载包和 API 代码后，让用户完全退出旧托盘进程并重新下载安装包；若扫码仍返回 `appid和mch_id不匹配`，继续在 ZPAY/微信渠道侧处理 AppID 与商户号绑定。

## 2026-06-03T01:40:00+08:00｜切换为官方微信 Native 扫码支付
- 目标：用户已完成微信商户号、已认证小程序 AppID 绑定、APIv3 key、商户 API 证书和 notify URL 配置后，放弃 ZPAY 默认路径，改为官方微信 Native 自动支付入账。
- 动作：按 TDD 先补失败测试，覆盖微信 Native 下单签名、APIv3 通知 AES-256-GCM 解密、HTTP 端到端回调、云端 API client、桌面端 controller、IPC/preload 和渲染契约。
- 动作：实现 `buildWechatNativePayRequest` 和 `parseWechatNotification`；新增 `/v1/orders/:id/payments/wechat/native-pay` 与 `/v1/payments/wechat/notify`；服务端支持从 `WECHAT_MERCHANT_PRIVATE_KEY_PATH` 读取 `apiclient_key.pem`，用微信商户私钥生成 `WECHATPAY2-SHA256-RSA2048` 请求签名。
- 动作：桌面端新增 `cloud:wechat-top-up`、`startWechatTopUp` 和二维码渲染；安装 `qrcode` 依赖，把套餐卡、额度页、账单页购买按钮切到微信支付，客户端显示 Native `code_url` 的二维码和链接兜底。
- 动作：后台 payment-events 渠道筛选新增 `wechat`；更新 `server/README.md` 和 `docs/payment-production-checklist.md` 记录微信 Native 生产变量、notify 地址和密钥只能放 server 的边界；重新打包 EXE 并同步到 website latest/release。
- 结果：新版客户端点击“微信支付”会创建云端订单、调用官方微信 Native 下单接口并显示微信扫码二维码；微信支付通知解密成功后走现有 `payment_events` 和 `purchase:{orderId}` 双层幂等入账；ZPAY 代码仍保留为备用，但生产 env 可注释 ZPAY 变量。
- 结果：新下载包 `sizeBytes=78880538`，SHA256 `0d09e629b73034aa634fb4161aef0985b00262d093a21238adc0c34e9b271742`，`releaseDate=2026-06-03`。
- 验证：`npm test` 114/114；`server npm test` 30/30；`admin npm test` 8/8；`website npm test` 6/6；根项目 `npm run build` 成功；`website npm run build` 成功；latest/release 两个 EXE SHA256 一致。
- 下一步：服务器 `git pull --ff-only` 后重启 API 并部署 website/admin；确认 `/etc/add-whatsapp/wechat/apiclient_key.pem` 权限可读；用新版 EXE 创建一笔小额订单，付款后检查微信 notify、后台 payment-events、订单状态和用户余额。

## 2026-06-03T03:20:00+08:00｜修复境外服务器微信 Native 下单超时
- 目标：解决 RackNerd 生产服务器点击专业版/商业版微信支付后前端按钮已触发、但服务端调用微信官方 API 返回 `fetch failed`，导致无法生成 Native 二维码的问题。
- 诊断：生产服务器 curl `https://api.mch.weixin.qq.com/v3/certificates` 时 IPv4 连接超时、IPv6 无法连接；ZPAY 之前能通是因为请求第三方 ZPAY 网关，不经过微信官方 `api.mch.weixin.qq.com` 出口线路。
- 动作：先保留前端 `[payment-debug]` 调试日志和服务端错误 cause 输出，确认按钮、登录 token、订单创建都不是根因；后续提交 `33916ac`、`26bd29b`、`e4c1580`、`e7913f4` 逐步暴露 AggregateError、强制微信支付域名 IPv4，并为微信 Native 下单加入多区域网关 fallback。
- 结果：`buildWechatNativePayRequest` 默认依次尝试 `https://api.mch.weixin.qq.com`、`https://apihk.mch.weixin.qq.com`、`https://apius.mch.weixin.qq.com`、`https://apieu.mch.weixin.qq.com`；生产环境生成微信 Native `code_url` 成功，桌面端能显示微信扫码二维码、订单号、金额和支付链接。
- 结果：提交 `cf20374` 顺手修复 Electron sandbox 下复制支付链接的问题：`copyText` 改为通过 main process IPC 调用 `clipboard.writeText`。
- 注意：生产环境不要设置 `WECHAT_GATEWAY_URL`，否则会覆盖默认 fallback，只走单个网关；保留 `WECHAT_MCH_ID`、`WECHAT_APP_ID`、`WECHAT_API_V3_KEY`、`WECHAT_MERCHANT_SERIAL_NO`、`WECHAT_MERCHANT_PRIVATE_KEY_PATH`、`WECHAT_NOTIFY_URL`。
- 验证：用户截图显示专业版订单已生成微信扫码支付面板和二维码，订单号 `1780469909751`，金额 `¥1500.00`，状态为等待微信支付回调；本地仓库 `main` 已同步到 `origin/main` 的 `cf20374`，仅剩未跟踪 `server/scratch_db.js` 未处理。
- 下一步：新窗口继续用实际扫码支付验证微信异步通知 `/v1/payments/wechat/notify`、后台 payment-events、订单状态和用户余额；验证无误后再打包和部署 website 下载包。

## 2026-06-04T03:42:19+08:00｜让每个桌面端用户在自己的设置页看到 UID
- 目标：让每个桌面端用户在自己的设置页看到 UID
- 动作：先补 cloudRendererContract 失败测试锁定设置页 UID 容器和渲染逻辑；随后在 src/renderer/index.html 的账号卡新增 UID 行，在 renderer.js 从 cloudUserId/accountId/id 计算显示值，在 styles.css 复用现有淡色边框样式。
- 结果：桌面端设置页账号卡现在显示当前登录用户 UID；后台用户列表已有 UID，二者可对照。保留工作区里已有的支付/额度相关未提交改动不处理。
- 验证：node --test tests\\cloudRendererContract.test.js 通过 5/5；npm test 通过 136/136；本机浏览器预览设置页显示 UID 70865138、uidVisible=true、overflowX=false。
- 下一步：如需要发布给用户，后续应在确认同一工作区其他未提交支付/额度改动后重新打包 EXE 并同步 website 下载包。

## 2026-06-04T03:53:15+08:00｜修正桌面端设置页 UID 必须和后台 8 位 UID 一致
- 目标：修正桌面端设置页 UID 必须和后台 8 位 UID 一致
- 动作：按后台实现追踪 UID 来源，确认后台用 shortUserUid(user.id) 生成 8 位数字；先补 tests\\cloudSessionRestorer.test.js 和 tests\\cloudRendererContract.test.js 红灯，复现 user_c74e30f6-9f85-4ca0-a5fd-b1f94400cb50 应显示 70865138；随后在主进程和 cloudSessionRestorer 映射中保存 uid，渲染层只显示 8 位 user.uid。
- 结果：桌面端设置页不再显示内部 user_... ID；服务端返回 uid 时直接使用，旧缓存缺 uid 时按后台同款 SHA-256 短 UID 规则从内部 user id 计算，保证与后台用户列表对得上。
- 验证：node --test tests\\cloudSessionRestorer.test.js tests\\cloudRendererContract.test.js 通过 7/7；npm test 通过 138/138。
- 下一步：如要让当前已打开的客户端看到修复，需要重启/重新加载客户端；发布给用户前仍需结合工作区既有支付/额度改动统一打包 EXE。

## 2026-06-04T04:20:00+08:00｜收紧套餐购买和额度充值规则
- 目标：支付成功后体验闭环，并禁止高级套餐反向购买低级套餐；额外额度只能在额度页按当前套餐单价购买。
- 动作：前端套餐页只允许购买高于当前等级的套餐；额度页 2,000/5,000/20,000/自定义额度会传入下单链路；服务端和 PostgreSQL runtime 拒绝低于当前套餐的订单。
- 结果：支付成功后弹出提示、刷新权益并跳转额度页；购买套餐会同步当前套餐，高级套餐不会被低级订单覆盖；本轮未打包，已撤回误复制的 website 下载产物。
- 验证：npm test 132/132；server npm test 41/41；admin npm test 10/10；website npm test 6/6；真实 PostgreSQL test:postgres 2/2。
- 下一步：确认 UI/支付体验后再打包 EXE，并部署 server 让线上套餐规则生效。

## 2026-06-04T16:42:21+08:00｜修正额度页支付订单归属
- 目标：额度充值的订单/二维码直接显示在额度页，套餐升级订单继续留在套餐页。
- 动作：新增套餐页和额度页支付槽位，按支付上下文移动微信 Native 订单面板；额度自定义充值失败后重新生成会保留原 credits。
- 结果：额度支付不再跳到套餐页；套餐支付不再被成功回调带到额度页；本轮按用户要求未打包。
- 验证：node --test tests\\rendererPlanPayment.test.js 10/10；npm test 140/140。

## 2026-06-04T16:44:00+08:00｜修复套餐页刷新后卡片消失
- 目标：恢复套餐页套餐卡片，避免刷新云端权益后只剩额度规则。
- 动作：确认云端权益刷新返回的 subscription 缺少 catalog，导致 renderPlanCards 清空后无数据可渲染；渲染层改为缺 catalog 时保留已有套餐列表，cloudApiClient 映射权益时默认带 planCatalog。
- 结果：套餐页刷新余额/支付成功后不再丢套餐卡；本轮按用户要求不打包。
- 验证：node --test tests\\rendererPlanPayment.test.js 7/7；node --test tests\\cloudApiClient.test.js 15/15；npm test 137/137。

## 2026-06-04T16:45:15+08:00｜记录 UID 对齐规则
- 目标：记录 UID 对齐规则
- 动作：补充说明：软件设置页 UID 必须和后台用户管理 UID 一致。
- 结果：UID 以服务端 8 位 user.uid 为准；旧缓存缺 uid 时按后台同款 shortUserUid(user.id) 计算，不显示内部 user_... ID。
- 验证：此前已验证：node --test tests\\cloudSessionRestorer.test.js tests\\cloudRendererContract.test.js 通过 7/7；npm test 通过 138/138。
- 下一步：后续注册/修改账号时按后台和软件一致的 8 位 UID 做参考。

## 2026-06-05T02:16:42+08:00｜发布 v0.1.3 WhatsApp 登录失效恢复
- 目标：解决用户点击发送任务后 WhatsApp Web 打到 `post_logout` / `No se encontró el contenido` 页面、二维码不出现、DevTools 弹出、官网仍旧包的问题；同时保持人性化体验，正常 session 不重复要求扫码。
- 动作：按失败路径补 `tests\\whatsappService.test.js`，覆盖失效登录会清当前账号 WhatsApp session 并重试到二维码、普通网络/代理错误不会清 session；补 `tests\\cloudRendererContract.test.js` 锁定正式包禁用 DevTools、未处理 WhatsApp 自动化 warning 兜底、任务页手动重新扫码按钮和按钮 `finally` 解锁。
- 动作：`WhatsAppService.ensureReady()` 改为带重试的 `ensureReadyWithRetry()`；仅当错误匹配 `Execution context was destroyed`、`ProtocolError`、`auth timeout`、`post_logout`、`LOGOUT` 等失效信号时触发 `resetStaleSession()`，正常开始任务不会清缓存；`auth:reset` 会写入任务日志提示正在重新扫码。
- 动作：发送任务页新增 `登录异常时重新扫码` 按钮，用户主动点击时先请求主进程清理当前账号 `whatsapp-session`，如已导入名单则重新进入开始任务流程；任务运行中主进程拒绝清缓存，renderer 用 `try/finally` 保证按钮不会卡死。
- 动作：重新打包 `dist\\Add WhatsApp 0.1.3.exe`，同步到 `website\\public\\downloads\\latest\\Add-WhatsApp.exe` 和 `website\\public\\downloads\\releases\\0.1.3\\Add-WhatsApp-0.1.3.exe`，更新官网 release 元数据和 `update.json`。
- 结果：新包 `sizeBytes=78890507`，SHA256 `c26f77a52ad8893f2b17c0e7691d1b216aa37ffbfc703468f9dbe6c069d71413`；正常有效 WhatsApp 登录会继续复用，只有会话过期/登出类异常才自动重新扫码，手动按钮作为异常兜底。
- 验证：`npm test` 142/142；`server npm test` 42/42；`admin npm test` 11/11；`website npm test` 6/6；根项目 `npm run build` 成功；`website npm run build` 成功；打包 asar 抽查确认 `devTools: false`、`ensureReadyWithRetry`、`auth:reset`、`resetWhatsAppButton` 和版本 `0.1.3` 已进入 EXE；latest/release 两个 EXE SHA256 一致。
- 下一步：推送 `main` 后等待官网部署平台拉取/构建；线上用 `latest/update.json` 和 `releases/0.1.3/Add-WhatsApp-0.1.3.exe` 直接校验，确认用户下载的不是旧 0.1.2 包。

## 2026-06-05T02:45:00+08:00｜补记官网线上更新必须执行服务器部署
- 目标：把 v0.1.3 官网包线上未生效的真实原因写入项目日志，避免未来误把本地打包/GitHub 推送当成官网已经更新。
- 事实：本地已打包并推送 `573e50e` 后，线上 `https://addwhatsapp.com/downloads/latest/update.json` 仍是旧文件，`https://addwhatsapp.com/downloads/releases/0.1.3/Add-WhatsApp-0.1.3.exe` 仍返回 404。
- 根因：当前官网由生产 WhatsApp 机 `/opt/add-whatsapp` 的 website 服务提供，不是 GitHub push 自动发布；线上必须 `git pull --ff-only`、安装依赖、构建 website、重启 `add-whatsapp-website.service` 并 reload Nginx。
- 现场卡点：用户在服务器执行 `git pull --ff-only` 时，服务器本地 `package-lock.json` 和 `website/package-lock.json` 有未提交改动，Git 拒绝覆盖并中止 pull。
- 处理建议：在服务器执行 `git stash push -m "server-local-lockfiles-before-deploy" -- package-lock.json website/package-lock.json` 后再 `git pull --ff-only`；随后执行 `npm ci`、`npm ci --prefix website`、`npm ci --prefix server`、`npm run build --prefix website`、`systemctl restart add-whatsapp-website.service`、`systemctl restart add-whatsapp-api.service`、`nginx -t`、`systemctl reload nginx`。
- 验证标准：只有线上 `curl -L https://addwhatsapp.com/downloads/latest/update.json` 显示 `version=0.1.3` 且 SHA256 为 `c26f77a52ad8893f2b17c0e7691d1b216aa37ffbfc703468f9dbe6c069d71413`，并且 `curl -I https://addwhatsapp.com/downloads/releases/0.1.3/Add-WhatsApp-0.1.3.exe` 返回 200，才能说官网包已更新。

## 2026-06-05T18:30:00+08:00｜复盘并记录 WhatsApp 二维码加载重大连环故障
- 目标：把用户已确认修复的 WhatsApp 登录二维码疑难故障完整写入项目日志，避免后续窗口或未来维护时重复走代理、UA、账号封禁、普通缓存损坏这些已排除方向。
- 动作：整理故障链路为三层根因：`whatsapp-web.js` npm 版与 WhatsApp Web 2.3000.x 不兼容导致 `post_logout`；新自动化 profile 未获 `durableStorage` 导致 IndexedDB 初始化失败；旧 Roaming 深层 LocalAuth 路径过长导致 Windows 上 Chromium CacheStorage 写入失败。
- 动作：记录最终有效组合：`whatsapp-web.js` 改 GitHub 主分支；固定可访问的 WhatsApp Web HTML；保留真实 Chrome/148 UA 和反自动化参数；程序先 launch Puppeteer 并通过 CDP 授权 `durableStorage` / `notifications`；LocalAuth profile 移到 `%LOCALAPPDATA%\\aw`，clientId 缩短到账号 UUID 前 8 位。
- 动作：补充进程和自愈要求：正常关闭必须 `client.destroy()` 后 `browser.close()`，禁止正常流程 `taskkill /F`；同一 session 目录必须单实例；命中 database/storage error 时销毁浏览器、等待退出、清理 IndexedDB / Local Storage / Session Storage / Service Worker / Cache 后最多重试 3 次。
- 结果：这次不再把问题记录成单点 UA、代理或缓存故障，而是明确为“症状混叠、逐层暴露”的重大 WhatsApp Web 启动链路问题。根目录 `bug-log.md` 也新增了“以 2026-06-05 复盘为准”的提示，防止早期 `userAgent:false`、`webVersionCache:none` 等过时结论误导后续修复。
- 验证：用户已反馈“终于成功修复这个 bug”；本轮只写日志和复盘，不重新打包，符合用户“做完先别打包，先测试好再打包”的要求。
- 下一步：继续让用户在源码/开发启动方式下观察二维码、扫码和发送任务稳定性；确认稳定后再决定是否统一打包 EXE、同步官网下载包并部署线上。

## 2026-06-05T19:10:00+08:00｜补强 WhatsApp 重置只清当前账号 profile
- 目标：回答“现在代码是否健硕、异常边界是否处理好”时做上线前审查，重点检查短路径 LocalAuth、单实例、优雅关闭和自愈边界。
- 发现：短路径方案下多个账号共用 `%LOCALAPPDATA%\\aw` 根目录，`resetStaleSession()` / `forceReset()` 删除整个根目录会误删其他账号的 `session-<clientId>`，这是单账号场景不易暴露的小边界。
- 动作：先写失败测试 `stale auth reset deletes only the active LocalAuth profile`，确认旧逻辑会删掉 sibling profile；随后把删除目标收窄到 `getLocalAuthProfilePath(this.sessionPath, this.clientId)`。
- 结果：自动登录失效重置和强制重新扫码只删除当前账号 WhatsApp profile，不影响同一机器上其他账号的登录态。
- 验证：`node --test tests\\whatsappService.test.js` 8/8；`node --test tests\\whatsappSessionManager.test.js` 6/6；根项目 `npm test` 150/150。
- 下一步：继续按用户要求先测试源码版；若用户确认二维码、扫码和发送流程稳定，再统一打包发布。

## 2026-06-05T19:40:00+08:00｜修复开始任务后 Chrome 窗口泄漏
- 目标：解决用户反馈“每次点击开始任务会残留/累积一堆 Chrome 窗口，大多是空白新标签页”的问题，并确认用户给出的根因方向是否对口。
- 诊断：用户方案基本对口；代码审查和红灯测试确认两个真实漏洞：普通非 stale 初始化失败不会关闭预启动浏览器；再次 `createClient()` 前不会先关闭旧浏览器。旧兜底杀进程依赖 `client.pupBrowser.process()`，在当前 `browserWSEndpoint` 连接链路里不够可靠。
- 动作：`WhatsAppService` 显式保存 `this.browser` 和 `this.browserProcess`；新增统一 `closeBrowser()`，优先 `client.destroy()` + `browser.close()`，只有记录了本 app launch 的真实 pid 时才 `taskkill /F /T /PID` 兜底；失败、重试、重建、强制重置、destroy 都走同一关闭链路。
- 动作：`createClient()` 开头先关闭已有 client/browser；`ensureReadyWithRetry()` 在非重试错误或最后一次失败前先关闭浏览器；renderer 增加 `taskStartInFlight` 防止重复点击；主进程增加 `before-quit` 退出兜底。
- 结果：代码层面保证失败重试不会新旧窗口并存，普通初始化失败不会留下孤儿窗口，重复点击不会从 renderer 连续发起多个 start 请求；杀进程只针对记录的 pid，不会按 `chrome.exe` 误杀个人 Chrome。
- 验证：`node --test tests\\whatsappService.test.js` 10/10；`node --test tests\\cloudRendererContract.test.js` 5/5；根项目 `npm test` 152/152。
- 下一步：用户本机源码启动后实际点击一次“开始任务”观察窗口数量；若仍出现超过 1 个可见窗口，需要记录每个窗口出现时间点和任务日志事件，用于判断是正常重试还是关闭超时。

## 2026-06-05T19:55:00+08:00｜清理 WhatsApp 浏览器初始 about:blank 标签
- 目标：二维码已正常出现后，关闭 Puppeteer 启动 Chrome 时残留的默认 `about:blank` 空白标签，让窗口只保留 WhatsApp 标签。
- 动作：在 `qr` 和 `ready` 事件后异步检查 `this.browser.pages()`；只有存在至少一个非 `about:blank` 页面时，才关闭 `about:blank` 页面；所有页面检查和关闭都用 try/catch 包住，不影响扫码和主流程。
- 结果：不会在 WhatsApp 页面尚未存在时关闭唯一空白页，避免浏览器直接退出；也不会关闭 WhatsApp 标签。
- 验证：`node --test tests\\whatsappService.test.js` 12/12；根项目 `npm test` 154/154。

## 2026-06-05T21:25:00+08:00｜改为随 EXE 打包固定 Chromium
- 目标：解决发给普通用户后仍依赖系统 Chrome/Edge 的问题，避免用户未安装 Chrome 时降级 Edge 卡在 `about:blank`，或系统浏览器版本漂移影响 WhatsApp Web 登录。
- 决策：本轮采用备选方案 B，打包 Puppeteer 固定 Chrome for Testing，不接入 Electron 适配分支；原因是当前 `whatsapp-web.js` + 预启动 Puppeteer + CDP 授权 + `browserWSEndpoint` 链路已验证稳定，换 Electron BrowserView 需要重写较多登录、权限、关闭和重试边界。
- 动作：删除系统浏览器探测路径，运行时只解析内置 Chromium：打包后使用 `process.resourcesPath\\chromium\\chrome-win64\\chrome.exe`，开发时优先使用 `build-resources\\chromium`，否则使用 Puppeteer 缓存；新增 `npm run prepare:browser` 在打包前复制固定浏览器内核。
- 动作：`electron-builder` 增加 `extraResources` 和 `asarUnpack`，把 `build-resources\\chromium` 打进 `resources\\chromium`；`.gitignore` 忽略大体积浏览器资源；准备脚本会处理 Puppeteer 半残缓存目录，避免目录存在但 `chrome.exe` 缺失导致准备失败。
- 结果：新 `dist\\Add WhatsApp 0.1.3.exe` 大小 `200437877` 字节；旧本地 `0.1.3` 包大小 `78980953` 字节，本轮约增加 121 MB。`dist\\win-unpacked\\resources\\chromium\\chrome-win64\\chrome.exe` 已存在，未压缩内置 Chromium 资源约 `427887145` 字节。
- 验证：`node --test tests\\whatsappService.test.js` 13/13；根项目 `npm test` 155/155；`npm run prepare:browser` 成功准备 Chrome for Testing `146.0.7680.31`；`npm run build` 成功生成新 EXE。
- 下一步：需要在真正未安装 Chrome/Edge 的干净 Windows 虚拟机或用户电脑上启动 EXE，点击“开始任务”确认二维码出现；本机只能证明打包产物内含 Chromium 且代码不再搜索系统浏览器。

## 2026-06-05T21:45:00+08:00｜同步 v0.1.4 到官网 latest 并禁止旧包下载
- 目标：把内置 Chromium 的 v0.1.4 包同步到官网下载入口；版本记录页面继续保留历史更新说明，但不允许用户下载旧版本。
- 动作：桌面端版本升到 `0.1.4` 后重新 `npm run build`；把 `dist\\Add WhatsApp 0.1.4.exe` 复制为 `website\\public\\downloads\\latest\\Add-WhatsApp.exe`；删除 `website\\public\\downloads\\releases\\0.1.2\\Add-WhatsApp-0.1.2.exe` 和 `0.1.3\\Add-WhatsApp-0.1.3.exe`。
- 动作：`website\\public\\downloads\\latest\\update.json` 改为 `version=0.1.4`，`downloadUrl=/downloads/latest/Add-WhatsApp.exe`；`website\\lib\\releases.js` 新增 v0.1.4 并把旧版本 `downloadUrl` 统一指向 latest；版本记录页按钮文案从“下载此版本”改成“下载最新版”。
- 结果：官网唯一可下载 EXE 为 latest 包，大小 `200439073` 字节，SHA256 `af7cdd7774c5b91a170864ab90c86f1b10337f259deba1acf1cb20fa122809cb`；`public/downloads/releases` 下不再有 `.exe` 旧包。
- 验证：`npm test --prefix website` 6/6；`npm run build --prefix website` 成功；根项目 `npm test` 155/155。
- 下一步：用户手动在生产服务器 `/opt/add-whatsapp` 执行 pull/build/restart/reload 后，线上用 `curl -L https://addwhatsapp.com/downloads/latest/update.json` 和 `curl -I https://addwhatsapp.com/downloads/latest/Add-WhatsApp.exe` 校验版本、大小和 SHA256。

## 2026-06-06T02:04:56+08:00｜记录官网 latest 下载链路和按钮回归
- 目标：把用户关心的官网 EXE 发布链路写清楚，并记录“旧版本不能下载，但最新版必须保留下载按钮”的最终口径。
- 事实：当前官网下载不是直接跳 GitHub Releases；`website/lib/releases.js` 的 `latestRelease.downloadUrl` 指向站内 `/downloads/latest/Add-WhatsApp.exe`，用户点击后实际下载 `https://addwhatsapp.com/downloads/latest/Add-WhatsApp.exe`。
- 链路：本地 `npm run build` 生成桌面 EXE；发布时把最新 EXE 复制为 `website/public/downloads/latest/Add-WhatsApp.exe`，同步 `website/public/downloads/latest/update.json` 和版本说明；提交并推送 GitHub main；生产服务器 `/opt/add-whatsapp` 再 `git pull --ff-only`、构建 website、重启 `add-whatsapp-website.service`、reload Nginx 后才算线上生效。
- 结果：`website/public/downloads` 当前只保留 `latest/Add-WhatsApp.exe` 和 `latest/update.json`；旧版本页面只保留历史说明，不保留旧 EXE 下载入口；最新版卡片恢复且仅恢复一个 `下载最新版` 按钮。
- 修复提交：`0ac3b4f Restore latest release download button only` 已推送到 `origin/main`。
- 验证：`npm test --prefix website` 6/6；`npm run build --prefix website` 成功；构建后 `/releases` 为动态渲染；本地构建产物只包含 1 个 `下载最新版` 文案；服务器 `find website/public/downloads -maxdepth 4 -type f -print` 只看到 latest EXE 和 update.json。
- 注意：`curl -L https://addwhatsapp.com/releases | grep -o "下载最新版" | wc -l` 可能因为 Next HTML 与 hydration/RSC 数据同时包含同一文案而显示 2；最终以浏览器可见按钮和源码结构测试为准。
- 待处理：上传名单审计链路中 1.66 万行文件没有正确出现在后台/行数异常的问题尚未完成修复，后续需要继续从桌面导入、pending audit 兜底、API 接收、后台列表显示四段链路排查。

## 2026-06-06T19:25:00+08:00｜修复 1.66 万行名单上传审计被 Nginx 413 拦截
- 目标：解决桌面端导入 16630 行名单后后台“上传名单审计”缺记录的问题，并把根因和验证方法沉淀到日志。
- 诊断：桌面端预检已能解析出 16630 行，说明不是表格解析失败；Nginx `error.log` 出现 `client intended to send too large body`，样本请求约 1.36MB/1.43MB，证明请求被默认 `client_max_body_size` 在 Nginx 层拦截成 413，Node API 和 PostgreSQL 根本没收到。
- 诊断：旧 `cloudApiClient.request()` 在检查 `response.ok` 前直接 `response.json()`，Nginx HTML 错误页会抛 `Unexpected token '<'`，导致 413/504/401 状态码丢失；旧审计上传又是 `setImmediate` 静默发送，失败只 warn，进一步掩盖了真实原因。
- 动作：桌面端修复非 2xx 响应解析，所有 HTTP 错误都带 `error.status`；审计上传增加 `contact-import-audit:uploading/uploaded/failed` 事件、pending reason 分类、永久失败标记、pending store 未初始化 warn、失败重试 giveUp/指数退避和 28MB 本地 body 预检。
- 动作：桌面端把原始文件从 `originalBase64` 改为 `originalGzipBase64`，服务端 PostgreSQL runtime 优先解压新字段并回退兼容旧 `originalBase64`；`clientImportKey` 改为 `sha256(originalSha256:parsedRows.length)`，避免依赖 gzip 输出字节。
- 动作：生产 Nginx 在 `api.addwhatsapp.com` 443 server 块设置 `client_max_body_size 32m`、`proxy_read_timeout 75s`、`proxy_send_timeout 75s`、`proxy_connect_timeout 75s`；移除误放在 `sites-enabled` 的 `.bak` 备份，避免 duplicate server warning；每次修改均 `nginx -t` 后 `systemctl reload nginx`。
- 动作：为回归确认在 `/etc/nginx/nginx.conf` 的 `http {}` 中新增 `log_format api ... request_length=$request_length ...`，并在 API server 块启用 `access_log /var/log/nginx/access.log api;`。记录教训：`log_format` / `access_log` 是 Nginx 配置，不是 shell 命令。
- 结果：后台“上传名单审计”能看到 16630 行记录；新 access log 能输出 `status` 和 `request_length`，用户验证出现 `status=201 request_length=442876`、`status=201 request_length=615442`，不再出现 413/504。
- 验证：本地代码层面 `npm test` 通过 164/164；`npm test --prefix server` 通过 43/43；生产层面 `nginx -t` successful、`systemctl reload nginx` 完成、Nginx access log 新格式显示 POST `/v1/contact-imports` 返回 201 且带 request_length。
- 下一步：保持 `request_length` 日志格式用于后续大名单回归；如果未来请求接近 28MB 客户端预检阈值，应提示用户拆分名单，而不是继续让 Nginx/API 白跑。
