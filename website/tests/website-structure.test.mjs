import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const websiteRoot = path.resolve(__dirname, "..");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(websiteRoot, relativePath), "utf8"));
}

function readText(relativePath) {
  return fs.readFileSync(path.join(websiteRoot, relativePath), "utf8");
}

function listFiles(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(fullPath) : [fullPath];
  });
}

describe("public website structure", () => {
  it("is an isolated Next.js app with the required scripts and dependencies", () => {
    const packageJson = readJson("package.json");

    assert.equal(packageJson.private, true);
    assert.equal(packageJson.scripts.dev, "next dev");
    assert.equal(packageJson.scripts.build, "next build");
    assert.equal(packageJson.scripts.start, "next start");

    for (const dependency of [
      "next",
      "react",
      "react-dom",
      "three",
      "lucide-react",
      "react-globe.gl",
      "topojson-client",
      "d3-geo",
      "world-atlas"
    ]) {
      assert.ok(packageJson.dependencies[dependency], `missing dependency: ${dependency}`);
    }
  });

  it("defines the Chinese homepage, download page, and release metadata route", () => {
    const layout = readText("app/layout.js");
    const homePage = readText("app/page.js");
    const landingExperience = readText("components/LandingExperience.js");
    const bizFinderPage = readText("app/bizfinder/page.js");
    const bizFinderExperience = readText("components/BizFinderPage.js");
    const downloadPage = readText("app/download/page.js");
    const releasesPage = readText("app/releases/page.js");
    const releasesData = readText("lib/releases.js");

    assert.match(layout, /href="\/site\.css"/);
    assert.match(layout, /\/favicon\.ico/);
    assert.match(layout, /\/icon\.png/);
    assert.match(homePage, /LandingExperience/);
    assert.match(landingExperience, /Add WhatsApp/);
    assert.match(landingExperience, /src="\/logo\.png"/);
    assert.match(landingExperience, /href="\/bizfinder"/);
    assert.match(landingExperience, /官方下载/);
    assert.match(landingExperience, /全球/);
    assert.doesNotMatch(landingExperience, /上线前最常见的问题|FAQ/);
    assert.match(bizFinderPage, /BizFinderPage/);
    assert.match(bizFinderPage, /metadata/);
    assert.match(bizFinderExperience, /从地图上，\s*.*找到下一批海外客户/s);
    assert.match(bizFinderExperience, /立即下载/);
    assert.match(bizFinderExperience, /bizfinder-logo-transparent\.png/);
    assert.match(bizFinderExperience, /真实软件界面/);
    assert.match(downloadPage, /Windows/);
    assert.match(downloadPage, /latestRelease\.downloadUrl/);
    assert.match(releasesPage, /releaseHistory/);
    assert.match(releasesPage, /latestRelease\.downloadUrl/);
    assert.match(releasesPage, /dynamic = "force-dynamic"/);
    assert.match(releasesPage, /revalidate = 0/);
    assert.equal((releasesPage.match(/下载最新版/g) || []).length, 1);
    assert.doesNotMatch(releasesPage, /release\.downloadUrl/);
    assert.doesNotMatch(releasesPage, /下载此版本/);
    assert.doesNotMatch(releasesData, /downloadUrl:\s*latestRelease\.downloadUrl/);
  });

  it("uses an open-source React globe with local country topology", () => {
    const homePage = readText("app/page.js");
    const landingExperience = readText("components/LandingExperience.js");
    const globe = readText("components/GlobeScene.js");

    assert.match(globe, /"use client"/);
    assert.match(globe, /react-globe\.gl/);
    assert.match(globe, /world-atlas\/countries-110m\.json/);
    assert.match(globe, /topojson-client/);
    assert.match(globe, /polygonsData/);
    assert.match(globe, /arcsData/);
    assert.match(globe, /pointsData/);
    assert.match(globe, /StaticGlobeFallback/);
    assert.match(globe, /className="globe-static"/);
    assert.match(globe, /drawStaticGlobe/);
    assert.match(globe, /cameraForVisibleStory/);
    assert.match(globe, /cameraForProgress/);
    assert.match(globe, /Spain \/ 西班牙/);
    assert.match(globe, /USA \/ 美国/);
    assert.match(globe, /China \/ 中国/);
    assert.doesNotMatch(globe, /Live route intelligence|Country polygons/);
    assert.match(homePage, /LandingExperience/);
    assert.match(landingExperience, /import GlobeScene/);
    assert.doesNotMatch(globe, /unpkg\.com\/globe/i);
  });

  it("keeps website code isolated from desktop internals and server secrets", () => {
    const sourceFiles = listFiles(path.join(websiteRoot, "app"))
      .concat(listFiles(path.join(websiteRoot, "components")))
      .concat(listFiles(path.join(websiteRoot, "lib")))
      .filter((file) => /\.(js|jsx|mjs|css|json)$/.test(file));

    assert.ok(sourceFiles.length > 0, "expected website source files");

    const combinedSource = sourceFiles.map((file) => fs.readFileSync(file, "utf8")).join("\n");
    assert.doesNotMatch(combinedSource, /from ["']\.\.\/(?:server|src)|DATABASE_URL|ADMIN_KEY|SERVICE_ROLE/i);
  });

  it("publishes the latest download manifest and referenced Windows binaries", () => {
    const updateJson = readJson("public/downloads/latest/update.json");
    const releasesData = readText("lib/releases.js");

    assert.equal(updateJson.schemaVersion, 1);
    assert.equal(updateJson.enabled, true);
    assert.equal(updateJson.version, "0.1.7");
    assert.equal(updateJson.mandatoryOnNextLaunch, true);
    assert.deepEqual(updateJson.revokedVersions, []);
    assert.equal(updateJson.fileName, "Add-WhatsApp-Setup.exe");
    assert.equal(updateJson.downloadUrl, "/downloads/latest/Add-WhatsApp-Setup.exe");
    assert.equal(updateJson.updateFeedUrl, "/downloads/updates/win/stable/");
    assert.match(updateJson.releaseDate, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(updateJson.sha256, /^[a-f0-9]{64}$/);
    assert.match(updateJson.sha512, /^[A-Za-z0-9+/]+={0,2}$/);

    const latestInstaller = path.join(websiteRoot, "public/downloads/latest/Add-WhatsApp-Setup.exe");
    const stableDir = path.join(websiteRoot, "public/downloads/updates/win/stable");
    assert.ok(fs.existsSync(latestInstaller));
    assert.equal(updateJson.sizeBytes, fs.statSync(latestInstaller).size);
    assert.ok(fs.existsSync(path.join(stableDir, "Add-WhatsApp-Setup-0.1.7.exe")));
    assert.ok(fs.existsSync(path.join(stableDir, "Add-WhatsApp-Setup-0.1.7.exe.blockmap")));
    assert.match(releasesData, /version:\s*"0\.1\.7"/);
    assert.match(releasesData, new RegExp(`sizeBytes:\\s*${updateJson.sizeBytes}`));
    assert.match(releasesData, new RegExp(`sha256:\\s*"${updateJson.sha256}"`));
    assert.ok(fs.existsSync(path.join(stableDir, "latest.yml")));
    assert.ok(!fs.existsSync(path.join(websiteRoot, "public/downloads/latest/Add-WhatsApp.exe")));
    const releaseBinaries = listFiles(path.join(websiteRoot, "public/downloads/releases"))
      .filter((file) => file.endsWith(".exe"));
    assert.deepEqual(releaseBinaries, []);
    assert.ok(fs.existsSync(path.join(websiteRoot, "public/site.css")));
    assert.ok(fs.existsSync(path.join(websiteRoot, "public/logo.png")));
    assert.ok(fs.existsSync(path.join(websiteRoot, "public/icon.png")));
    assert.ok(fs.existsSync(path.join(websiteRoot, "public/favicon.ico")));
    assert.ok(fs.existsSync(path.join(websiteRoot, "app/icon.png")));
    assert.ok(fs.existsSync(path.join(websiteRoot, "app/favicon.ico")));
  });

  it("does not publish placeholder support contact details", () => {
    const sourceFiles = listFiles(websiteRoot).filter((file) =>
      /\.(js|jsx|mjs|css|html|md|json)$/.test(file)
    );
    const combinedSource = sourceFiles.map((file) => fs.readFileSync(file, "utf8")).join("\n");

    assert.doesNotMatch(combinedSource, /support@addwhatsapp\.com/);
  });
});
