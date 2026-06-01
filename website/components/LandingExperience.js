"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  BadgeCheck,
  DatabaseZap,
  Download,
  FileSpreadsheet,
  Gauge,
  LockKeyhole,
  MessageSquareText,
  Radar,
  ShieldCheck,
  TimerReset
} from "lucide-react";
import GlobeScene from "./GlobeScene";
import { SiteFooter } from "./SiteFooter";

const storyPanels = [
  {
    kicker: "Batch import",
    title: "客户表格导入后，自动整理号码",
    text: "支持 CSV / XLSX 客户表格，自动识别电话列、国家列和语言线索，把不同格式的号码整理成可检测、可执行的 WhatsApp 任务队列。",
    stat: "CSV / XLSX + 国家列识别",
    align: "left"
  },
  {
    kicker: "Number preflight",
    title: "发送前先预检，跳过无效客户",
    text: "先解析国际区号和国家规则，再检测号码是否注册 WhatsApp；无效、重复、待确认和未注册号码不会混进正式跟进队列。",
    stat: "有效 / 重复 / 无效 / 未注册",
    align: "right"
  },
  {
    kicker: "Template rhythm",
    title: "模板话术和发送节奏都能控",
    text: "英语、西班牙语、法语模板可按国家和语言规则选择；每日上限、随机间隔、暂停继续和任务明细让跟进更像工作流，而不是手工乱点。",
    stat: "多语言模板 + 限额 + 随机间隔",
    align: "left"
  },
  {
    kicker: "Multi workspace",
    title: "多开工作台，代理 IP 独立配置",
    text: "主工作台走当前电脑网络，第二工作台可配置 SOCKS5 代理；软件会检测代理连通性和出口 IP，异常时请求暂停，避免任务继续乱跑。",
    stat: "第二工作台 + SOCKS5 + 出口 IP 巡检",
    align: "right"
  }
];

const capabilityCards = [
  {
    icon: FileSpreadsheet,
    title: "表格批量导入",
    text: "导入 CSV / XLSX，自动识别电话、国家和可选语言列。"
  },
  {
    icon: MessageSquareText,
    title: "多语言模板",
    text: "英语、西语、法语模板池可编辑，可按国家规则自动选择。"
  },
  {
    icon: TimerReset,
    title: "节奏控制",
    text: "每日上限、随机间隔、暂停继续，减少手工盯任务。"
  },
  {
    icon: DatabaseZap,
    title: "多开工作台",
    text: "支持第二工作台独立运行，适合分账号、分任务处理。"
  },
  {
    icon: Gauge,
    title: "代理 IP 配置",
    text: "第二工作台可配置 SOCKS5 代理，并检测出口 IP 是否变化。"
  },
  {
    icon: Radar,
    title: "号码预检",
    text: "无效、重复、待确认、未注册 WhatsApp 的号码先筛出来。"
  },
  {
    icon: ShieldCheck,
    title: "本地执行",
    text: "WhatsApp 登录缓存、客户表格和任务进度保留在桌面端。"
  },
  {
    icon: BadgeCheck,
    title: "报表导出",
    text: "任务结果可导出，方便复盘成功、失败和跳过原因。"
  }
];

const trustItems = [
  { icon: ShieldCheck, text: "客户表格和 WhatsApp 登录缓存默认留在本机" },
  { icon: LockKeyhole, text: "代理异常、出口 IP 变化时自动提示并暂停" },
  { icon: BadgeCheck, text: "失败、无效、未注册和暂停记录不按成功添加扣费" }
];

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return reduced;
}

function useStoryProgress(ref, reducedMotion) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (reducedMotion) {
      setProgress(0.28);
      return undefined;
    }

    let frame = 0;
    const update = () => {
      frame = 0;
      const element = ref.current;
      if (!element) return;

      const rect = element.getBoundingClientRect();
      const scrollRange = rect.height - window.innerHeight;
      const next = scrollRange <= 0 ? 0 : clamp(-rect.top / scrollRange, 0, 1);
      setProgress(next);
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [ref, reducedMotion]);

  return progress;
}

function Panel({ panel, index, progress }) {
  const start = index / storyPanels.length;
  const end = (index + 1) / storyPanels.length;
  const local = clamp((progress - start) / (end - start), 0, 1);
  const active = progress >= start - 0.07 && progress <= end + 0.07;

  return (
    <section
      className={`story-panel story-panel-${panel.align} ${active ? "is-active" : ""}`}
      data-story-index={index}
      style={{
        "--panel-progress": local,
        "--panel-index": index
      }}
      aria-label={panel.title}
    >
      <div className="story-copy">
        <p className="eyebrow">{panel.kicker}</p>
        <h2>{panel.title}</h2>
        <p>{panel.text}</p>
        <span className="story-stat">{panel.stat}</span>
      </div>
    </section>
  );
}

export default function LandingExperience() {
  const stageRef = useRef(null);
  const reducedMotion = useReducedMotion();
  const progress = useStoryProgress(stageRef, reducedMotion);
  const storyProgress = clamp((progress - 0.26) / 0.74, 0, 1);

  const activeIndex = useMemo(
    () => clamp(Math.floor(storyProgress * storyPanels.length), 0, storyPanels.length - 1),
    [storyProgress]
  );

  return (
    <>
      <main className="cinematic-page">
        <header className="cinematic-header" aria-label="网站导航">
          <Link className="cinematic-brand" href="/" aria-label="Add WhatsApp 首页">
            <span className="brand-mark" aria-hidden="true">
              <img src="/logo.png" alt="" />
            </span>
            <span>Add WhatsApp</span>
          </Link>
          <nav className="cinematic-nav" aria-label="主导航">
            <a href="#showcase">首页</a>
            <a href="#capabilities">功能</a>
            <a href="#trust">安全</a>
            <Link href="/releases">版本</Link>
          </nav>
          <Link className="cinematic-download" href="/download">
            <ArrowDownToLine size={18} />
            下载
          </Link>
        </header>

        <section
          ref={stageRef}
          id="showcase"
          className="cinematic-showcase"
          style={{
            "--story-progress": progress,
            "--active-index": activeIndex
          }}
        >
          <div className="cosmic-backdrop" aria-hidden="true">
            <span className="stellar-line stellar-line-a" />
            <span className="stellar-line stellar-line-b" />
            <span className="stellar-line stellar-line-c" />
            <span className="stellar-line stellar-line-d" />
          </div>

          <div className="sticky-stage">
            <div className="scene-copy-anchor">
              <p className="eyebrow">WhatsApp 客户跟进自动化软件</p>
              <h1>Add WhatsApp</h1>
              <p>
                导入客户表格，自动解析号码和国家，预检 WhatsApp 注册状态，再按模板、限额和随机间隔执行客户跟进。
              </p>
              <div className="hero-actions">
                <Link className="primary-action" href="/download">
                  <Download size={20} />
                  官方下载
                </Link>
                <a className="secondary-action" href="#capabilities">
                  查看能力
                  <ArrowRight size={18} />
                </a>
              </div>
            </div>

            <div className="scroll-globe-wrap" aria-label="可随滚动变化的全球客户触达地球">
              <GlobeScene progress={progress} cinematic />
              <div className="orbit-panel orbit-panel-top">
                <Radar size={17} />
                <span>号码预检</span>
              </div>
              <div className="orbit-panel orbit-panel-bottom">
                <Gauge size={17} />
                <span>代理 IP 巡检</span>
              </div>
              <div className="route-readout">
                <span>Workflow</span>
                <strong>导入 - 预检 - 模板跟进 - 多开</strong>
              </div>
            </div>

            <div className="scroll-progress" aria-hidden="true">
              <span style={{ transform: `scaleX(${Math.max(progress, 0.03)})` }} />
            </div>
          </div>

          <div className="story-panels">
            {storyPanels.map((panel, index) => (
              <Panel panel={panel} index={index} progress={storyProgress} key={panel.title} />
            ))}
          </div>
        </section>

        <section className="cinematic-section" id="capabilities">
          <div className="section-heading wide">
            <p className="eyebrow">Software features</p>
            <h2>外贸团队真正会用到的 WhatsApp 跟进功能</h2>
            <p>从客户表格到号码预检，从模板发送到多开工作台，Add WhatsApp 重点解决的是批量客户跟进的执行效率。</p>
          </div>
          <div className="cinematic-card-grid">
            {capabilityCards.map((feature) => {
              const Icon = feature.icon;
              return (
                <article className="cinematic-card" key={feature.title}>
                  <Icon size={24} />
                  <h3>{feature.title}</h3>
                  <p>{feature.text}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="cinematic-section trust-finale" id="trust">
          <div>
            <p className="eyebrow">Run with control</p>
            <h2>多账号、多任务运行时，先把风险和节奏控住</h2>
            <p>
              Add WhatsApp 的重点不是堆概念，而是让团队少复制号码、少发错对象、少盯着窗口。任务可暂停续跑，代理可检测，结果可复盘。
            </p>
          </div>
          <div className="trust-stack">
            {trustItems.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.text}>
                  <Icon size={22} />
                  <span>{item.text}</span>
                </div>
              );
            })}
            <Link className="primary-action large" href="/download">
              <Download size={20} />
              下载 Windows 版本
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
