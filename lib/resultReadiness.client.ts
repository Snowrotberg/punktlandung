"use client";

import { punktlandungMapStyleUrl } from "./mapStyle";
import { createResultReadinessCoordinator, resultExperienceReadinessStatus } from "./resultReadiness";

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

let readinessMarked = false;

export async function prepareResultExperience() {
  const readiness = await resultReadiness.prepare();
  if (!readinessMarked) {
    readinessMarked = true;
    const status = resultExperienceReadinessStatus(readiness);
    performance.mark(`punktlandung-result-prewarm-${status}`, { detail: readiness });
    performance.mark("punktlandung-result-prewarm-settled", { detail: { ...readiness, status } });
  }
  return readiness;
}
