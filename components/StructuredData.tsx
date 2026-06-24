import { absoluteUrl, defaultDescription, faqItems, ogImage, siteName } from "@/lib/seo";

const graph = [
  {
    "@type": "WebSite",
    "@id": `${absoluteUrl("/")}#website`,
    url: absoluteUrl("/"),
    name: siteName,
    inLanguage: "de-DE",
    description: defaultDescription
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
    inLanguage: "de-DE",
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

export function StructuredData() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": graph
        })
      }}
    />
  );
}

export function FaqStructuredData() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(faqGraph)
      }}
    />
  );
}
