const isStaticExport = process.env.PUNKTLANDUNG_STATIC_EXPORT === "true";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: isStaticExport ? "export" : undefined,
  trailingSlash: isStaticExport,
  images: {
    unoptimized: isStaticExport,
    remotePatterns: [
      { protocol: "https", hostname: "upload.wikimedia.org" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "commons.wikimedia.org" }
    ]
  }
};

export default nextConfig;
