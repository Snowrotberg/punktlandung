import { faqItems } from "@/lib/seo";

type FaqCardsProps = {
  limit?: number;
  columns?: boolean;
  headingLevel?: "h2" | "h3";
};

export function FaqCards({ limit, columns = false, headingLevel = "h2" }: FaqCardsProps) {
  const items = typeof limit === "number" ? faqItems.slice(0, limit) : faqItems;
  const Heading = headingLevel;

  return (
    <div className={`grid gap-4 ${columns ? "md:grid-cols-2" : ""}`}>
      {items.map((item) => (
        <article key={item.question} className="rounded-md bg-slate-900/76 p-5 ring-1 ring-slate-700">
          <Heading className="text-[22px] font-black leading-tight text-white">{item.question}</Heading>
          <p className="mt-3 leading-7 text-slate-300">{item.answer}</p>
        </article>
      ))}
    </div>
  );
}

export function HomeSeoContent() {
  return (
    <div>
      <h2 className="text-3xl font-black leading-tight text-white">Kostenloses Geo-Guessing-Spiel auf Deutsch</h2>
      <p className="mt-4 text-base leading-7 text-slate-300">
        Punktlandung ist ein Geografie-Spiel, bei dem du Bilder, Flaggen, Staedte, Landschaften oder Wahrzeichen
        erkennst und den passenden Ort auf der Karte tippst. Je naeher dein Pin am Ziel liegt, desto mehr Punkte
        bekommst du.
      </p>
      <p className="mt-4 text-base leading-7 text-slate-300">
        Du kannst allein spielen oder Punktlandung als Partyspiel am selben Bildschirm nutzen. Damit ist es eine
        deutschsprachige GeoGuessr-Alternative fuer kurze Quizrunden, Spieleabende und Geografie-Fans.
      </p>

      <div className="mt-10">
        <h2 className="text-[22px] font-black leading-tight text-white">Häufige Fragen</h2>
        <div className="mt-4">
          <FaqCards limit={4} columns headingLevel="h3" />
        </div>
      </div>
    </div>
  );
}
