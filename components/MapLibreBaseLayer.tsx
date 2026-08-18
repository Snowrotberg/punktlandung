"use client";

import { useEffect, useRef } from "react";
import { maplibreGL } from "leaflet";
import "@maplibre/maplibre-gl-leaflet";
import { useMap } from "react-leaflet";
import { PUNKTLANDUNG_MAP_STYLE_URL } from "@/lib/mapStyle";

type MapLibreBaseLayerProps = {
  renderWorldCopies: boolean;
  onReady?: () => void;
};

export function MapLibreBaseLayer({ renderWorldCopies, onReady }: MapLibreBaseLayerProps) {
  const map = useMap();
  const styleUrl = PUNKTLANDUNG_MAP_STYLE_URL;
  const onReadyRef = useRef(onReady);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    const layer = maplibreGL(
      {
        style: styleUrl,
        attributionControl: false,
        renderWorldCopies
      } as Parameters<typeof maplibreGL>[0]
    );

    layer.addTo(map);
    const maplibreMap = layer.getMaplibreMap();
    const reportMapError = (event: { error: Error }) => {
      console.error(`[Punktlandung map] ${event.error.message}\n${event.error.stack ?? ""}`);
    };
    let readyFrame: number | undefined;
    let composedFrame: number | undefined;
    let readyReported = false;
    const reportMapReady = () => {
      if (readyReported) return;
      readyReported = true;
      // `idle` means the style and tiles are loaded. Waiting for two browser
      // frames also guarantees that the finished WebGL canvas has reached
      // the compositor before the poster above it starts fading away.
      readyFrame = window.requestAnimationFrame(() => {
        composedFrame = window.requestAnimationFrame(() => onReadyRef.current?.());
      });
    };
    const reportLoadedMap = () => {
      if (maplibreMap.loaded()) reportMapReady();
    };
    maplibreMap.on("error", reportMapError);
    maplibreMap.on("idle", reportMapReady);
    maplibreMap.on("load", reportLoadedMap);
    reportLoadedMap();
    let disposed = false;
    let resizeFrame: number | undefined;
    const resizeMap = () => {
      if (disposed || !map.getContainer().isConnected) return;
      map.invalidateSize(false);
      maplibreMap.resize();
    };
    const scheduleResize = () => {
      if (disposed) return;
      if (resizeFrame !== undefined) window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(() => {
        resizeFrame = undefined;
        resizeMap();
      });
    };
    const resizeObserver = new ResizeObserver(scheduleResize);
    resizeObserver.observe(map.getContainer());
    const restoreVisibleMap = () => {
      if (document.visibilityState === "visible") scheduleResize();
    };
    document.addEventListener("visibilitychange", restoreVisibleMap);
    window.addEventListener("pageshow", restoreVisibleMap);
    scheduleResize();
    return () => {
      disposed = true;
      maplibreMap.off("error", reportMapError);
      maplibreMap.off("idle", reportMapReady);
      maplibreMap.off("load", reportLoadedMap);
      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", restoreVisibleMap);
      window.removeEventListener("pageshow", restoreVisibleMap);
      if (readyFrame !== undefined) window.cancelAnimationFrame(readyFrame);
      if (composedFrame !== undefined) window.cancelAnimationFrame(composedFrame);
      if (resizeFrame !== undefined) window.cancelAnimationFrame(resizeFrame);
      layer.remove();
    };
  }, [map, renderWorldCopies, styleUrl]);

  return null;
}
