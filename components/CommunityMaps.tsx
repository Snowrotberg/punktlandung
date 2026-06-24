"use client";

import { useEffect, useMemo, useState } from "react";
import { builtInLocations, defaultMapPacks } from "@/data/locations";
import type { CommunityMapPack, GeoLocation } from "@/types/game";
import { Button } from "./Button";

function isLocation(value: unknown): value is GeoLocation {
  const item = value as GeoLocation;
  return (
    Boolean(item) &&
    typeof item.id === "string" &&
    typeof item.title === "string" &&
    typeof item.lat === "number" &&
    typeof item.lng === "number" &&
    typeof item.countryCode === "string" &&
    typeof item.countryName === "string" &&
    typeof item.continent === "string" &&
    typeof item.panoramaUrl === "string"
  );
}

export function CommunityMaps() {
  const [packs, setPacks] = useState<CommunityMapPack[]>(defaultMapPacks);
  const [message, setMessage] = useState("JSON-Datei mit Location-Liste hochladen.");

  useEffect(() => {
    const raw = window.localStorage.getItem("punktlandung-community-packs");
    if (raw) setPacks([...defaultMapPacks, ...JSON.parse(raw)]);
  }, []);

  const customPacks = useMemo(() => packs.filter((pack) => pack.id !== "world-party"), [packs]);

  const persist = (nextCustomPacks: CommunityMapPack[]) => {
    window.localStorage.setItem("punktlandung-community-packs", JSON.stringify(nextCustomPacks));
    setPacks([...defaultMapPacks, ...nextCustomPacks]);
  };

  const importFile = async (file: File | null) => {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Partial<CommunityMapPack> | GeoLocation[];
      const locations = Array.isArray(parsed) ? parsed : parsed.locations;
      if (!Array.isArray(locations) || locations.length === 0 || !locations.every(isLocation)) {
        setMessage("Import abgelehnt: Jede Location braucht id, title, lat, lng, countryCode, countryName, continent und panoramaUrl.");
        return;
      }
      const pack: CommunityMapPack = {
        id: Array.isArray(parsed) ? `ugc-${Date.now()}` : parsed.id ?? `ugc-${Date.now()}`,
        name: Array.isArray(parsed) ? file.name.replace(/\.json$/i, "") : parsed.name ?? file.name.replace(/\.json$/i, ""),
        author: Array.isArray(parsed) ? "Community" : parsed.author ?? "Community",
        description: Array.isArray(parsed) ? "Importierte Community-Karte" : parsed.description ?? "Importierte Community-Karte",
        rating: 3,
        locations: locations.map((location) => ({ ...location, source: "ugc" }))
      };
      persist([...customPacks.filter((existing) => existing.id !== pack.id), pack]);
      setMessage(`${pack.name} importiert: ${pack.locations.length} Orte.`);
    } catch {
      setMessage("Die Datei konnte nicht als JSON gelesen werden.");
    }
  };

  const rate = (packId: string, delta: number) => {
    const next = customPacks.map((pack) =>
      pack.id === packId ? { ...pack, rating: Math.max(1, Math.min(5, Number((pack.rating + delta).toFixed(1)))) } : pack
    );
    persist(next);
  };

  const exportExample = () => {
    const example: CommunityMapPack = {
      id: "meine-gratis-karte",
      name: "Meine Gratis-Karte",
      author: "Dein Name",
      description: "Koordinaten mit freien Panorama-URLs.",
      rating: 3,
      locations: builtInLocations.slice(0, 2).map((location) => ({ ...location, source: "ugc" }))
    };
    const blob = new Blob([JSON.stringify(example, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "punktlandung-map-example.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="arcade-panel rounded-md p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.28em] text-emerald-300">Open UGC</p>
          <h2 className="mt-2 text-2xl font-black">Community-Karten</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">{message}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <label className="heavy-button cursor-pointer rounded-md px-4 py-3 text-sm font-black uppercase tracking-wide">
            JSON hochladen
            <input type="file" accept="application/json" className="hidden" onChange={(event) => importFile(event.target.files?.[0] ?? null)} />
          </label>
          <Button tone="ghost" onClick={exportExample}>
            Beispiel exportieren
          </Button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {[...packs].sort((a, b) => b.rating - a.rating).map((pack) => (
          <div key={pack.id} className="rounded-md border-3 border-slate-700 bg-slate-950 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-black">{pack.name}</h3>
                <p className="mt-1 text-xs text-slate-400">
                  {pack.author} · {pack.locations.length} Orte
                </p>
              </div>
              <span className="rounded-md border-3 border-emerald-400 bg-emerald-400/10 px-2 py-1 text-xs font-black">{pack.rating.toFixed(1)}</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-300">{pack.description}</p>
            {pack.id !== "world-party" && (
              <div className="mt-4 flex gap-2">
                <Button className="px-3 py-2" tone="good" onClick={() => rate(pack.id, 0.2)}>
                  Hoch
                </Button>
                <Button className="px-3 py-2" tone="bad" onClick={() => rate(pack.id, -0.2)}>
                  Runter
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
