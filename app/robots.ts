import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/"
      },
      {
        userAgent: "OAI-SearchBot",
        allow: "/"
      },
      {
        userAgent: "ChatGPT-User",
        allow: "/"
      },
      {
        userAgent: "PerplexityBot",
        allow: "/"
      },
      {
        userAgent: "Perplexity-User",
        allow: "/"
      },
      {
        userAgent: "Claude-SearchBot",
        allow: "/"
      },
      {
        userAgent: "Claude-User",
        allow: "/"
      },
      {
        userAgent: "GPTBot",
        disallow: "/"
      },
      {
        userAgent: "ClaudeBot",
        disallow: "/"
      },
      {
        userAgent: "Google-Extended",
        disallow: "/"
      }
    ],
    sitemap: absoluteUrl("/sitemap.xml")
  };
}
