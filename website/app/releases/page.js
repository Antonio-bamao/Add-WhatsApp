import Link from "next/link";
import { Download } from "lucide-react";
import { SiteHeader } from "../../components/SiteHeader";
import { SiteFooter } from "../../components/SiteFooter";
import { formatBytes, latestRelease, releaseHistory } from "../../lib/releases";

export const metadata = {
  title: "版本记录 - Add WhatsApp",
  description: "查看 Add WhatsApp 官网发布的 Windows 桌面软件版本记录。"
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ReleasesPage() {
  return (
    <>
      <main className="site-shell">
        <SiteHeader />
        <section className="section release-page">
          <div className="section-heading">
            <p className="eyebrow">Release notes</p>
            <h1>版本记录</h1>
            <p>这里保留官网发布过的更新说明；所有下载入口始终指向当前稳定版本。</p>
          </div>
          <div className="release-list">
            {releaseHistory.map((release) => (
              <article className="release-item" key={release.version}>
                <div>
                  <p className="release-version">v{release.version}</p>
                  <p>{release.releaseDate} · {formatBytes(release.sizeBytes)}</p>
                  <ul>
                    {release.highlights.map((highlight) => (
                      <li key={highlight}>{highlight}</li>
                    ))}
                  </ul>
                </div>
                {release.version === latestRelease.version ? (
                  <Link className="secondary-action" href={latestRelease.downloadUrl}>
                    <Download size={18} />
                    下载最新版
                  </Link>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
