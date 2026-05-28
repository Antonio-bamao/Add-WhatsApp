export const adminModules = [
  {
    key: "users",
    title: "用户与云端账号",
    owner: "Auth Module",
    desktopSurface: "云端登录、免费试用、本机资料档案绑定",
    primaryAction: "冻结账号或重置会话",
    metric: "1,286",
    metricLabel: "云账号",
    status: "待接 API",
    guards: ["密码只存哈希", "本地账号和云端账号分开命名", "封禁后桌面端停止新任务"]
  },
  {
    key: "plans",
    title: "套餐与订阅",
    owner: "Plan And Subscription Module",
    desktopSurface: "套餐页、工作台上限、模板数量和单价",
    primaryAction: "调整套餐或设置扩容",
    metric: "4",
    metricLabel: "套餐档位",
    status: "规则已定",
    guards: ["不写无限工作台", "降级不清余额", "任务运行中以下次权益刷新为准"]
  },
  {
    key: "credits",
    title: "额度账本",
    owner: "Credit Ledger Module",
    desktopSurface: "额度页余额、充值包和扣费说明",
    primaryAction: "写入人工调整账本",
    metric: "86,420",
    metricLabel: "预览余额",
    status: "待接账本",
    guards: ["不能直接改余额", "正负变动都写流水", "幂等键防重复扣费"]
  },
  {
    key: "usage",
    title: "用量限额",
    owner: "Usage Quota Module",
    desktopSurface: "用量页今日、本月和重置时间",
    primaryAction: "查看用量快照",
    metric: "57%",
    metricLabel: "今日上限占用",
    status: "待接统计",
    guards: ["Asia/Shanghai 业务日", "每日上限不等于余额", "本机时间不作为权威"]
  },
  {
    key: "orders",
    title: "订单与入账",
    owner: "Payment And Orders Module",
    desktopSurface: "账单页订单、金额、额度和状态",
    primaryAction: "人工标记已支付",
    metric: "12",
    metricLabel: "待处理订单",
    status: "人工收款优先",
    guards: ["支付回调幂等", "paid_pending_credit 可补偿", "退款写负向账本"]
  },
  {
    key: "referrals",
    title: "推荐审核",
    owner: "Referral Module",
    desktopSurface: "推荐奖励页邀请码、邀请记录和奖励状态",
    primaryAction: "审核奖励或拦截自邀请",
    metric: "9",
    metricLabel: "待审核推荐",
    status: "后置阶段",
    guards: ["首次有效充值后奖励", "同设备同 IP 待审核", "奖励只发一次"]
  },
  {
    key: "workspaces",
    title: "设备与工作台",
    owner: "Device And Workspace License Module",
    desktopSurface: "主工作台、第二工作台和代理风控",
    primaryAction: "释放异常租约",
    metric: "34",
    metricLabel: "在线租约",
    status: "待接租约",
    guards: ["租约 30-60 秒续租", "崩溃后自动过期", "离线不能新开付费工作台"]
  },
  {
    key: "audit",
    title: "审计日志",
    owner: "Admin And Audit Module",
    desktopSurface: "所有后台敏感操作的追溯记录",
    primaryAction: "追踪最近调整",
    metric: "100%",
    metricLabel: "敏感动作留痕",
    status: "必须先做",
    guards: ["记录管理员和 IP", "记录操作前后摘要", "误操作用反向账本修正"]
  }
];

const modulePageConfig = {
  users: {
    route: "#/users",
    pageTitle: "用户与云端账号",
    pageDescription: "管理云端登录主体、账号状态、会话和设备入口；本机资料档案仍留在桌面端。",
    sections: [
      { title: "账号状态", body: "筛选 active、frozen、deleted，封禁后桌面端下一次请求必须停止新的任务启动。" },
      { title: "登录与会话", body: "查看 refresh session、设备名和最后活跃时间，支持重置会话。" },
      { title: "本地边界", body: "本地账号只作为本机资料档案，云端账号才是付费主体。" }
    ],
    records: [
      ["plus-user", "active", "PLUS", "2 台设备"],
      ["audit-user", "active", "ULTRA", "1 台设备"],
      ["risk-review", "frozen", "FREE", "0 台设备"]
    ]
  },
  plans: {
    route: "#/plans",
    pageTitle: "套餐与订阅",
    pageDescription: "维护 FREE、PLUS、PRO、ULTRA 的每日上限、工作台数量、模板数量和单价。",
    sections: [
      { title: "套餐目录", body: "套餐规则对齐桌面端价格页；商业版默认 5 个工作台，可申请扩容。" },
      { title: "订阅变更", body: "升级立即生效，降级不清余额；运行中的任务以下次权益刷新为准。" },
      { title: "扩容审核", body: "高价值客户扩容必须记录审计，不在页面写无限工作台。" }
    ],
    records: [
      ["FREE", "10 / 天", "1 工作台", "0 元"],
      ["PLUS", "200 / 天", "2 工作台", "0.3 元"],
      ["PRO", "500 / 天", "3 工作台", "0.2 元"],
      ["ULTRA", "1000 / 天", "5 工作台", "0.1 元"]
    ]
  },
  credits: {
    route: "#/credits",
    pageTitle: "额度账本",
    pageDescription: "所有余额变化只通过 credit_ledger 流水产生，人工调整也不能直接改余额。",
    sections: [
      { title: "余额推导", body: "当前余额由 purchase、consume、referral_reward、refund_reversal、admin_adjustment 累加得到。" },
      { title: "人工调账", body: "补额度或扣回都写 admin_adjustment，并记录管理员、对象、前后摘要和 IP。" },
      { title: "幂等扣费", body: "成功添加事件使用 idempotency_key，重复上报只能扣一次。" }
    ],
    records: [
      ["purchase", "+2000", "paid order", "balance 2000"],
      ["consume", "-1", "task contact hash", "balance 1999"],
      ["admin_adjustment", "+500", "manual transfer", "balance 2499"]
    ]
  },
  usage: {
    route: "#/usage",
    pageTitle: "用量限额",
    pageDescription: "按服务器 Asia/Shanghai 业务日统计每日和每月用量，不相信用户电脑时间。",
    sections: [
      { title: "今日额度", body: "available_today = min(balance_credits, daily_limit - used_today)。" },
      { title: "月度统计", body: "本月成功扣费次数来自 usage_monthly，失败、未注册和无效号码不计入。" },
      { title: "跨天任务", body: "跨过 00:00 后下一次服务器请求自动进入新的 business_date。" }
    ],
    records: [
      ["2026-05-26", "PLUS", "57", "143 remaining"],
      ["2026-05-25", "PLUS", "200", "limit reached"],
      ["2026-05", "PLUS", "918", "monthly used"]
    ]
  },
  orders: {
    route: "#/orders",
    pageTitle: "订单与入账",
    pageDescription: "先支持人工收款，管理员标记订单已支付后统一写 purchase 账本。",
    sections: [
      { title: "订单创建", body: "额度页购买按钮后续创建订单，订单包含套餐、额度、金额和状态。" },
      { title: "人工入账", body: "标记 paid 后写 purchase 账本；重复标记不重复入账。" },
      { title: "异常处理", body: "paid_pending_credit 进入补偿队列，退款和拒付写负向账本。" }
    ],
    records: [
      ["ADWA-000001", "created", "2000 credits", "待确认收款"],
      ["ADWA-000002", "paid", "5000 credits", "已入账"],
      ["ADWA-000003", "paid_pending_credit", "2000 credits", "待补偿"]
    ],
    paymentEvents: [
      ["mock_alipay", "payment_succeeded", "mock_alipay:notify-001:TRADE_SUCCESS", "order_preview_001", "processed"],
      ["manual", "payment_succeeded", "evt-manual-001", "order_preview_002", "processed"],
      ["mock_alipay", "payment_ignored", "mock_alipay:notify-002:WAIT_BUYER_PAY", "order_preview_003", "pending"]
    ]
  },
  referrals: {
    route: "#/referrals",
    pageTitle: "推荐审核",
    pageDescription: "推荐码、邀请记录和奖励状态来自云端，不在桌面端本地生成权威奖励。",
    sections: [
      { title: "邀请记录", body: "记录被邀请账号、注册时间、首充状态和奖励状态。" },
      { title: "奖励条件", body: "被邀请人首次有效充值后发放奖励，奖励只发一次。" },
      { title: "反作弊", body: "同设备、同 IP、同支付账户等自邀请进入 held_for_review。" }
    ],
    records: [
      ["RF-218", "held_for_review", "同设备", "暂不发放"],
      ["RF-219", "registered", "未充值", "等待首充"],
      ["RF-220", "rewarded", "首充完成", "+300"]
    ]
  },
  workspaces: {
    route: "#/workspaces",
    pageTitle: "设备与工作台",
    pageDescription: "工作台数量从本地内存限制升级为云端租约，崩溃后过期自动释放。",
    sections: [
      { title: "租约申请", body: "主工作台和子工作台启动时向云端申请 workspace_lease。" },
      { title: "续租释放", body: "租约每 30-60 秒续租；退出主动释放，崩溃后自动过期。" },
      { title: "套餐限制", body: "超过套餐工作台上限返回 WORKSPACE_LIMIT_REACHED。" }
    ],
    records: [
      ["lease_34F8", "secondary", "active", "expires in 44s"],
      ["lease_92AC", "primary", "active", "expires in 51s"],
      ["lease_771B", "secondary", "expired", "auto released"]
    ]
  },
  audit: {
    route: "#/audit",
    pageTitle: "审计日志",
    pageDescription: "后台所有敏感动作必须可追溯，余额误操作只能通过反向账本修正。",
    sections: [
      { title: "敏感动作", body: "改套餐、补额度、冻结账号、释放租约、推荐审核都要写审计。" },
      { title: "日志字段", body: "至少记录管理员、操作对象、操作前后摘要、时间和 IP。" },
      { title: "追溯窗口", body: "后台保留最近调整记录，方便排查售后和误操作。" }
    ],
    records: [
      ["plan.update", "PLUS daily_limit", "180 -> 200", "admin-preview"],
      ["credit.adjustment", "user_1024", "8620 -> 10620", "admin-preview"],
      ["workspace.release", "lease_34F8", "active -> released", "admin-preview"]
    ]
  }
};

for (const module of adminModules) {
  Object.assign(module, modulePageConfig[module.key]);
}

export const desktopAdminMappings = [
  {
    desktopPage: "套餐页",
    adminModule: "套餐与订阅",
    sourceOfTruth: "plans + subscriptions",
    adminChecks: ["套餐档位是否启用", "工作台和每日上限是否和桌面端展示一致", "商业版扩容是否有审计"]
  },
  {
    desktopPage: "用量页",
    adminModule: "用量限额",
    sourceOfTruth: "usage_daily + usage_monthly",
    adminChecks: ["今日已用和剩余额度是否按服务器业务日计算", "月用量是否来自扣费成功记录"]
  },
  {
    desktopPage: "额度页",
    adminModule: "额度账本",
    sourceOfTruth: "credit_ledger",
    adminChecks: ["余额是否由流水推导", "人工补额度是否写 admin_adjustment", "扣费失败是否能查到 pending"]
  },
  {
    desktopPage: "账单页",
    adminModule: "订单与入账",
    sourceOfTruth: "orders + payment_events",
    adminChecks: ["人工收款是否可入账", "paid_pending_credit 是否有补偿入口", "退款是否生成负向账本"]
  },
  {
    desktopPage: "推荐奖励页",
    adminModule: "推荐审核",
    sourceOfTruth: "referral_codes + referral_records",
    adminChecks: ["推荐码是否绑定云账号", "自邀请是否进入 held_for_review", "奖励是否只发一次"]
  }
];

export const actionQueue = [
  {
    label: "人工入账",
    target: "订单 ADWA-20260526-1027",
    detail: "等待确认收款后写 purchase 账本",
    severity: "warn"
  },
  {
    label: "释放租约",
    target: "workspace lease 34F8",
    detail: "子工作台进程已断开，等待过期或人工释放",
    severity: "info"
  },
  {
    label: "推荐审核",
    target: "referral record RF-218",
    detail: "同设备注册，暂不自动发放奖励",
    severity: "danger"
  }
];

export const auditTrail = [
  {
    at: "2026-05-26 21:44",
    actor: "admin-preview",
    action: "plan.update",
    target: "PLUS daily_limit",
    before: "180",
    after: "200"
  },
  {
    at: "2026-05-26 21:31",
    actor: "admin-preview",
    action: "credit.adjustment",
    target: "user_1024",
    before: "8620",
    after: "10620"
  },
  {
    at: "2026-05-26 20:58",
    actor: "admin-preview",
    action: "workspace.release",
    target: "lease_34F8",
    before: "active",
    after: "released"
  }
];

export function getModuleByKey(key) {
  return adminModules.find((module) => module.key === key);
}
