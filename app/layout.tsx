import type { Metadata } from "next";
import Script from "next/script";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { StructuredData } from "@/components/StructuredData";
import { adConfig } from "@/lib/ads";
import { analyticsEnabled } from "@/lib/analytics";
import { absoluteUrl, defaultDescription, ogImage, siteName, siteUrl } from "@/lib/seo";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${siteName} - kostenloses Geo-Guessing-Spiel auf Deutsch`,
    template: `%s | ${siteName}`
  },
  description: defaultDescription,
  applicationName: siteName,
  keywords: [
    "Punktlandung",
    "Geo-Guessing-Spiel",
    "GeoGuessr Alternative Deutsch",
    "Orte erraten",
    "Geografie-Spiel",
    "Geo-Quiz",
    "Partyspiel"
  ],
  alternates: {
    canonical: absoluteUrl("/")
  },
  openGraph: {
    type: "website",
    locale: "de_DE",
    url: absoluteUrl("/"),
    siteName,
    title: `${siteName} - kostenloses Geo-Guessing-Spiel auf Deutsch`,
    description: defaultDescription,
    images: [
      {
        url: ogImage,
        width: 1200,
        height: 630,
        alt: "Punktlandung Geo-Quiz mit Karte und Pin"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteName} - kostenloses Geo-Guessing-Spiel auf Deutsch`,
    description: defaultDescription,
    images: [ogImage]
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1
    }
  },
  icons: {
    icon: [{ url: "/icon.png", type: "image/png" }],
    shortcut: [{ url: "/icon.png", type: "image/png" }],
    apple: [{ url: "/icon.png", type: "image/png" }]
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://commons.wikimedia.org" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://upload.wikimedia.org" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://commons.wikimedia.org" />
        <link rel="dns-prefetch" href="https://upload.wikimedia.org" />
        {analyticsEnabled && (
          <script
            dangerouslySetInnerHTML={{
              __html:
                "window.dataLayer=window.dataLayer||[];window.gtag=window.gtag||function(){window.dataLayer.push(arguments);};" +
                "window.gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',wait_for_update:1000,region:['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IS','IE','IT','LV','LI','LT','LU','MT','NL','NO','PL','PT','RO','SK','SI','ES','SE','GB','CH']});" +
                "window.gtag('consent','default',{ad_storage:'granted',ad_user_data:'granted',ad_personalization:'granted',analytics_storage:'granted'});"
            }}
          />
        )}
      </head>
      <body className="bg-slate-950 text-slate-50 antialiased">
        <script src="/ambient-phase.js" />
        {adConfig.enabled && adConfig.clientId && (
          <Script
            id="punktlandung-adsense"
            strategy="afterInteractive"
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(adConfig.clientId)}`}
            crossOrigin="anonymous"
          />
        )}
        <GoogleAnalytics />
        <StructuredData />
        {children}
      </body>
    </html>
  );
}
