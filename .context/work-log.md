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
