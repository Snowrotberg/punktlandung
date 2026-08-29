import { useId, type CSSProperties } from "react";
import styles from "./ResultMapPrimitives.module.css";

export type ResultMarkerKind = "guess" | "target";

const PIN_OUTLINE_PATH = "M16 42C16 42 3 24 3 15C3 6.7 8.8 1 16 1C23.2 1 29 6.7 29 15C29 24 16 42 16 42ZM16 9.75A5.25 5.25 0 1 0 16 20.25A5.25 5.25 0 1 0 16 9.75Z";
const PIN_FILL_PATH = "M16 38C16 38 5 23 5 15C5 8.4 9.9 4 16 4C22.1 4 27 8.4 27 15C27 23 16 38 16 38ZM16 8A7 7 0 1 0 16 22A7 7 0 1 0 16 8Z";

function markerGeometry(kind: ResultMarkerKind) {
  const width = kind === "target" ? 58 : 46;
  const height = kind === "target" ? 18 : 14;
  const radiusX = width / 2 - 1.25;
  const radiusY = height / 2 - 1.25;
  return { width, height, radiusX, radiusY };
}

export function resultMarkerRootClassName(kind: ResultMarkerKind): string {
  return `${styles.marker} ${kind === "guess" ? styles.guess : styles.target}`;
}

export function resultMarkerGraphicMarkup(kind: ResultMarkerKind, compatibilityClasses?: { pin?: string; rings?: string }): string {
  const { width, height, radiusX, radiusY } = markerGeometry(kind);
  return `
    <svg class="${styles.pin} ${compatibilityClasses?.pin ?? ""}" data-result-marker-pin viewBox="0 0 32 42">
      <path class="${styles.pinOutline}" fill-rule="evenodd" d="${PIN_OUTLINE_PATH}"/>
      <path class="${styles.pinFill}" fill-rule="evenodd" d="${PIN_FILL_PATH}"/>
      <circle class="${styles.pinCore}" cx="16" cy="15" r="7.15"/>
    </svg>
    <svg class="${styles.rings} ${compatibilityClasses?.rings ?? ""}" data-result-marker-rings viewBox="0 0 ${width} ${height}">
      <ellipse class="${styles.ringOuter}" cx="${width / 2}" cy="${height / 2}" rx="${radiusX}" ry="${radiusY}"/>
      <ellipse class="${styles.ringMiddle}" cx="${width / 2}" cy="${height / 2}" rx="${radiusX * 0.68}" ry="${radiusY * 0.68}"/>
      <ellipse class="${styles.ringInner}" cx="${width / 2}" cy="${height / 2}" rx="${radiusX * 0.38}" ry="${Math.max(radiusY * 0.38, 0.9)}"/>
    </svg>`;
}

export function ResultMarkerGraphic({ kind, landing = false, className = "" }: { kind: ResultMarkerKind; landing?: boolean; className?: string }) {
  const { width, height, radiusX, radiusY } = markerGeometry(kind);
  return (
    <span className={`${resultMarkerRootClassName(kind)} ${className}`.trim()} data-landing={landing ? "true" : "false"}>
      <svg className={styles.pin} data-result-marker-pin viewBox="0 0 32 42" aria-hidden="true">
        <path className={styles.pinOutline} fillRule="evenodd" d={PIN_OUTLINE_PATH} />
        <path className={styles.pinFill} fillRule="evenodd" d={PIN_FILL_PATH} />
        <circle className={styles.pinCore} cx="16" cy="15" r="7.15" />
      </svg>
      <svg className={styles.rings} data-result-marker-rings viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
        <ellipse className={styles.ringOuter} cx={width / 2} cy={height / 2} rx={radiusX} ry={radiusY} />
        <ellipse className={styles.ringMiddle} cx={width / 2} cy={height / 2} rx={radiusX * 0.68} ry={radiusY * 0.68} />
        <ellipse className={styles.ringInner} cx={width / 2} cy={height / 2} rx={radiusX * 0.38} ry={Math.max(radiusY * 0.38, 0.9)} />
      </svg>
    </span>
  );
}

export function ResultRouteGraphic({ label }: { label: string }) {
  const gradientId = `result-route-${useId().replaceAll(":", "")}`;
  return (
    <span className={styles.routeGraphic} aria-hidden="true">
      <span>{label}</span>
      <svg viewBox="0 0 160 20" preserveAspectRatio="none">
        <defs>
          <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1="4" y1="10" x2="156" y2="10">
            <stop offset="0" stopColor="#f43f7a" />
            <stop offset="0.52" stopColor="#a78bfa" />
            <stop offset="1" stopColor="#5ee7bd" />
          </linearGradient>
        </defs>
        <path className={styles.routeShadow} d="M4 10H156" />
        <path className={styles.routeLine} d="M4 10H156" style={{ stroke: `url(#${gradientId})` } as CSSProperties} />
      </svg>
    </span>
  );
}

export const resultRouteLineClassName = styles.routeLine;
