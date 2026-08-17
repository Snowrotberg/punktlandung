"use client";

import { Info, X } from "lucide-react";
import { useEffect, useState } from "react";

export function MapAttributionBadge({ locationInfoSourceUrl }: { locationInfoSourceUrl?: string }) {
  const [expanded, setExpanded] = useState(false);
  const [showIntroCredit, setShowIntroCredit] = useState(true);

  useEffect(() => {
    const timeout = window.setTimeout(() => setShowIntroCredit(false), 5000);
    return () => window.clearTimeout(timeout);
  }, []);

  return (
    <div
      className="punktlandung-map-attribution"
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {expanded ? (
        <div className="punktlandung-map-attribution-panel" role="dialog" aria-label="Kartenquellen">
          <div className="punktlandung-map-attribution-heading">
            <span>Kartenquellen</span>
            <button type="button" onClick={() => setExpanded(false)} aria-label="Kartenquellen schließen">
              <X aria-hidden="true" size={14} strokeWidth={2.5} />
            </button>
          </div>
          <span className="punktlandung-map-attribution-design">Kartendesign: Punktlandung</span>
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
            © OpenStreetMap-Mitwirkende
          </a>
          <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener noreferrer">
            © OpenMapTiles
          </a>
          <a href="https://openfreemap.org/" target="_blank" rel="noopener noreferrer">
            OpenFreeMap
          </a>
          {locationInfoSourceUrl && (
            <a href={locationInfoSourceUrl} target="_blank" rel="noopener noreferrer">
              Ortsinformation: Wikipedia
            </a>
          )}
        </div>
      ) : (
        <button
          type="button"
          className="punktlandung-map-attribution-trigger"
          onClick={() => setExpanded(true)}
          aria-label="Kartenquellen anzeigen"
          aria-expanded="false"
        >
          {showIntroCredit && <span>© OpenStreetMap</span>}
          <Info aria-hidden="true" size={15} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}
