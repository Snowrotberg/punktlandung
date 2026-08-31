"use client";

import { punktlandungMapStyleUrl } from "./mapStyle";
import { createResultReadinessCoordinator } from "./resultReadiness";

const resultReadiness = createResultReadinessCoordinator(
  async () => {
    const module = await import("../components/GlobeMapLab");
    module.prewarmGlobeResultMap();
  },
  async () => {
    const response = await fetch(punktlandungMapStyleUrl("globe"), { cache: "force-cache" });
    if (!response.ok) throw new Error(`Result map style responded with ${response.status}`);
  }
);

export function prepareResultExperience() {
  return resultReadiness.prepare();
}
