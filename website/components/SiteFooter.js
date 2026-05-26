import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div>
        <p className="footer-brand">Add WhatsApp</p>
        <p>面向 WhatsApp 客户跟进、批量导入和团队增长的 Windows 桌面软件。</p>
      </div>
      <div className="footer-links">
        <Link href="/download">官方下载</Link>
        <Link href="/releases">版本记录</Link>
      </div>
    </footer>
  );
}
