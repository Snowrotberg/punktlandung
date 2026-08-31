import type { Metadata } from "next";
import { MapTestClient } from "@/components/MapTestClient";

export const metadata: Metadata = {
  title: "Karte testen",
  robots: { index: false, follow: false }
};

export default function KartePage() {
  return (
    <main className="punktlandung-map-test-page min-h-dvh bg-slate-950 px-3 py-4 text-slate-50 sm:px-5 sm:py-5">
      <div className="mx-auto grid w-full max-w-[100rem] gap-3">
        <header className="rounded-md border border-slate-700/80 bg-slate-950/82 px-4 py-3 shadow-xl">
          <h1 className="text-2xl font-black sm:text-3xl">Karte testen</h1>
          <p className="mt-1 text-sm text-slate-300">Produktive Spielkarte direkt ausprobieren, Pin setzen und Ansicht zurücksetzen.</p>
        </header>
        <MapTestClient />
      </div>
    </main>
  );
}
