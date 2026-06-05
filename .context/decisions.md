# 决策记录

> 记录高影响决策，不要只记录结论，要写背景、理由和后续约束。

## 2026-05-17: 桌面化路线

- 决策：使用 `Electron + Node + whatsapp-web.js` 封装 Windows 桌面软件。
- 背景：现有脚本已经基于 Node 和 `whatsapp-web.js` 跑通登录、注册检测和发送。
- 理由：最大化复用当前代码和 `.wwebjs_auth` 登录缓存，降低重写风险。
- 约束：桌面界面和自动化核心需要拆分，避免 UI 直接耦合发送逻辑。

## 2026-05-17: 电话号码解析

- 决策：使用 `libphonenumber-js` 处理国际号码和本地号码解析。
- 背景：用户表格格式不统一，包含 `33781387438`、`33-771147488`、`337-340-6764`、`33 7 88 34 60 39`、`(256) 665-4606` 等格式。
- 理由：手写规则容易误判，电话号码解析需要国家上下文和成熟规则库。
- 约束：导入阶段必须提供预检，解析失败或歧义号码不得直接发送。

## 2026-05-17: 数据保护

- 决策：客户号码、登录缓存、进度文件和报表默认不进入 Git。
- 背景：当前目录已有 `.wwebjs_auth`、`.wwebjs_cache`、`progress.json`、`phone_numbers.csv` 和 `numbers.txt`。
- 理由：这些文件包含登录状态、客户号码或运行记录，属于敏感本地数据。
- 约束：首次提交只包含代码、配置、计划和项目上下文。

## 2026-05-20: 本地账号与跨设备同步

- 决策：账号体系坚持本地优先，不引入数据库或服务器；跨设备继续采用用户手动导出/导入加密同步包。
- 背景：用户要求本地注册登录、密码不明文保存、不同账号 WhatsApp 缓存隔离，同时希望另一台电脑能延续名单进度。
- 理由：无服务器条件下无法自动跨设备同步，也无法阻止整机 `userData` 被复制；加密同步包能迁移历史与进度，同时避免携带密码、恢复码、WhatsApp 缓存和原始客户表格。
- 约束：本地账号不是云账号；换设备必须重新扫码 WhatsApp；同步包导入需要用户提供导出密码；同名但内容不同的名单不能静默套用旧进度。

## 2026-05-20: 第二工作台代理方案

- 决策：第二工作台使用独立 Electron `userData`，只允许从主工作台打开一层；主工作台默认走当前电脑/VPN 网络，第二工作台才允许配置 SOCKS5 代理。
- 背景：用户担心同一 IP 同时跑两个 WhatsApp 账号会更容易触发风控，希望第二账号可像指纹浏览器一样配置单独代理。
- 理由：独立 `userData` 可以隔离本地账号、WhatsApp 缓存和任务历史；只开放一层第二工作台可以避免无限多开导致 CPU/内存和风控风险失控；主账号不显示代理设置能降低误操作。
- 约束：代理只能降低同出口 IP 的风险，不能保证规避 WhatsApp 风控；保存代理必须真实检测 SOCKS5 和出口 IP；带账号密码的 SOCKS5 通过本地代理桥转发给 Chromium，不把凭据直接写入浏览器启动参数。

## 2026-05-21: 套餐额度与每日上限分离

- 决策：用户购买的添加额度作为账户余额长期保留；每日可用上限只作为风控和套餐节奏阀门，每天 00:00 重置，不清空账户余额。
- 背景：用户担心按 0.3 元/成功添加充值后，因为随机间隔和每日限额导致当天用不完额度，产生“余额是否清零”的混乱。
- 理由：余额是付费资产，不能和每日限额混用；每日上限只限制消耗速度，规则更容易解释，也更少产生售后争议。
- 约束：当前仅实现本地套餐规则、价格页、工作台数量限制和任务每日上限封顶；真实充值账本、扣费确认、退款流水、积分和账单需要后续接入。

## 2026-05-21: 不提供无限工作台

- 决策：商业版也不写“无限工作台”，改为默认 5 个工作台，可申请扩容；进阶版 2 个，专业版 3 个。
- 背景：主工作台曾能重复点击打开多个独立工作台，造成套娃之外的无限多开风险。
- 理由：无限工作台会带来性能、代理、WhatsApp 风控和售后责任风险；固定默认上限更可控，也能给高价值客户留出人工扩容空间。
- 约束：当前主进程以内存集合跟踪由主工作台打开的独立工作台，关闭子进程后释放名额；跨主进程重启后的存活工作台发现需要后续更强的进程锁或心跳文件支持。

## 2026-05-21: 商业化改为本地执行 + 云端授权

- 决策：服务器和数据库只作为商业化权威底座，负责云端账号、套餐、额度账本、用量限制、支付订单、账单、推荐奖励、工作台租约和管理审计；WhatsApp 登录缓存、客户表格、任务执行和本地历史默认仍留在用户电脑。
- 背景：推荐奖励、真实充值、额度扣费和跨设备套餐限制必须依赖服务器，否则无法可靠判断真实注册、支付、推荐归因、余额、退款和反作弊；但用户此前明确重视本地数据和低耦合。
- 理由：这种拆分能让付费和推荐逻辑具备可信账本，同时避免把敏感客户名单和 WhatsApp session 强行上传，重构范围也比全云端任务系统小。
- 约束：每日限额由服务器按 `Asia/Shanghai` 业务日计算，只重置用量不清空余额；成功添加扣费必须使用幂等键；失败、未注册、无效号码、代理异常和暂停不扣额度；推荐奖励必须等云端账号、订单和额度账本稳定后再接。

## 2026-05-24: 官网采用独立 Next.js 应用

- 决策：在仓库根目录新增独立 `website/` Next.js App Router 应用，作为 `addwhatsapp.com` 官网和软件下载入口；不把官网放进桌面端 `src/`，也不和未来 API/后台混写。
- 背景：用户希望像正规软件一样有官网落地页、精美交互大地球和官网直链下载，同时后续管理后台走 `admin.addwhatsapp.com`。
- 理由：Next.js 方便后续 SEO、版本页、多语言和内容扩展；独立目录能保持桌面端、本地任务执行、后台/API 和公开官网之间的边界。
- 约束：官网只能保存公开内容、下载文件和公开版本元数据；不得放 API 密钥、数据库 URL、后台权限、客户表格、WhatsApp session 或桌面端内部状态。

## 2026-05-24: 官网地球改用开源组件

- 决策：首屏地球从手写 Three.js/SVG 混合实现改为 `react-globe.gl`，国家边界数据使用本地打包的 `world-atlas` TopoJSON，经 `topojson-client` 转为 GeoJSON 后渲染。
- 背景：手写版本出现 SVG 与 Three 地球叠加、路线乱飘、国家轮廓不真实等视觉问题，不符合正规软件官网质感。
- 理由：`react-globe.gl` 原生支持 country polygons、arc links、points、rings 等图层，可以用真实国家边界和统一球面弧线，减少自研视觉 bug。
- 约束：官网地球只能保留单一 WebGL canvas；不得再叠加手绘 SVG 地球；构建后重启 dev server，避免 `.next` chunk 失效。

## 2026-05-26: 后台管理台独立于官网

- 决策：新增独立 `admin/` 管理台预览，对应未来 `admin.addwhatsapp.com`；不把后台页面、管理动作或审计能力放进 `website/`。
- 背景：项目已经明确公开官网、后台和 API 需要分域或分服务，避免公开下载站点混入管理能力；用户要求后台管理和现有商业化模块一一对应。
- 理由：先把 8 个云端模块和 5 个桌面端商业化页面的对应关系固化，可以让后续 `server/` API、数据库和桌面端接入按同一张图推进。
- 约束：`admin/` 当前只允许放本地预览数据和管理台界面；不得放生产密钥、数据库 URL、客户原始表格、完整号码名单、WhatsApp 登录缓存或桌面端内部状态。所有人工改套餐、补额度、释放租约、推荐审核和封禁操作都必须进入审计日志。

## 2026-05-26: 服务端先用无依赖本地预览 API 固化规则

- 决策：新增 `server/`，先用 Node 内置 `http` 和内存存储实现本地 API 骨架，同时用 `src/db/schema.sql` 固化 PostgreSQL 目标表。
- 背景：当前机器不应依赖临时下载安装后端框架或数据库才能继续推进；但云端账号、套餐权益、额度账本、订单、工作台租约和审计规则需要先有可测试实现。
- 理由：无依赖预览 API 能快速打通后台与桌面端未来要用的合同，测试先锁住资金和审计规则；后续接 PostgreSQL/Fastify/Prisma 或其他框架时，可以替换仓储和路由层而不重写业务规则。
- 约束：内存存储只用于本地预览，不可作为生产数据方案；生产化时必须接 PostgreSQL，并让扣费、用量更新和账本写入处于同一事务。

## 2026-05-26: 后台管理台采用每模块独立页面

- 决策：`admin/` 管理台不再把 8 个模块详情全部堆在运营首页，而是使用左侧导航和 hash 路由实现一个模块一个页面。
- 背景：用户反馈全部内容挤在一个页面中，真实后台操作会难以阅读和定位。
- 理由：首页只应该承担运营摘要和入口职责；用户、套餐、额度、用量、订单、推荐、工作台和审计都有不同的字段、动作和风控约束，拆页后更接近真实管理系统。
- 约束：首页不得重新渲染全部模块详情；每个模块页必须独立展示该模块的指标、管理动作、记录表和守则。

## 2026-05-29: 支付入账使用双层幂等

- 决策：支付成功入账同时使用支付事件幂等和额度账本幂等；`payment_events.provider_event_id` 防止同一渠道回调重复处理，`credit_ledger.idempotency_key = purchase:{orderId}` 防止同一订单重复入账。
- 背景：订单支付、人工收款和后续真实渠道回调都属于资金边界，支付渠道重复通知、服务重试和后台补偿都会重复触发同一业务动作。
- 理由：事件去重只能证明同一回调不重复处理，不能覆盖人工入账或补偿队列再次触发；账本幂等才能保证用户余额不会被同一订单重复增加。
- 约束：支付成功但入账未完成的订单进入 `paid_pending_credit`，只能由补偿队列重试同一个 `purchase:{orderId}`；退款和拒付后续必须写反向账本，不得删除原订单或直接改余额。

## 2026-05-29: 真实支付宝前先接 mock_alipay 签名适配层

- 决策：先实现 `mock_alipay` webhook 适配层，用服务器环境变量 `MOCK_ALIPAY_WEBHOOK_SECRET` 做 HMAC 验签，再把验签后的通知映射为统一支付事件；暂不把真实支付宝 RSA 细节写入业务入账逻辑。
- 背景：生产支付宝接入依赖商户应用、HTTPS 域名、真实密钥和支付产品选择，但当前资金账本底座已需要验证“回调必须验签后才能入账”的边界。
- 理由：mock 适配层可以先固定密钥只在 `server/`、前端不碰密钥、回调验签、重复通知幂等和订单入账共用合同；后续换成支付宝 RSA 验签时只替换 provider adapter。
- 约束：`mock_alipay` 仅用于本地/预览联调，不代表生产支付宝；生产接入必须改用支付宝官方签名验签、公网 HTTPS notify URL、密钥环境变量和支付事件运营监控；通用 `/v1/payments/events` 只能作为管理员鉴权的内部/人工入口，不能作为匿名公网 webhook。

## 2026-05-29: 支付宝真实通知入口只返回纯文本 success

- 决策：真实支付宝通知入口使用 `/v1/payments/alipay/notify`，只接受服务端环境变量中的 `ALIPAY_PUBLIC_KEY` 和 `ALIPAY_APP_ID`，RSA2 验签通过并进入统一幂等支付事件流程后返回纯文本 `success`。
- 背景：支付宝异步通知是服务器到服务器的 POST 通知；重复通知使用稳定 `notify_id`，验签需要排除 `sign` 和 `sign_type`，且处理成功后支付宝只识别纯 `success` 字符串。
- 理由：把支付宝验签和统一入账拆开，可以让真实渠道、mock 渠道和人工后台事件共享账本幂等，同时不让支付密钥进入桌面端、官网或后台前端。
- 约束：生产 `notify_url` 必须是公网 HTTPS 且不带 query 的 path；在拿到真实商户 `app_id`、应用私钥和支付宝公钥前，只能做本地 RSA2 适配测试，不能声明已接入生产支付宝。

## 2026-05-29: 支付宝下单签名只在 server 生成

- 决策：真实支付宝 page-pay 下单参数由 `server/` 的 `/v1/orders/:id/payments/alipay/page-pay` 生成，接口先用用户 token 校验订单归属，再从订单行派生 `out_trade_no`、`total_amount`、`subject` 和 `biz_content`，最后用 `ALIPAY_APP_PRIVATE_KEY` 做 RSA2 签名。
- 背景：支付宝下单签名需要商户应用私钥，且订单金额和订单号属于资金边界，不能让 Electron、官网或后台前端自行拼接。
- 理由：服务端派生签名参数可以避免客户端篡改金额/订单号，也让沙箱/生产网关、notify URL 和 return URL 都通过环境变量管理；支付成功后仍由 webhook 幂等入账，不依赖前端跳转结果。
- 约束：接口只返回签名后的公开请求参数和 `paymentUrl`，绝不返回私钥；已支付或关闭订单不能重新生成支付请求；真实上线前仍需要商户沙箱/生产凭据和公网 HTTPS 域名联调。

## 2026-05-29: 支付宝 page-pay 改用官方 SDK 生成

- 决策：`alipay.trade.page.pay` 下单请求改用官方 `alipay-sdk` 的 `AlipaySdk.pageExecute` 生成 `paymentUrl` 和 POST `paymentHtml`，不再维护手写网关签名拼接逻辑。
- 背景：沙箱联调中曾因手写签名规则、`sign_type` 是否参与签名、私钥 PKCS1/PKCS8 格式等细节产生排查噪声；支付宝官方文档和官方 SDK 已内置参数 snake_case、RSA2 签名、表单生成和 keyType 处理。
- 理由：资金接口应优先使用官方 SDK，减少自研签名实现导致的误判；服务端仍然独占应用私钥，客户端只拿到官方 SDK 生成的公开支付参数或自动提交表单。
- 约束：官方 SDK 不替代业务侧幂等、订单归属校验、金额派生和回调验签；沙箱异常时以 `alipay.trade.query` 和支付宝客服 traceId 为准，不通过继续改签名参数绕过。

## 2026-05-29: 支付维护期间先锁套餐能力边界

- 决策：支付宝沙箱官方异常未恢复前，桌面端不开放线上支付和自动入账入口；套餐页、额度页、账单页和任务入口只展示并执行套餐能力边界，升级/充值先走人工开通或后台调账。
- 背景：支付宝客服已确认沙箱环境异常且没有明确恢复时间，继续围绕支付参数试错会把资金边界和产品权限边界搅在一起。
- 理由：把套餐功能锁定从支付链路中拆出来，可以先明确免费版、进阶版、专业版、商业版分别能用什么、不能用什么；后续支付恢复时只接订单和入账，不需要重做桌面端能力判断。
- 约束：线上支付能力统一标记为维护中；免费版锁导出预检、新建工作台和代理 IP 设置；付费套餐任务启动仍必须同时满足账户余额和今日剩余额度；自定义文案模板按套餐上限保存，默认模板不计入自定义模板数。

## 2026-06-01: 桌面端支付宝入口只拉起服务端签名订单

- 决策：公网可用后，桌面端开放支付宝线上支付入口；Electron 只调用云端订单 API 和服务端 page-pay API，再用系统浏览器打开支付宝收银台，不在桌面端生成或保存任何支付宝签名密钥。
- 背景：`server/` 已有 `/v1/orders`、`/v1/orders/:id/payments/alipay/page-pay` 和 `/v1/payments/alipay/notify`，资金边界已经固定在服务端；桌面端之前仅因沙箱异常展示维护态。
- 理由：让桌面端负责“用户选择套餐并打开支付页”，让服务端负责“订单归属、金额派生、RSA2 签名、异步通知验签和幂等入账”，可以最小化密钥泄露和金额篡改风险。
- 约束：用户必须先登录账号才能付款；桌面端传入的 `planId` 只能用于选择套餐，最终金额和额度仍由服务端订单和套餐规则约束；支付成功后以支付宝异步通知入账为准，前端跳转或浏览器打开成功不能视为已支付。

## 2026-06-01: 桌面端账号统一为数据库账号

- 决策：用户可见账号体系从“本地账号 + 云端账号”双入口改为单一数据库账号；桌面端登录/注册直接调用 `/v1/auth/login` 和 `/v1/auth/register`，并用返回的云端 `user.id` 作为本机账号数据目录 ID。
- 背景：项目已上线官网和 API，支付宝订单、额度、套餐和支付回调都必须归属到数据库用户；继续让用户先登录本地账号再登录云端账号会造成产品理解和支付归属混乱。
- 理由：单一账号模型更符合付费软件直觉，也让支付宝订单、套餐权益、任务扣费、工作台租约和本机 WhatsApp 缓存都能挂到同一个用户身份下。
- 约束：本机仍保留账号级 WhatsApp 缓存、历史、模板和同步包目录，但它们只是数据库账号下的本机数据，不再作为独立“本地账号”产品概念暴露；旧 `AuthStore` 仅作为 legacy 测试/模块保留，主进程不再使用它做登录注册。

## 2026-06-02: 当前阶段支付先走人工收款码

- 决策：当前阶段默认购买路径从支付宝官方自动 page-pay 切换为人工收款码；桌面端只生成订单和付款备注，收款确认后由管理员在后台按账号或订单手动入账。
- 背景：支付宝/微信官方自动支付接入需要商户产品签约、备案、应用上线和密钥/回调配置；Stripe 等海外通道又依赖可用的国外主体。为了先让产品能收钱，用户决定先采用手动收款码。
- 理由：人工收款码可以绕开当前商户资质阻塞，最快形成“用户付款 -> 后台充值 -> 账号可用余额增加”的运营闭环；保留订单和账本模型可以让后续切回 Stripe、支付宝官方、微信 Native 或聚合支付时复用同一套入账边界。
- 约束：人工收款没有自动回调，不能宣称付款即自动到账；管理员必须核对付款备注、订单号或用户名后再充值；余额仍只能通过 `credit_ledger` 流水或订单 paid 入账，不能直接改数据库余额；收款码图片地址通过服务端环境变量配置，不进代码仓库。

## 2026-06-02: ZPAY 聚合支付作为当前自动入账路径

- 决策：在官方支付宝/微信产品签约门槛较高的情况下，先接入 ZPAY 兼容易支付接口作为自动支付路径；桌面端默认购买按钮生成云端订单并打开 ZPAY 收银台，人工收款码保留为备用。
- 背景：用户已在 ZPAY 后台拿到 PID，并通过微信支付渠道审核；ZPAY 后台提供兼容易支付网关、PID 和 KEY，能绕开当前官方直连产品的复杂审核链路。
- 理由：现有订单、支付事件、账本幂等和后台补偿队列已经能支撑自动回调入账；ZPAY 只需要在 provider adapter 中实现 MD5 签名、下单 URL 和通知验签，不需要改变资金账本模型。
- 约束：`ZPAY_KEY` 只能放在 `server/` 生产环境变量中；客户端只能拿服务端生成的 `paymentUrl`，不能传金额、订单号或 KEY；回调必须验签、校验 PID、按 `payment_events.provider_event_id` 和 `credit_ledger.purchase:{orderId}` 双层幂等处理。

## 2026-06-03: 官方微信 Native 支付作为当前默认自动入账路径

- 决策：用户完成微信商户号与已认证小程序 AppID 绑定后，默认购买路径从 ZPAY 切换为官方微信支付 Native 扫码；Electron 只请求服务端生成订单和 Native `code_url`，不保存或生成任何微信支付密钥。
- 背景：ZPAY 通道存在余额、费率、JSAPI 页面注册和第三方稳定性问题；用户已具备微信商户号、APIv3 key、商户 API 证书序列号、`apiclient_key.pem` 和公网 HTTPS notify URL，可以直连官方微信 Native。
- 理由：官方微信 Native 减少第三方手续费和通道限制；服务端统一负责订单归属、金额派生、商户私钥签名、APIv3 通知解密和幂等入账，客户端只显示二维码和链接兜底，继续复用现有订单/账本模型。
- 约束：`WECHAT_API_V3_KEY`、`WECHAT_MERCHANT_PRIVATE_KEY` 或 `WECHAT_MERCHANT_PRIVATE_KEY_PATH` 只能在 `server/` 生产环境变量中；微信 notify 必须走 `https://api.addwhatsapp.com/v1/payments/wechat/notify`；付款成功仍以微信异步通知和后台 payment-events 为准，前端显示二维码或用户扫码不能视为已支付。

## 2026-06-03: 微信支付服务端默认启用多区域官方网关 fallback

- 决策：微信 Native 下单默认不再只请求 `https://api.mch.weixin.qq.com`，而是按顺序尝试 `api.mch.weixin.qq.com`、`apihk.mch.weixin.qq.com`、`apius.mch.weixin.qq.com`、`apieu.mch.weixin.qq.com`；这些微信支付域名在 Node DNS lookup 层强制使用 IPv4。
- 背景：RackNerd 生产服务器到微信支付主域名连接超时，导致官方微信 Native 下单 `fetch failed`；但换用微信支付区域接入点后可生成 Native `code_url`。
- 理由：境外 VPS 到微信支付主域名的线路不稳定，多区域 fallback 比要求用户更换服务器更快、更可控，也保留官方微信支付直连能力。
- 约束：生产环境不要设置 `WECHAT_GATEWAY_URL`，除非明确要禁用 fallback 并指定单一网关；支付签名、订单金额、notify 解密和幂等入账仍全部只在 `server/` 执行。

## 2026-06-05: WhatsApp 登录恢复只在失效时清缓存

- 决策：发送任务默认复用当前账号的 WhatsApp LocalAuth session；只有检测到 `post_logout`、`LOGOUT`、`Execution context was destroyed`、`ProtocolError` 等明确失效信号时，才自动清理当前账号的 `whatsapp-session` 并重新打开扫码窗口。
- 背景：用户反馈会话过期时打开 WhatsApp Web 后停在西语 `No se encontró el contenido` 页面，二维码不出现；同时用户明确要求不要每次点击发送任务都清缓存重新扫码。
- 理由：有效 session 应该保持“一次扫码，多次使用”的体验；失效 session 则应由软件自动恢复，避免用户理解浏览器内部异常或 Puppeteer 报错。
- 约束：普通网络错误、代理错误或非失效启动失败不能清理 session；运行中任务不能清理缓存；任务页保留手动 `登录异常时重新扫码` 作为用户可见兜底。

## 2026-06-05: 官网下载包发布必须包含服务器部署

- 决策：以后“官网包已更新”只有在线上 `addwhatsapp.com` 校验通过后才能这么说；本地打包、复制到 `website/public/downloads`、更新 `update.json`、提交和推送 GitHub 只算 release source 已准备好。
- 背景：v0.1.3 本地已推送后，线上官网仍返回旧 `update.json` 和 0.1.3 EXE 404；服务器 `/opt/add-whatsapp` 的 `git pull --ff-only` 又因本地 `package-lock.json`、`website/package-lock.json` 改动被 Git 阻止。
- 理由：当前官网运行在生产 WhatsApp 机的 `/opt/add-whatsapp` 服务上，不是 GitHub 自动部署。只有服务器拉取新提交、构建 website、重启 `add-whatsapp-website.service` 并 reload Nginx 后，用户下载入口才会变成新包。
- 约束：发布步骤必须按顺序执行并记录：`git pull --ff-only`；如被 lockfile 阻挡，先 stash 服务器本地 lockfile；`npm ci`、`npm ci --prefix website`、`npm ci --prefix server`；`npm run build --prefix website`；`systemctl restart add-whatsapp-website.service`；必要时重启 API；`nginx -t`；`systemctl reload nginx`；最后用线上 `curl` 校验 `update.json` 版本/SHA256 和版本 EXE 的 200 状态。

## 2026-06-05: WhatsApp Web 自动化 profile 必须短路径、本地化并预授权持久化存储

- 决策：WhatsApp Web 自动化浏览器的 LocalAuth profile 不再放在 Roaming 的深层账号目录，也不再使用完整 `add-whatsapp-user_<uuid>` 作为 clientId；统一使用 `%LOCALAPPDATA%\\aw` 作为短 dataPath，并用账号 UUID 前 8 位作为稳定短 clientId。
- 背景：旧路径到 `Default` 已接近 190 字符，Chromium 继续写 `Service Worker\\CacheStorage\\<hash>\\<hash>` 后超过 Windows 260 字符限制，导致 `CacheStorage: Unexpected internal error`、`storage_initialization_error` 和 WhatsApp Web 粉色 database error，二维码无法生成。
- 理由：Chromium profile、IndexedDB、Service Worker 和 CacheStorage 属于本机运行缓存，放在 Local 比 Roaming 更合适；短路径比依赖系统 LongPathsEnabled 更稳定，也能降低杀毒/同步/文件锁干扰。
- 决策：程序先自行 launch Puppeteer，再通过 CDP `Browser.grantPermissions` 给 `https://web.whatsapp.com` 授权 `durableStorage` 和 `notifications`，随后用 `browser.wsEndpoint()` 让 `whatsapp-web.js` 连接该浏览器。
- 背景：全新的自动化 Chromium profile 互动分为 0，Chrome 会拒绝持久化存储，WhatsApp Web 无法建 IndexedDB；这会被页面包装成 browser database error，而不是直观提示权限不足。
- 约束：必须保留真实 Chrome UA、固定可用 webVersionCache、GitHub 主分支 `whatsapp-web.js`、`ignoreDefaultArgs: ['--enable-automation']` 和现有反自动化启动参数；不得回退到 `userAgent:false` 或让库自行拉取随机灰度 Web 版本。
- 约束：同一 `clientId` / session 目录任意时刻只允许一个浏览器实例；正常关闭必须先 `client.destroy()` 后 `browser.close()`。`taskkill /F` 只能用于优雅关闭超时兜底，且一旦强杀，下次启动前必须清理该 profile 的 IndexedDB、Local Storage、Session Storage、Service Worker 和 Cache。

## 2026-06-05: Windows EXE 随包携带固定 Chromium

- 决策：普通用户版 EXE 不再使用系统 Chrome 或 Edge 作为 WhatsApp 自动化浏览器；采用 Puppeteer 固定 Chrome for Testing 打包进 `resources\\chromium`，运行时只从随包资源解析 `chrome.exe`。
- 背景：另一台电脑运行 EXE 时出现 Edge 自动化窗口停在 `about:blank`，说明旧代码的 `chromeCandidates` 会在用户没装 Chrome 时降级到 Edge；这会引入用户环境差异、浏览器版本漂移和“没浏览器直接失败”的分发风险。
- 理由：当前 `whatsapp-web.js` 登录稳定性已经依赖固定 Web HTML、真实 UA、CDP `durableStorage` 授权、短 LocalAuth 路径和优雅关闭。继续让用户系统浏览器参与，会重新把不可控版本和默认浏览器环境带回链路。
- 约束：打包前必须执行 `npm run prepare:browser`；`electron-builder` 必须把 `build-resources\\chromium` 放进 `extraResources` 且不能塞进 asar 内运行；`.gitignore` 继续忽略浏览器二进制资源，发布以打包产物为准。
- 约束：代理逻辑仍通过 Chromium `--proxy-server=...` 启动参数传入；如果 WhatsApp 页面停留 `about:blank` 超时，用户提示应指向网络/代理检查，而不是要求安装 Chrome/Edge。
- 代价：本地 `0.1.3` 便携 EXE 从约 79 MB 增至约 200 MB；未压缩随包 Chromium 资源约 408 MB。此代价用于换取开箱即用和固定浏览器版本。

## 2026-06-05: 官网只提供 latest 包下载

- 决策：官网版本记录页只保留历史更新说明，不再提供旧版本 EXE 下载；所有下载按钮和 manifest 均指向 `/downloads/latest/Add-WhatsApp.exe`。
- 背景：旧版本可能包含已修复的 WhatsApp 登录、浏览器路径、支付或风控问题；如果用户从版本记录页下载旧包，会把已经解决的问题重新带回售后。
- 理由：对普通用户来说，官网应只提供当前稳定包；历史版本只用于说明发布记录和回溯变更，不作为可回退下载入口。
- 约束：发布新版本时必须替换 `website/public/downloads/latest/Add-WhatsApp.exe`，更新 `latest/update.json`、`website/lib/releases.js` 和版本页说明；`website/public/downloads/releases` 下不得保留 `.exe` 旧包。
