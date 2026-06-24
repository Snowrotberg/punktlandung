import type { Metadata } from "next";
import Link from "next/link";
import { HomeSeoContent } from "@/components/SeoContent";
import { FaqStructuredData } from "@/components/StructuredData";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Punktlandung Infos - Geo-Quiz, FAQ und wichtige Seiten",
  description:
    "Informationen zu Punktlandung: kostenloses Geo-Guessing-Spiel, FAQ, Kategorien und wichtige Seiten zum deutschsprachigen Geo-Quiz.",
  alternates: {
    canonical: absoluteUrl("/infos")
  }
};

export default function InfosPage() {
  return (
    <main className="min-h-dvh bg-slate-950 text-slate-100">
      <FaqStructuredData />
      <div className="mx-auto max-w-5xl px-4 pt-8 md:px-6">
        <Link href="/" className="text-sm font-black uppercase tracking-[0.18em] text-emerald-300 hover:text-emerald-200">
          Zurueck zum Spiel
        </Link>
      </div>
      <HomeSeoContent />
    </main>
  );
}
