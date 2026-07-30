import { absoluteUrl, defaultDescription, faqItems, ogImage, siteName } from "@/lib/seo";

const graph = [
  {
    "@type": "Organization",
    "@id": `${absoluteUrl("/")}#organization`,
    name: siteName,
    url: absoluteUrl("/"),
    logo: absoluteUrl("/icon.png"),
    sameAs: ["https://www.youtube.com/@punktlandungapp"]
  },
  {
    "@type": "WebSite",
    "@id": `${absoluteUrl("/")}#website`,
    url: absoluteUrl("/"),
    name: siteName,
    inLanguage: "de-DE",
    description: defaultDescription,
    publisher: {
      "@id": `${absoluteUrl("/")}#organization`
    }
  },
  {
    "@type": "VideoGame",
    "@id": `${absoluteUrl("/")}#game`,
    name: siteName,
    url: absoluteUrl("/"),
    image: absoluteUrl(ogImage),
    description: defaultDescription,
    applicationCategory: "GameApplication",
    gamePlatform: "Web browser",
    genre: ["Geo-Guessing", "Geografie-Quiz", "Partyspiel"],
    playMode: ["SinglePlayer", "MultiPlayer"],
    numberOfPlayers: {
      "@type": "QuantitativeValue",
      minValue: 1,
      maxValue: 10
    },
    isAccessibleForFree: true,
    operatingSystem: "Web browser",
    browserRequirements: "JavaScript enabled",
    inLanguage: "de-DE",
    publisher: {
      "@id": `${absoluteUrl("/")}#organization`
    },
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "EUR",
      availability: "https://schema.org/InStock"
    }
  }
];

const faqGraph = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "@id": `${absoluteUrl("/faq")}#faq`,
  mainEntity: faqItems.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer
    }
  }))
};

type JsonLdProps = {
  data: Record<string, unknown>;
};

export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data)
      }}
    />
  );
}

export function StructuredData() {
  return <JsonLd data={{ "@context": "https://schema.org", "@graph": graph }} />;
}

export function FaqStructuredData() {
  return <JsonLd data={faqGraph} />;
}
