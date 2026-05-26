export const metadata = {
  title: "Add WhatsApp - WhatsApp 客户跟进自动化软件",
  description: "Add WhatsApp 是面向外贸、销售和增长团队的 Windows 桌面软件，支持号码导入、模板跟进、工作台隔离和官方下载。",
  metadataBase: new URL("https://addwhatsapp.com")
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="stylesheet" href="/site.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
