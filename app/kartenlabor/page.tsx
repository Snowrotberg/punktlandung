import type { Metadata } from "next";
import Link from "next/link";
import { GlobeMapLab } from "@/components/GlobeMapLab";

export const metadata: Metadata = {
  title: "Globe-Kartenlabor",
  robots: { index: false, follow: false }
};

export default function KartenlaborPage() {
  return (
    <main className="min-h-dvh bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_35%),#020617] px-3 py-4 text-slate-50 sm:px-6 sm:py-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-[112rem] gap-4">
        <header className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-slate-700/80 bg-slate-950/82 px-4 py-4 shadow-2xl backdrop-blur sm:px-6">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-emerald-300">Interne Testansicht</p>
            <h1 className="mt-2 text-2xl font-black sm:text-3xl">Globe-Kartenlabor</h1>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">
              Testbench für eine adaptive Ergebnisanimation: ein durchgehender Referenzflug, drei Distanzklassen, Ergebnis-Pins und regional zugeschaltetes DEM-Terrain. Das Gameplay verwendet weiterhin unverändert die Mercator-Karte.
            </p>
          </div>
          <Link href="/" className="rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 text-sm font-black text-slate-100 transition hover:border-emerald-400 hover:text-emerald-200">
            Zurück zur Startseite
          </Link>
        </header>

        <GlobeMapLab />

        <aside className="grid gap-2 rounded-2xl border border-slate-800 bg-slate-950/72 px-4 py-4 text-xs leading-5 text-slate-400 sm:grid-cols-2 xl:grid-cols-4 sm:px-6">
          <p><strong className="text-slate-200">Distanzklassen:</strong> kurz unter 90 km, mittel bis 2.500 km, darüber Globe-Fernflug.</p>
          <p><strong className="text-slate-200">Kamera:</strong> startet am gesetzten Tipp und komponiert Tipp, Großkreislinie, Ziel und sichere Label-Abstände gemeinsam.</p>
          <p><strong className="text-slate-200">Terrain:</strong> Standard ist vorab geladenes Terrain „An“ mit 1,5× Überhöhung; Adaptiv, 1,0× und 2,0× bleiben zum Vergleich verfügbar.</p>
          <p><strong className="text-slate-200">Fallback:</strong> Reduced Motion nutzt nur eine kurze Ziel-Ease; kompakte Geräte reduzieren Dauer und Terrain-Last.</p>
        </aside>
      </div>
    </main>
  );
}
