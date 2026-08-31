"use client";

import { useState } from "react";
import type { LatLng } from "@/types/game";
import { Button } from "./Button";
import { GuessMap } from "./GuessMap";

export function MapTestClient() {
  const [guess, setGuess] = useState<LatLng | null>(null);
  const [maximized, setMaximized] = useState(false);
  const [resetNonce, setResetNonce] = useState(0);

  const resetMap = () => {
    setGuess(null);
    setResetNonce((value) => value + 1);
  };

  return (
    <section
      className={`punktlandung-map-test-stage ${maximized ? "is-maximized" : ""}`}
      aria-label="Produktive Spielkarte testen"
    >
      <div className="punktlandung-map-test-actions">
        <Button
          tone="ghost"
          className="min-h-11 px-3 py-2 text-xs normal-case"
          aria-label={maximized ? "Testkarte minimieren" : "Testkarte maximieren"}
          onClick={() => setMaximized((value) => !value)}
        >
          {maximized ? "Minimieren" : "Maximieren"}
        </Button>
        <Button
          tone="ghost"
          className="min-h-11 px-3 py-2 text-xs normal-case"
          onClick={resetMap}
        >
          Karte zurücksetzen
        </Button>
      </div>
      <div className="punktlandung-map-test-map pin-cursor">
        <GuessMap
          guess={guess}
          onGuess={setGuess}
          resetSignal={resetNonce}
          resizeSignal={maximized ? "maximized" : "embedded"}
        />
      </div>
    </section>
  );
}
