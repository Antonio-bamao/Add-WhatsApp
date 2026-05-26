# 当前状态

- 当前阶段：Phase 7，官网与下载落地页第一版。
- 主线状态：`C:\Users\m1591\Desktop\Add-WhatsApp` 正在新增独立 `website/` Next.js 官网应用；桌面端 `src/` 未参与本轮改动。
- 已完成：`website/` 独立 Next.js App Router 工程已创建；首页、下载页、版本页、公开静态 `/site.css`、站点导航/页脚、`react-globe.gl` 开源 WebGL 地球、`world-atlas` 本地国家边界和下载 manifest 已落地。
- 已完成：当前 Windows 便携版 `dist\Add WhatsApp 0.1.2.exe` 已复制到 `website\public\downloads\latest\Add-WhatsApp.exe` 和 `website\public\downloads\releases\0.1.2\Add-WhatsApp-0.1.2.exe`；`update.json` 已写入版本、文件名、下载路径、发布日期、大小和 SHA256。
- 已完成：新增 `docs/repository-structure.md` 记录当前单仓库分目录边界，明确官网不放 API 密钥、后台逻辑、客户数据或 WhatsApp session。
- 进行中：等待用户确认官网首屏视觉、下载页内容和后续生产部署方式。
- 验证：`website\npm test` 通过 5/5；`website\npm run build` 成功；根项目 `npm test` 通过 77/77；本地 `http://localhost:3100` 桌面/移动端 Chrome headless 截图已复查，样式不再退化为裸 HTML；浏览器插件调试确认首屏只剩 1 个 WebGL canvas、无旧 `.globe-static` SVG 叠加、无 Server Error；下载页返回 200，`/downloads/latest/Add-WhatsApp.exe` HEAD 长度为 `77060652`。
- 下一步：确认视觉方向后，可继续补正式品牌文案、隐私/条款页、SEO 图、真实部署配置和以后自动更新/签名方案。
- 阻塞项：生产域名、托管平台、证书/代码签名策略和长期下载包发布流程还未最终确定。
