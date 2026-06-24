"use client";

import dynamic from "next/dynamic";
import type { Guess, LatLng, Player, RoundSummary } from "@/types/game";

const LeafletMap = dynamic(() => import("@/components/LeafletMap").then((module) => module.LeafletMap), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center bg-slate-900 text-sm text-slate-300">Karte lädt...</div>
});

type GuessMapProps = {
  mode?: "guess" | "results";
  center?: LatLng;
  guess?: LatLng | null;
  guesses?: Guess[];
  players?: Player[];
  summary?: RoundSummary | null;
  disabled?: boolean;
  noPan?: boolean;
  noZoom?: boolean;
  showLabels?: boolean;
  currentPlayerColor?: string;
  resizeSignal?: number | string | boolean;
  resetSignal?: number | string | boolean;
  onGuess?: (point: LatLng) => void;
};

export function GuessMap(props: GuessMapProps) {
  const mode = props.mode ?? "guess";
  const mapKey = [
    mode,
    props.summary?.roundNumber ?? "live"
  ].join("-");

  return <LeafletMap key={mapKey} mode={mode} {...props} />;
}
