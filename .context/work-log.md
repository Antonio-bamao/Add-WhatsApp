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
