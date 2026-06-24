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
        userAgent: "GPTBot",
        allow: "/"
      }
    ],
    sitemap: absoluteUrl("/sitemap.xml")
  };
}
