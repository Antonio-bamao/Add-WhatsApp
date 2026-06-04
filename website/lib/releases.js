export const latestRelease = {
  version: "0.1.3",
  fileName: "Add-WhatsApp-0.1.3.exe",
  downloadUrl: "/downloads/releases/0.1.3/Add-WhatsApp-0.1.3.exe",
  releaseDate: "2026-06-05",
  sizeBytes: 78888154,
  sha256: "7d0e94f39189adc8fba7776827d20bdd560e9ed65fe6764ce663522526c17a34",
  highlights: [
    "Windows 便携版，可直接启动使用",
    "WhatsApp 登录失效后自动清理缓存并重新打开扫码窗口",
    "正式包主窗口禁用开发者工具"
  ]
};

export const releaseHistory = [
  {
    ...latestRelease,
    downloadUrl: "/downloads/releases/0.1.3/Add-WhatsApp-0.1.3.exe"
  },
  {
    version: "0.1.2",
    fileName: "Add-WhatsApp-0.1.2.exe",
    downloadUrl: "/downloads/releases/0.1.2/Add-WhatsApp-0.1.2.exe",
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
