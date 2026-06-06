/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    const noCache = [
      { key: "Cache-Control", value: "no-store, max-age=0, must-revalidate" }
    ];
    return [
      {
        source: "/downloads/latest/update.json",
        headers: noCache
      },
      {
        source: "/downloads/updates/win/stable/latest.yml",
        headers: noCache
      },
      {
        source: "/downloads/latest/Add-WhatsApp-Setup.exe",
        headers: noCache
      },
      {
        source: "/downloads/updates/win/stable/:file(Add-WhatsApp-Setup-.*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" }
        ]
      }
    ];
  }
};

export default nextConfig;
