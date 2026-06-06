# Windows 自动更新发布流程

## 首次迁移

- `0.1.5` 是首个 NSIS 安装版。`0.1.4` 便携版用户需要最后手动安装一次。
- 安装范围是当前用户，不要求管理员权限；产品名和 `appId` 保持不变，因此原有账号、历史、模板和 WhatsApp 数据目录继续复用。
- 当前构建未配置 Authenticode 证书。以后设置 `CSC_LINK` 和 `CSC_KEY_PASSWORD`，条件构建配置会自动启用 electron-builder 标准签名流程。

## 正式发布

1. 更新 `package.json` 版本，只允许发布更高版本，不做降级。
2. 运行 `npm test` 和 `npm run build`。
3. 运行 `npm run publish:update:artifacts`，只生成版本化安装包和 blockmap。
4. 部署网站，等待版本化文件可以从正式域名访问。
5. 运行 `npm run verify:update:host`。该命令会验证 `Content-Length`、Range 请求和线上完整 SHA-512。
6. 运行 `npm run publish:update:metadata`，再发布 `latest.yml`、`update.json` 和官网下载别名。
7. 再次部署网站，并检查元数据响应为 `Cache-Control: no-store`。

版本化工件使用长期不可变缓存；脚本只保留当前版本及前两个版本。

## 紧急停发

- 暂停全部更新：将 `website/public/downloads/latest/update.json` 的 `enabled` 设为 `false`。
- 撤销坏版本：将版本号加入 `revokedVersions`，并重新部署元数据。
- 修复后必须发布更高版本号，不覆盖旧版本，也不向用户执行降级。

## 预发布验证

正式发布前，将 `UPDATE_FEED_URL` 指向预发布静态站点并运行：

```powershell
$env:UPDATE_FEED_URL = "https://staging.example.com/downloads/updates/win/stable/"
npm run verify:update:host
```

至少在两台干净 Windows 虚拟机验证：首次安装、`0.1.5` 到更高版本升级、后台下载、下次启动安装、多工作台退出、断网恢复和旧数据保留。
