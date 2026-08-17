"use client";

import { useLayoutEffect, useRef, type CSSProperties } from "react";
import { playerColorAt } from "@/lib/playerPalette";

const previewDistanceKm = 2;

function PreviewPin({ actual = false }: { actual?: boolean }) {
  const color = actual ? "#5ee7bd" : playerColorAt(0);
  return (
    <div
      className={`punktlandung-home-map-static-pin ${actual ? "is-actual" : "is-player"}`}
      style={{ "--pin-color": color } as CSSProperties}
      aria-hidden="true"
    >
      <svg viewBox="0 0 32 42">
        <path className="punktlandung-map-pin-outline" fillRule="evenodd" d="M16 42C16 42 3 24 3 15C3 6.7 8.8 1 16 1C23.2 1 29 6.7 29 15C29 24 16 42 16 42ZM16 9.75A5.25 5.25 0 1 0 16 20.25A5.25 5.25 0 1 0 16 9.75Z" />
        <path className="punktlandung-map-pin-fill" fillRule="evenodd" d="M16 38C16 38 5 23 5 15C5 8.4 9.9 4 16 4C22.1 4 27 8.4 27 15C27 23 16 38 16 38ZM16 8A7 7 0 1 0 16 22A7 7 0 1 0 16 8Z" />
        <circle className="punktlandung-map-pin-core" cx="16" cy="15" r="7.15" />
      </svg>
    </div>
  );
}

function PreviewEllipse({ actual = false }: { actual?: boolean }) {
  const color = actual ? "#5ee7bd" : playerColorAt(0);
  return (
    <svg
      className={`punktlandung-home-map-static-ellipse ${actual ? "is-actual" : "is-player"}`}
      viewBox="0 0 58 16"
      style={{ "--ellipse-color": color } as CSSProperties}
      aria-hidden="true"
    >
      <ellipse className="punktlandung-pin-ellipse-outer" cx="29" cy="8" rx="27.75" ry="6.75" />
      <ellipse className="punktlandung-pin-ellipse-middle" cx="29" cy="8" rx="18.87" ry="4.59" />
      <ellipse className="punktlandung-pin-ellipse-inner" cx="29" cy="8" rx="10.55" ry="2.57" />
    </svg>
  );
}

export function HomeMapPreview() {
  const previewRef = useRef<HTMLDivElement>(null);
  const connectorRef = useRef<SVGLineElement>(null);

  useLayoutEffect(() => {
    const preview = previewRef.current;
    const connector = connectorRef.current;
    if (!preview || !connector) return;

    const positionConnector = () => {
      const previewBox = preview.getBoundingClientRect();
      const player = preview.querySelector<SVGSVGElement>(".punktlandung-home-map-static-ellipse.is-player");
      const target = preview.querySelector<SVGSVGElement>(".punktlandung-home-map-static-ellipse.is-actual");
      if (!previewBox.width || !previewBox.height || !player || !target) return;

      const playerBox = player.getBoundingClientRect();
      const targetBox = target.getBoundingClientRect();
      const playerCenter = { x: playerBox.left - previewBox.left + playerBox.width / 2, y: playerBox.top - previewBox.top + playerBox.height / 2 };
      const targetCenter = { x: targetBox.left - previewBox.left + targetBox.width / 2, y: targetBox.top - previewBox.top + targetBox.height / 2 };
      const dx = targetCenter.x - playerCenter.x;
      const dy = targetCenter.y - playerCenter.y;
      const distance = Math.hypot(dx, dy);
      if (!distance) return;

      const ux = dx / distance;
      const uy = dy / distance;
      const ellipseRadius = (box: DOMRect) => {
        const rx = box.width * (27.75 / 58);
        const ry = box.height * (6.75 / 16);
        return 1 / Math.sqrt((ux * ux) / (rx * rx) + (uy * uy) / (ry * ry));
      };
      const dashGap = 9;
      const startInset = ellipseRadius(playerBox) + dashGap;
      const endInset = ellipseRadius(targetBox) + dashGap;

      connector.setAttribute("x1", String(playerCenter.x + ux * startInset));
      connector.setAttribute("y1", String(playerCenter.y + uy * startInset));
      connector.setAttribute("x2", String(targetCenter.x - ux * endInset));
      connector.setAttribute("y2", String(targetCenter.y - uy * endInset));
      connector.dataset.ready = "true";
    };

    positionConnector();
    const observer = new ResizeObserver(positionConnector);
    observer.observe(preview);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={previewRef}
      className="punktlandung-home-map-preview is-map-ready"
      data-render-mode="static-overlay"
      aria-label="Kartenvorschau: Dein Tipp liegt zwei Kilometer vom Brandenburger Tor entfernt."
    >
      <div className="punktlandung-home-map-base" aria-hidden="true" />
      <svg className="punktlandung-home-map-static-connector" aria-hidden="true">
        <line ref={connectorRef} className="punktlandung-result-connector is-flowing" />
      </svg>
      <PreviewEllipse actual />
      <PreviewEllipse />
      <PreviewPin actual />
      <PreviewPin />
      <span className="punktlandung-map-label punktlandung-map-label-player punktlandung-home-map-static-label is-player">
        #1 Dein Tipp<span className="punktlandung-map-label-distance"> · {previewDistanceKm} km</span>
      </span>
      <span className="punktlandung-map-label punktlandung-map-label-actual punktlandung-home-map-static-label is-actual">Brandenburger Tor</span>
    </div>
  );
}
