const fs = require('node:fs');
const path = require('node:path');

module.exports = async function afterPackIcon(context) {
  if (context.electronPlatformName !== 'win32') return;

  const projectDir = context.packager.projectDir;
  const iconPath = path.join(projectDir, 'assets', 'icon.ico');
  const productFilename = context.packager.appInfo.productFilename || context.packager.appInfo.productName;
  const exePath = path.join(context.appOutDir, `${productFilename}.exe`);

  for (const file of [iconPath, exePath]) {
    if (!fs.existsSync(file)) {
      throw new Error(`afterPack icon resource file missing: ${file}`);
    }
  }

  const { rcedit } = await import('rcedit');
  await rcedit(exePath, { icon: iconPath });
};
