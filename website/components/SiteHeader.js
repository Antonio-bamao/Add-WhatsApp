import Link from "next/link";
import { ArrowDownToLine } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="Add WhatsApp 首页">
        <span className="brand-mark">AW</span>
        <span>Add WhatsApp</span>
      </Link>
      <nav className="nav-links" aria-label="主导航">
        <a href="/#features">功能</a>
        <a href="/#workflow">流程</a>
        <a href="/#security">安全</a>
        <Link href="/releases">版本</Link>
      </nav>
      <Link className="header-download" href="/download">
        <ArrowDownToLine size={17} />
        下载
      </Link>
    </header>
  );
}
