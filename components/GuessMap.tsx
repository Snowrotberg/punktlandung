"use client";

import dynamic from "next/dynamic";
import type { Guess, LatLng, Player, RoundSummary } from "@/types/game";

const LeafletMap = dynamic(() => import("@/components/LeafletMap").then((module) => module.LeafletMap), {
  ssr: false,
  loading: () => <div className="h-full bg-slate-900" aria-hidden="true" />
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
  resultPaddingScale?: number;
  resultZoomScale?: number;
  resultLabelLayout?: "auto" | "home-preview" | "account-history";
  resultLabelInset?: boolean;
  resultControlInset?: boolean;
  animateResultConnector?: boolean;
  currentPlayerColor?: string;
  resizeSignal?: number | string | boolean;
  resetSignal?: number | string | boolean;
  onGuess?: (point: LatLng) => void;
  onBaseMapReady?: () => void;
};

export function GuessMap(props: GuessMapProps) {
  const mode = props.mode ?? "guess";
  const mapKey = [
    mode,
    props.summary?.roundNumber ?? "live"
  ].join("-");

  return <LeafletMap key={mapKey} mode={mode} {...props} />;
}
