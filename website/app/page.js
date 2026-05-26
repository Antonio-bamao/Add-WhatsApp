import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  DatabaseZap,
  Download,
  FileSpreadsheet,
  Globe2,
  LockKeyhole,
  MessageSquareText,
  ShieldCheck,
  TimerReset
} from "lucide-react";
import { SiteHeader } from "../components/SiteHeader";
import { SiteFooter } from "../components/SiteFooter";
import GlobeScene from "../components/GlobeScene";
import { formatBytes, latestRelease } from "../lib/releases";

const features = [
  {
    icon: FileSpreadsheet,
    title: "批量导入客户号码",
    text: "支持表格导入、号码预检和任务队列，让销售团队不用再手动整理零散联系人。"
  },
  {
    icon: MessageSquareText,
    title: "模板化跟进",
    text: "把常用开场白、邀约话术和跟进节奏做成模板，减少重复输入。"
  },
  {
    icon: TimerReset,
    title: "限额与间隔控制",
    text: "按每日上限、随机间隔和任务状态运行，适合长时间稳定跟进。"
  },
  {
    icon: DatabaseZap,
    title: "权益与推荐奖励",
    text: "云端权益、邀请码和奖励额度已经接入 MVP，为后续商业化留好入口。"
  }
];

const workflow = [
  "导入 CSV/XLSX 客户号码",
  "预检格式、国家和可发送状态",
  "选择模板和发送节奏",
  "扫码登录 WhatsApp Web",
  "运行任务并导出明细"
];

export default function HomePage() {
  return (
    <>
      <main className="site-shell">
        <SiteHeader />

        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">WhatsApp 客户跟进自动化软件</p>
            <h1>Add WhatsApp</h1>
            <p className="hero-lede">
              为外贸、销售和增长团队打造的 Windows 桌面工具：批量导入客户、模板化跟进、控制发送节奏，并把下载和版本更新放到正规官网统一交付。
            </p>
            <div className="hero-actions">
              <Link className="primary-action" href="/download">
                <Download size={20} />
                官方下载
              </Link>
              <a className="secondary-action" href="#features">
                查看功能
                <ArrowRight size={18} />
              </a>
            </div>
            <div className="release-strip" aria-label="当前下载版本">
              <span>当前版本 {latestRelease.version}</span>
              <span>{formatBytes(latestRelease.sizeBytes)}</span>
              <span>SHA256 已发布</span>
            </div>
          </div>

          <div className="hero-visual" aria-label="全球客户触达网络">
            <GlobeScene />
          </div>
        </section>

        <section className="signal-band" aria-label="产品能力概览">
          <div>
            <strong>本地执行</strong>
            <span>WhatsApp 会话和任务运行在桌面端</span>
          </div>
          <div>
            <strong>云端权益</strong>
            <span>账号、套餐、额度和推荐奖励可扩展</span>
          </div>
          <div>
            <strong>官网交付</strong>
            <span>下载、版本和更新入口统一维护</span>
          </div>
        </section>

        <section className="section" id="features">
          <div className="section-heading">
            <p className="eyebrow">Core capability</p>
            <h2>把 WhatsApp 跟进流程做成可控的软件工作台</h2>
            <p>不是简单脚本，而是面向真实交付的软件：导入、预检、发送、统计和版本更新都有清晰入口。</p>
          </div>
          <div className="feature-grid">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <article className="feature-card" key={feature.title}>
                  <div className="feature-icon">
                    <Icon size={22} />
                  </div>
                  <h3>{feature.title}</h3>
                  <p>{feature.text}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="section workflow-section" id="workflow">
          <div className="section-heading compact">
            <p className="eyebrow">Workflow</p>
            <h2>从客户表格到持续跟进</h2>
          </div>
          <div className="workflow-line">
            {workflow.map((item, index) => (
              <div className="workflow-step" key={item}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <p>{item}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="section split-section" id="security">
          <div>
            <p className="eyebrow">Trust boundary</p>
            <h2>官网只负责展示和下载，核心数据不放在官网</h2>
            <p>
              官网不会保存 WhatsApp 会话、客户表格、后台密钥或数据库连接。桌面端、云端 API、管理后台分别部署，后续扩展更稳。
            </p>
          </div>
          <div className="assurance-grid">
            <div>
              <ShieldCheck size={22} />
              <span>官网与 API 隔离</span>
            </div>
            <div>
              <LockKeyhole size={22} />
              <span>不暴露后台密钥</span>
            </div>
            <div>
              <Globe2 size={22} />
              <span>支持独立域名部署</span>
            </div>
            <div>
              <BadgeCheck size={22} />
              <span>下载元数据可校验</span>
            </div>
          </div>
        </section>

      </main>
      <SiteFooter />
    </>
  );
}
