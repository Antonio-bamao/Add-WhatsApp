const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const puppeteer = require('puppeteer');

function browserSubdirectory(platform = process.platform) {
  if (platform === 'win32') return 'chrome-win64';
  if (platform === 'darwin') return 'chrome-mac-arm64';
  return 'chrome-linux64';
}

function ensurePuppeteerBrowser() {
  let executablePath = '';
  try {
    executablePath = puppeteer.executablePath();
  } catch {
    executablePath = '';
  }
  if (executablePath && fs.existsSync(executablePath)) return executablePath;

  if (executablePath) {
    const executableDir = path.dirname(executablePath);
    const browserCacheDir = path.dirname(executableDir);
    if (path.basename(executableDir) === browserSubdirectory() && fs.existsSync(browserCacheDir)) {
      fs.rmSync(browserCacheDir, {
        recursive: true,
        force: true,
        maxRetries: 10,
        retryDelay: 300
      });
    }
  }

  const cliPath = require.resolve('puppeteer/lib/cjs/puppeteer/node/cli.js');
  execFileSync(process.execPath, [cliPath, 'browsers', 'install', 'chrome'], {
    stdio: 'inherit',
    windowsHide: true
  });

  executablePath = puppeteer.executablePath();
  if (!executablePath || !fs.existsSync(executablePath)) {
    throw new Error(`Puppeteer Chromium executable was not found after install: ${executablePath || '(empty)'}`);
  }
  return executablePath;
}

function copyBrowserBundle() {
  const projectRoot = path.resolve(__dirname, '..');
  const executablePath = ensurePuppeteerBrowser();
  const sourceDir = path.dirname(executablePath);
  const targetDir = path.join(projectRoot, 'build-resources', 'chromium', browserSubdirectory());
  let version = '';
  try {
    version = execFileSync(executablePath, ['--version'], {
      encoding: 'utf8',
      timeout: 3000,
      windowsHide: true
    }).trim();
  } catch {
    version = 'unknown';
  }
  if (version === 'unknown') {
    const buildIdMatch = executablePath.match(/[\\/]win64-(\d+\.\d+\.\d+\.\d+)[\\/]/);
    if (buildIdMatch) version = `Chrome for Testing ${buildIdMatch[1]}`;
  }

  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(targetDir), { recursive: true });
  fs.cpSync(sourceDir, targetDir, { recursive: true });
  fs.writeFileSync(
    path.join(path.dirname(targetDir), 'browser.json'),
    JSON.stringify({
      executable: path.basename(executablePath),
      version,
      source: executablePath,
      bundledAt: new Date().toISOString()
    }, null, 2)
  );

  console.log(`Prepared bundled Chromium: ${targetDir}`);
}

copyBrowserBundle();
