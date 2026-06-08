export const latestRelease = {
  version: "0.1.6",
  fileName: "Add-WhatsApp-Setup.exe",
  downloadUrl: "/downloads/latest/Add-WhatsApp-Setup.exe",
  releaseDate: "2026-06-08",
  sizeBytes: 228812557,
  sha256: "2769d401276553a952c42f35d02583fa2bcb4c2d05f6b0b9632c922f474fb0ae",
  highlights: [
    "后台新增全站免费和套餐计费模式切换",
    "修复免费/收费切换后的任务、模板和工作台边界",
    "修复 WhatsApp 登录页压缩、双窗口和 about:blank 诊断提示",
    "增强任务计费会话和离线补同步稳定性"
  ]
};

export const releaseHistory = [
  {
    version: latestRelease.version,
    fileName: latestRelease.fileName,
    releaseDate: latestRelease.releaseDate,
    sizeBytes: latestRelease.sizeBytes,
    sha256: latestRelease.sha256,
    highlights: latestRelease.highlights
  },
  {
    version: "0.1.5",
    fileName: "Add-WhatsApp-Setup.exe",
    releaseDate: "2026-06-06",
    sizeBytes: 228629436,
    sha256: "75c20a9c19e819b8a696c708673777f1e062e87e35be91d877c5aca2ffbef113",
    highlights: [
      "迁移为 Windows 当前用户安装版，安装无需管理员权限",
      "新增自动检查、空闲下载和下次启动安装",
      "多工作台会在更新前保存进度并协同退出",
      "更新异常时保留当前版本，并支持停发和撤销坏版本"
    ]
  },
  {
    version: "0.1.4",
    fileName: "Add-WhatsApp.exe",
    releaseDate: "2026-06-05",
    sizeBytes: 200439073,
    sha256: "af7cdd7774c5b91a170864ab90c86f1b10337f259deba1acf1cb20fa122809cb",
    highlights: [
      "Windows 便携版随包携带固定 Chromium 内核",
      "不再依赖用户电脑安装 Chrome 或 Edge",
      "修复部分电脑自动化浏览器停留在 about:blank 的问题",
      "保留 WhatsApp 登录短路径、持久化存储授权和优雅关闭修复"
    ]
  },
  {
    version: "0.1.3",
    fileName: "Add-WhatsApp-0.1.3.exe",
    releaseDate: "2026-06-05",
    sizeBytes: 78890507,
    sha256: "c26f77a52ad8893f2b17c0e7691d1b216aa37ffbfc703468f9dbe6c069d71413",
    highlights: [
      "Windows 便携版，可直接启动使用",
      "WhatsApp 登录失效后自动清理缓存并重新打开扫码窗口",
      "发送任务页新增登录异常时重新扫码按钮",
      "正式包主窗口禁用开发者工具"
    ]
  },
  {
    version: "0.1.2",
    fileName: "Add-WhatsApp-0.1.2.exe",
    releaseDate: "2026-06-03",
    sizeBytes: 78880538,
    sha256: "0d09e629b73034aa634fb4161aef0985b00262d093a21238adc0c34e9b271742",
    highlights: [
      "Windows 便携版，可直接启动使用",
      "本地 WhatsApp Web 登录与任务执行",
      "微信 Native 扫码支付接入"
    ]
  }
];

export function formatBytes(bytes) {
  const mb = bytes / 1024 / 1024;
  return `${mb.toFixed(1)} MB`;
}
