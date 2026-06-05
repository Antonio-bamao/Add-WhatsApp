export const latestRelease = {
  version: "0.1.4",
  fileName: "Add-WhatsApp.exe",
  downloadUrl: "/downloads/latest/Add-WhatsApp.exe",
  releaseDate: "2026-06-05",
  sizeBytes: 200439073,
  sha256: "af7cdd7774c5b91a170864ab90c86f1b10337f259deba1acf1cb20fa122809cb",
  highlights: [
    "Windows 便携版随包携带固定 Chromium 内核",
    "不再依赖用户电脑安装 Chrome 或 Edge",
    "修复部分电脑自动化浏览器停留在 about:blank 的问题",
    "保留 WhatsApp 登录短路径、持久化存储授权和优雅关闭修复"
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
