import Link from "next/link";
import {
  ArrowRight,
  Check,
  ChevronRight,
  Database,
  Download,
  FileSpreadsheet,
  Filter,
  Globe2,
  History,
  LocateFixed,
  Map,
  MapPin,
  Navigation,
  Pause,
  Phone,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Store,
  Table2,
  Target,
  Waypoints
} from "lucide-react";

const featureCards = [
  {
    icon: Search,
    title: "按国家、城市和关键词精准搜索",
    text: "组合目标地区与行业关键词，把“西班牙巴塞罗那的足球用品店”变成一条清晰、可执行的获客任务。"
  },
  {
    icon: Phone,
    title: "自动整理关键联系信息",
    text: "集中采集商家名称、电话、地址、网站、坐标和来源链接，让销售不再逐条复制粘贴。"
  },
  {
    icon: Map,
    title: "地图与名单联动查看",
    text: "在地图上判断客户分布，在表格里查看详情、筛选名单，快速发现值得优先开发的区域。"
  },
  {
    icon: FileSpreadsheet,
    title: "一键导出销售可用名单",
    text: "支持按当前任务、筛选结果或全部记录导出 CSV / Excel，直接进入后续跟进流程。"
  }
];

const workflow = [
  {
    number: "01",
    title: "锁定市场",
    text: "选择国家与城市，明确这次要开发的区域。"
  },
  {
    number: "02",
    title: "输入关键词",
    text: "填写行业、产品或商家类型，设置目标数量。"
  },
  {
    number: "03",
    title: "自动采集",
    text: "BizFinder 持续整理地图商家与公开联系信息。"
  },
  {
    number: "04",
    title: "筛选导出",
    text: "去重、筛选并导出，交给销售开始开发。"
  }
];

const controlItems = [
  {
    icon: Pause,
    title: "暂停、继续与断点恢复",
    text: "临时中断无需重来，任务进度保留在本地，回来后可以继续推进。"
  },
  {
    icon: ShieldCheck,
    title: "验证码人工处理",
    text: "遇到验证码时主动暂停并提示处理，不承诺绕过验证，流程更可控。"
  },
  {
    icon: RefreshCcw,
    title: "随机间隔与失败重试",
    text: "通过节奏控制和重试机制，减少短时波动对长任务的影响。"
  },
  {
    icon: Database,
    title: "本地数据库保存",
    text: "搜索任务、客户结果和历史记录保留在当前电脑，方便随时复查和导出。"
  }
];

const outputFields = [
  "商家名称",
  "联系电话",
  "详细地址",
  "官方网站",
  "经纬度",
  "来源链接"
];

function ProductMockup() {
  return (
    <div className="bizfinder-product-window" aria-label="BizFinder 产品界面示意图">
      <div className="bizfinder-window-bar">
        <div className="bizfinder-window-brand">
          <img src="/bizfinder/icon-512.png" alt="" />
          <span>BizFinder 猎客</span>
        </div>
        <div className="bizfinder-window-controls" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
      <div className="bizfinder-app-shell">
        <aside className="bizfinder-app-sidebar">
          <div className="is-active">
            <Search size={17} />
            搜索
          </div>
          <div>
            <Target size={17} />
            任务
          </div>
          <div>
            <Table2 size={17} />
            结果
          </div>
          <div>
            <History size={17} />
            统计
          </div>
          <div>
            <ShieldCheck size={17} />
            设置
          </div>
        </aside>
        <div className="bizfinder-app-main">
          <div className="bizfinder-app-heading">
            <div>
              <small>搜索采集</small>
              <strong>地图商家获客任务</strong>
            </div>
            <span>
              <span className="bizfinder-live-dot" />
              本地运行
            </span>
          </div>
          <div className="bizfinder-search-panel">
            <label>
              国家 / 地区
              <span>西班牙</span>
            </label>
            <label>
              城市
              <span>Barcelona</span>
            </label>
            <label className="is-wide">
              关键词
              <span>camisetas de fútbol</span>
            </label>
            <button type="button">
              <Search size={16} />
              开始采集
            </button>
          </div>
          <div className="bizfinder-dashboard-grid">
            <div className="bizfinder-map-panel">
              <div className="bizfinder-map-grid" aria-hidden="true" />
              <span className="bizfinder-road road-one" />
              <span className="bizfinder-road road-two" />
              <span className="bizfinder-road road-three" />
              <div className="bizfinder-pin pin-one">
                <MapPin size={19} fill="currentColor" />
              </div>
              <div className="bizfinder-pin pin-two">
                <MapPin size={19} fill="currentColor" />
              </div>
              <div className="bizfinder-pin pin-three">
                <MapPin size={19} fill="currentColor" />
              </div>
              <div className="bizfinder-map-caption">
                <LocateFixed size={15} />
                Barcelona · 68 家目标商家
              </div>
            </div>
            <div className="bizfinder-lead-panel">
              <div className="bizfinder-lead-header">
                <span>实时结果</span>
                <strong>68</strong>
              </div>
              {[
                ["Fútbol Mania BCN", "+34 932 15 08 72"],
                ["Gol Store Barcelona", "+34 934 87 21 60"],
                ["Retro Football Shop", "+34 931 18 44 92"]
              ].map(([name, phone], index) => (
                <div className="bizfinder-lead-row" key={name}>
                  <span>{index + 1}</span>
                  <div>
                    <strong>{name}</strong>
                    <small>{phone}</small>
                  </div>
                  <ChevronRight size={15} />
                </div>
              ))}
              <div className="bizfinder-progress">
                <span>
                  <i />
                </span>
                <small>正在采集第 69 条结果</small>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BizFinderPage() {
  return (
    <main className="bizfinder-page">
      <header className="bizfinder-header">
        <Link className="bizfinder-brand" href="/bizfinder" aria-label="BizFinder 首页">
          <img src="/bizfinder/bizfinder-logo-transparent.png" alt="BizFinder" />
        </Link>
        <nav className="bizfinder-nav" aria-label="BizFinder 页面导航">
          <a href="#features">核心功能</a>
          <a href="#workflow">使用流程</a>
          <a href="#interface">软件界面</a>
          <Link href="/">Add WhatsApp</Link>
        </nav>
        <button className="bizfinder-header-download" type="button">
          <Download size={17} />
          立即下载
        </button>
      </header>

      <section className="bizfinder-hero">
        <div className="bizfinder-hero-glow" aria-hidden="true" />
        <div className="bizfinder-container bizfinder-hero-grid">
          <div className="bizfinder-hero-copy">
            <div className="bizfinder-kicker">
              <Sparkles size={15} />
              外贸销售团队的地图获客工具
            </div>
            <h1>
              从地图上，
              <span>找到下一批海外客户</span>
            </h1>
            <p>
              输入国家、城市和行业关键词，BizFinder 自动从谷歌地图整理目标商家的电话、网站、地址和位置，
              帮你把分散的公开信息变成可筛选、可导出的客户名单。
            </p>
            <div className="bizfinder-hero-actions">
              <button className="bizfinder-primary" type="button">
                <Download size={19} />
                立即下载
                <ArrowRight size={18} />
              </button>
              <a className="bizfinder-secondary" href="#workflow">
                看看如何获客
                <ChevronRight size={18} />
              </a>
            </div>
            <div className="bizfinder-proof-row">
              <span>
                <Check size={15} />
                本地保存
              </span>
              <span>
                <Check size={15} />
                地图与表格联动
              </span>
              <span>
                <Check size={15} />
                CSV / Excel 导出
              </span>
            </div>
          </div>
          <div className="bizfinder-hero-visual">
            <ProductMockup />
            <div className="bizfinder-floating-card bizfinder-floating-top">
              <span className="bizfinder-floating-icon">
                <Store size={19} />
              </span>
              <div>
                <small>已发现商家</small>
                <strong>1,286</strong>
              </div>
              <span className="bizfinder-trend">+18%</span>
            </div>
            <div className="bizfinder-floating-card bizfinder-floating-bottom">
              <span className="bizfinder-floating-icon is-orange">
                <FileSpreadsheet size={19} />
              </span>
              <div>
                <small>名单已整理</small>
                <strong>可导出 Excel</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bizfinder-section bizfinder-feature-section" id="features">
        <div className="bizfinder-container">
          <div className="bizfinder-section-heading">
            <span className="bizfinder-section-label">从搜索到名单</span>
            <h2>少做重复查找，多把时间花在真正的客户开发上</h2>
            <p>BizFinder 把地图搜索、信息整理、名单筛选和文件导出串成一条清晰的获客流程。</p>
          </div>
          <div className="bizfinder-feature-grid">
            {featureCards.map((feature) => {
              const Icon = feature.icon;
              return (
                <article className="bizfinder-feature-card" key={feature.title}>
                  <span>
                    <Icon size={23} />
                  </span>
                  <h3>{feature.title}</h3>
                  <p>{feature.text}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bizfinder-section bizfinder-workflow-section" id="workflow">
        <div className="bizfinder-container">
          <div className="bizfinder-workflow-layout">
            <div className="bizfinder-workflow-copy">
              <span className="bizfinder-section-label">四步建立客户池</span>
              <h2>把一个市场想法，变成一份能直接跟进的名单</h2>
              <p>
                无需先搭复杂系统。选定地区、输入关键词、启动采集，再把筛选后的结果交给销售团队。
              </p>
              <div className="bizfinder-workflow-meta">
                <Waypoints size={20} />
                <span>搜索任务全程可暂停、继续与恢复</span>
              </div>
            </div>
            <div className="bizfinder-workflow-list">
              {workflow.map((step, index) => (
                <article className="bizfinder-workflow-step" key={step.number}>
                  <span>{step.number}</span>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.text}</p>
                  </div>
                  {index < workflow.length - 1 ? <ArrowRight size={18} /> : <Check size={18} />}
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bizfinder-section bizfinder-results-section">
        <div className="bizfinder-container bizfinder-results-layout">
          <div className="bizfinder-results-board">
            <div className="bizfinder-results-toolbar">
              <div>
                <Filter size={17} />
                <span>Barcelona · 足球用品店</span>
              </div>
              <span>找到 68 条结果</span>
            </div>
            <div className="bizfinder-results-map">
              <div className="bizfinder-map-grid" aria-hidden="true" />
              <span className="bizfinder-road road-one" />
              <span className="bizfinder-road road-two" />
              <span className="bizfinder-road road-three" />
              {[1, 2, 3, 4, 5].map((pin) => (
                <MapPin className={`bizfinder-result-pin pin-${pin}`} fill="currentColor" key={pin} size={22} />
              ))}
            </div>
            <div className="bizfinder-results-table">
              <div className="is-head">
                <span>商家</span>
                <span>电话</span>
                <span>网站</span>
              </div>
              {[
                ["Fútbol Mania BCN", "+34 932 15 08 72", "footballmaniashop.com"],
                ["Gol Store Barcelona", "+34 934 87 21 60", "golstore.es"],
                ["Retro Football Shop", "+34 931 18 44 92", "retrofootball.es"]
              ].map((row) => (
                <div key={row[0]}>
                  <span>{row[0]}</span>
                  <span>{row[1]}</span>
                  <span>{row[2]}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bizfinder-results-copy">
            <span className="bizfinder-section-label">信息不是终点，名单才是</span>
            <h2>把地图上的商家，整理成销售真正用得上的客户数据</h2>
            <p>
              每条结果都有明确来源和位置。你可以按任务查看、筛选与去重，再选择最适合当前团队的导出范围。
            </p>
            <div className="bizfinder-field-grid">
              {outputFields.map((field) => (
                <span key={field}>
                  <Check size={14} />
                  {field}
                </span>
              ))}
            </div>
            <div className="bizfinder-export-line">
              <FileSpreadsheet size={21} />
              <div>
                <strong>CSV / Excel 灵活导出</strong>
                <span>当前任务、筛选结果或全部记录，由你决定。</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bizfinder-section bizfinder-interface-section" id="interface">
        <div className="bizfinder-container">
          <div className="bizfinder-section-heading is-centered">
            <span className="bizfinder-section-label">真实软件界面</span>
            <h2>从采集进度到名单质量，一眼看清</h2>
            <p>清晰的桌面工作台，把任务、结果、统计和设置放在同一套熟悉的操作逻辑里。</p>
          </div>
          <div className="bizfinder-real-window">
            <div className="bizfinder-real-window-bar">
              <span />
              <span />
              <span />
              <strong>BizFinder 数据统计</strong>
            </div>
            <img
              src="/bizfinder/bizfinder-app.png"
              alt="BizFinder 真实软件界面，展示任务数据统计和侧边导航"
            />
          </div>
        </div>
      </section>

      <section className="bizfinder-section bizfinder-control-section">
        <div className="bizfinder-container">
          <div className="bizfinder-section-heading">
            <span className="bizfinder-section-label">适合持续执行的长任务</span>
            <h2>不只采集得快，也要让整个过程稳得住</h2>
          </div>
          <div className="bizfinder-control-grid">
            {controlItems.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title}>
                  <Icon size={22} />
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bizfinder-cta">
        <div className="bizfinder-cta-orbit" aria-hidden="true">
          <Globe2 />
          <Navigation />
          <MapPin />
        </div>
        <div className="bizfinder-container bizfinder-cta-inner">
          <span>准备开始寻找新客户？</span>
          <h2>让下一份海外客户名单，从一张地图开始</h2>
          <p>用更清晰的搜索条件，找到更值得联系的目标商家。</p>
          <button className="bizfinder-primary is-light" type="button">
            <Download size={19} />
            立即下载
            <ArrowRight size={18} />
          </button>
        </div>
      </section>

      <footer className="bizfinder-footer">
        <div className="bizfinder-container">
          <Link href="/bizfinder">
            <img src="/bizfinder/bizfinder-logo-transparent.png" alt="BizFinder" />
          </Link>
          <p>面向外贸销售团队的谷歌地图客户开发软件。</p>
          <div>
            <Link href="/">Add WhatsApp</Link>
            <a href="#features">核心功能</a>
            <a href="#interface">软件界面</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
