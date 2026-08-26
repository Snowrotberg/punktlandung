import type { Metadata } from "next";
import localFont from "next/font/local";
import { AdSenseScript } from "@/components/AdSenseScript";
import { AdBlockRecoveryScript } from "@/components/AdBlockRecoveryScript";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { StructuredData } from "@/components/StructuredData";
import { UnifiedTooltipLayer } from "@/components/UnifiedTooltipLayer";
import { adConfig } from "@/lib/ads";
import { absoluteUrl, defaultDescription, ogImage, siteName, siteUrl } from "@/lib/seo";
import { mobileAppleWebApp, mobileViewport } from "@/lib/mobileMetadata";
import "./globals.css";

const inter = localFont({
  src: "../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
  variable: "--font-inter",
  weight: "100 900",
  style: "normal",
  display: "optional",
  preload: true,
  fallback: ["Segoe UI", "Arial", "sans-serif"],
  adjustFontFallback: "Arial"
});

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
  },
  appleWebApp: mobileAppleWebApp
};

export const viewport = mobileViewport;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" className={inter.variable} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://commons.wikimedia.org" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://upload.wikimedia.org" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://tiles.openfreemap.org" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://tiles.mapterhorn.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://commons.wikimedia.org" />
        <link rel="dns-prefetch" href="https://upload.wikimedia.org" />
        <link rel="dns-prefetch" href="https://tiles.openfreemap.org" />
        <link rel="dns-prefetch" href="https://tiles.mapterhorn.com" />
        <script
          dangerouslySetInnerHTML={{
            __html:
              "window.dataLayer=window.dataLayer||[];window.gtag=window.gtag||function(){window.dataLayer.push(arguments);};" +
              "window.gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',wait_for_update:1000,region:['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IS','IE','IT','LV','LI','LT','LU','MT','NL','NO','PL','PT','RO','SK','SI','ES','SE','GB','CH']});" +
              "window.gtag('consent','default',{ad_storage:'granted',ad_user_data:'granted',ad_personalization:'granted',analytics_storage:'granted'});" +
              "try{if(localStorage.getItem('punktlandung-ad-consent')==='denied'){window.gtag('consent','update',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied'});}}catch(e){}"
          }}
        />
      </head>
      <body className="bg-slate-950 text-slate-50 antialiased">
        <script src="/ambient-phase.js" />
        {adConfig.enabled && adConfig.clientId && <AdSenseScript clientId={adConfig.clientId} />}
        <AdBlockRecoveryScript
          enabled={process.env.NEXT_PUBLIC_ADBLOCK_RECOVERY_ENABLED === "true"}
          tagUrl={process.env.NEXT_PUBLIC_ADBLOCK_RECOVERY_TAG_URL ?? ""}
        />
        <GoogleAnalytics />
        <StructuredData />
        <UnifiedTooltipLayer />
        {children}
      </body>
    </html>
  );
}
