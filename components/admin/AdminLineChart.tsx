"use client";

import { useState } from "react";
import styles from "@/app/admin/page.module.css";

export type AdminChartBucket = { label: string; axisLabel?: string };
export type AdminChartSeries = { label: string; color: string; values: Array<number | null> };

function formatValue(value: number): string {
  return value.toLocaleString("de-DE", { maximumFractionDigits: 1 });
}

export function AdminLineChart({ title, description, buckets, series }: {
  title: string;
  description: string;
  buckets: AdminChartBucket[];
  series: AdminChartSeries[];
}) {
  const [active, setActive] = useState<{ seriesIndex: number; bucketIndex: number } | null>(null);
  const width = 640;
  const height = 190;
  const padding = { top: 18, right: 14, bottom: 28, left: 34 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const measuredValues = series.flatMap((item) => item.values).filter((value): value is number => value !== null);
  const maxValue = Math.max(1, ...measuredValues);
  const xAt = (index: number) => buckets.length === 1 ? padding.left + plotWidth / 2 : padding.left + (index / Math.max(1, buckets.length - 1)) * plotWidth;
  const yAt = (value: number) => padding.top + plotHeight - (value / maxValue) * plotHeight;
  const labelIndexes = [...new Set([0, Math.floor((buckets.length - 1) / 2), buckets.length - 1])];
  const hasData = measuredValues.length > 0;
  const activePoint = active ? { label: buckets[active.bucketIndex]?.label, series: series[active.seriesIndex]?.label, value: series[active.seriesIndex]?.values[active.bucketIndex] } : null;

  return <figure className={styles.chartCard}>
    <figcaption><div><strong>{title}</strong><span>{description}</span></div><div className={styles.chartLegend}>{series.map((item) => <span key={item.label}><i style={{ backgroundColor: item.color }} />{item.label}<b>{formatValue(item.values.reduce<number>((sum, value) => sum + (value ?? 0), 0))}</b></span>)}</div></figcaption>
    {!hasData ? <div className={styles.chartEmpty}>Für diesen Zeitraum liegen noch keine Verlaufsdaten vor.</div> : <>
      <svg className={styles.lineChart} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title}: Punkte können mit Maus, Tastatur oder Berührung geprüft werden.`}>
        {[0, .5, 1].map((ratio) => { const y = padding.top + plotHeight * ratio; const value = Math.round(maxValue * (1 - ratio)); return <g key={ratio}><line x1={padding.left} x2={width - padding.right} y1={y} y2={y} className={styles.chartGridLine} /><text x={padding.left - 7} y={y + 4} textAnchor="end" className={styles.chartAxisLabel}>{value}</text></g>; })}
        {series.map((item, seriesIndex) => {
          const path = item.values.reduce((result, value, index) => value === null
            ? { data: result.data, continues: false }
            : { data: `${result.data}${result.continues ? " L" : " M"}${xAt(index)} ${yAt(value)}`, continues: true }, { data: "", continues: false });
          return <g key={item.label} style={{ color: item.color }}><path d={path.data} className={styles.chartLine} />{item.values.map((value, bucketIndex) => value === null ? null : <circle key={bucketIndex} cx={xAt(bucketIndex)} cy={yAt(value)} r={active?.seriesIndex === seriesIndex && active.bucketIndex === bucketIndex ? 6 : 4} className={styles.chartPoint} tabIndex={0} role="button" aria-label={`${buckets[bucketIndex].label}: ${formatValue(value)} ${item.label}`} onMouseEnter={() => setActive({ seriesIndex, bucketIndex })} onFocus={() => setActive({ seriesIndex, bucketIndex })} onClick={() => setActive({ seriesIndex, bucketIndex })}><title>{buckets[bucketIndex].label}: {formatValue(value)} {item.label}</title></circle>)}</g>;
        })}
        {labelIndexes.map((index) => <text key={index} x={xAt(index)} y={height - 7} textAnchor={index === 0 ? "start" : index === buckets.length - 1 ? "end" : "middle"} className={styles.chartAxisLabel}>{buckets[index].axisLabel ?? buckets[index].label}</text>)}
      </svg>
      <output className={styles.chartReadout} aria-live="polite">{activePoint && activePoint.value !== null ? <><strong>{activePoint.label}</strong><span>{activePoint.series}: {formatValue(activePoint.value)}</span></> : <span>Punkt antippen oder mit Maus/Tastatur fokussieren.</span>}</output>
    </>}
  </figure>;
}
