export const latestRelease = {
  version: "0.1.2",
  fileName: "Add-WhatsApp.exe",
  downloadUrl: "/downloads/latest/Add-WhatsApp.exe",
  releaseDate: "2026-05-21",
  sizeBytes: 77060652,
  sha256: "c733f26ee257b5333ece4a9e9e3d16a4a39b511bb708b89190e54fb8ec2111f2",
  highlights: [
    "Windows 便携版，可直接启动使用",
    "本地 WhatsApp Web 登录与任务执行",
    "推荐码与云端权益读取 MVP 已接入"
  ]
};

export const releaseHistory = [
  {
    ...latestRelease,
    downloadUrl: "/downloads/releases/0.1.2/Add-WhatsApp-0.1.2.exe"
  }
];

export function formatBytes(bytes) {
  const mb = bytes / 1024 / 1024;
  return `${mb.toFixed(1)} MB`;
}
