import type { Metadata } from "next";
import Link from "next/link";
import { FaqStructuredData } from "@/components/StructuredData";
import { absoluteUrl, faqItems } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Punktlandung FAQ - Fragen zum kostenlosen Geo-Quiz",
  description:
    "Antworten zu Punktlandung: kostenlos spielen, ohne Anmeldung starten, Kategorien waehlen und als Geo-Quiz oder Partyspiel nutzen.",
  alternates: {
    canonical: absoluteUrl("/faq")
  }
};

export default function FaqPage() {
  return (
    <>
      <FaqStructuredData />
      <main className="min-h-dvh bg-slate-950 px-4 py-12 text-slate-100 md:px-6 md:py-16">
        <section className="mx-auto max-w-4xl">
          <Link href="/" className="text-sm font-black uppercase tracking-[0.18em] text-emerald-300 hover:text-emerald-200">
            Punktlandung spielen
          </Link>
          <h1 className="mt-8 text-4xl font-black leading-tight text-white md:text-6xl">Haeufige Fragen zu Punktlandung</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
            Hier findest du kurze Antworten zum kostenlosen Geo-Quiz, zu Kategorien, Party-Modus und Einstieg ohne Anmeldung.
          </p>
        </section>

        <section className="mx-auto mt-10 grid max-w-4xl gap-4">
          {faqItems.map((item) => (
            <article key={item.question} className="rounded-md bg-slate-900/76 p-5 ring-1 ring-slate-700">
              <h2 className="text-[22px] font-black leading-tight text-white">{item.question}</h2>
              <p className="mt-3 leading-7 text-slate-300">{item.answer}</p>
            </article>
          ))}
        </section>
      </main>
    </>
  );
}
