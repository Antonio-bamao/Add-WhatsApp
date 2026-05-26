import Link from "next/link";
import { ArrowLeft, CheckCircle2, Download, FileArchive, ShieldCheck } from "lucide-react";
import { SiteHeader } from "../../components/SiteHeader";
import { SiteFooter } from "../../components/SiteFooter";
import { formatBytes, latestRelease } from "../../lib/releases";

export const metadata = {
  title: "官方下载 - Add WhatsApp",
  description: "下载 Add WhatsApp Windows 桌面软件最新版本。"
};

export default function DownloadPage() {
  return (
    <>
      <main className="site-shell">
        <SiteHeader />
        <section className="download-hero">
          <Link className="back-link" href="/">
            <ArrowLeft size={17} />
            返回首页
          </Link>
          <div className="download-layout">
            <div>
              <p className="eyebrow">Official download</p>
              <h1>下载 Add WhatsApp for Windows</h1>
              <p>
                当前提供 Windows 便携版。文件由官网直链托管，后续更新会保持 latest 地址不变，方便用户始终下载最新版本。
              </p>
              <a className="primary-action large" href={latestRelease.downloadUrl} download>
                <Download size={21} />
                下载 Windows 版
              </a>
            </div>
            <aside className="download-card">
              <div className="download-card-icon">
                <FileArchive size={28} />
              </div>
              <dl>
                <div>
                  <dt>版本</dt>
                  <dd>{latestRelease.version}</dd>
                </div>
                <div>
                  <dt>文件</dt>
                  <dd>{latestRelease.fileName}</dd>
                </div>
                <div>
                  <dt>大小</dt>
                  <dd>{formatBytes(latestRelease.sizeBytes)}</dd>
                </div>
                <div>
                  <dt>发布日期</dt>
                  <dd>{latestRelease.releaseDate}</dd>
                </div>
              </dl>
            </aside>
          </div>
        </section>

        <section className="section download-details">
          <article>
            <ShieldCheck size={24} />
            <h2>校验信息</h2>
            <p className="hash-line">{latestRelease.sha256}</p>
            <p>如需做发布校验，可用 Windows PowerShell 的 Get-FileHash 对下载文件进行 SHA256 校验。</p>
          </article>
          <article>
            <CheckCircle2 size={24} />
            <h2>安装说明</h2>
            <ol>
              <li>点击官方下载按钮保存 EXE 文件。</li>
              <li>双击启动 Add WhatsApp。</li>
              <li>按软件提示扫码登录 WhatsApp Web。</li>
              <li>导入表格，设置模板和发送节奏。</li>
            </ol>
          </article>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
