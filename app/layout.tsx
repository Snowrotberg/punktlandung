import type { Metadata } from "next";
import { StructuredData } from "@/components/StructuredData";
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
    <html lang="de">
      <head>
        <link rel="preconnect" href="https://commons.wikimedia.org" crossOrigin="" />
        <link rel="preconnect" href="https://upload.wikimedia.org" crossOrigin="" />
      </head>
      <body className="bg-slate-950 text-slate-50 antialiased">
        <StructuredData />
        {children}
      </body>
    </html>
  );
}
