import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { catalogInventoryLocations } from "../data/locations";
import { imageFileNameForLicense } from "../lib/imageLicenseLink";

const endpoint = "https://commons.wikimedia.org/w/api.php";
const outputPath = path.join(process.cwd(), "data", "generated", "image-licenses.generated.json");
const batchSize = 50;
const userAgent = process.env.WIKIMEDIA_USER_AGENT ?? "Punktlandung/1.0 (image license catalog; aintartstudio@gmail.com)";

type CommonsMetadata = Record<string, { value?: string }>;

type CommonsPage = {
  title?: string;
  missing?: boolean;
  imageinfo?: Array<{
    canonicaltitle?: string;
    descriptionurl?: string;
    extmetadata?: CommonsMetadata;
  }>;
};

type CommonsResponse = {
  query?: {
    pages?: Record<string, CommonsPage>;
    normalized?: Array<{ from: string; to: string }>;
    redirects?: Array<{ from: string; to: string }>;
  };
};

type RequestedCommonsPage = {
  requestedFileName: string;
  page?: CommonsPage;
};

type LicenseOverride = {
  artist?: string;
  license?: string;
  licenseUrl?: string;
};

function plainText(input = ""): string {
  return input
    .replace(/<br\s*\/?\s*>/gi, ", ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

function metadataValue(metadata: CommonsMetadata | undefined, key: string): string {
  return plainText(metadata?.[key]?.value);
}

function attributionValue(metadata: CommonsMetadata | undefined): string {
  const artist = metadataValue(metadata, "Artist");
  const credit = metadataValue(metadata, "Credit");
  const genericCredit = /^(own work|eigenes werk|travail personnel|obra propia|opera propria)$/i.test(credit);
  // Artwork pages can expose the architect or painter as Artist while Credit
  // contains the photographer whose CC attribution the reused file requires.
  return credit && !genericCredit ? credit : artist || credit;
}

function sourceUrlFor(fileName: string): string {
  return `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(fileName).replace(/%20/g, "_")}`;
}

function fileKey(fileName: string): string {
  return fileName.replace(/^File:/i, "").replaceAll("_", " ").normalize("NFC").trim().toLocaleLowerCase();
}

// Commons' legacy pages sometimes state the author/source only in their
// description wikitext, not in extmetadata. These exact-file overrides are
// transcriptions from the linked Commons description pages; none is inferred
// from a title alone.
const licenseOverrides = new Map<string, LicenseOverride>([
  [
    fileKey("Tianjin, China ESA15420167.jpeg"),
    {
      license: "CC BY-SA 3.0 IGO",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/igo/"
    }
  ],
  [
    fileKey("Hegra, Al-Ula, Saudi Arabia.png"),
    {
      artist: "Ali Lajami",
      license: "CC0 1.0",
      licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/"
    }
  ],
  [fileKey("Africa Mt Dair.jpg"), { artist: "NASA" }],
  [fileKey("Castara village Beach1.jpg"), { artist: "User:Velela" }],
  [fileKey("Chacachacare dry forest 2.jpg"), { artist: "F. B. Lucas" }],
  [fileKey("Codrii dolna.jpg"), { artist: "User:Zserghei" }],
  [fileKey("Cyprus lrg.jpg"), { artist: "NASA" }],
  [fileKey("Doha Palace.jpg"), { artist: "Martin Belam" }],
  [fileKey("Doyle's Delight.jpg"), { artist: "Eric Gilbertson" }],
  [fileKey("Emlembe (2).jpg"), { artist: "Eric Gilbertson" }],
  [fileKey("Épimap.JPG"), { artist: "English Wikipedia / File:Épimap.png (Importquelle)" }],
  [fileKey("Great-Zimbabwe-6.jpg"), { artist: "PatrickVanM" }],
  [fileKey("Hitachi Tower, Dec 05.JPG"), { artist: "User:Sengkang" }],
  [fileKey("Insula Roxa.png"), { artist: "NASA" }],
  [fileKey("Issyk Kul.jpg"), { artist: "NASA" }],
  [fileKey("Jabrin37.jpg"), { artist: "English Wikipedia / User:Mac9 (GFDL-Importquelle)" }],
  [fileKey("Jemo Island.jpg"), { artist: "NASA Landsat 7" }],
  [fileKey("Kebira Crater.jpg"), { artist: "NASA Landsat / Boston University Center for Remote Sensing" }],
  [fileKey("Kuwait-Islands.png"), { artist: "NASA World Wind" }],
  [fileKey("Lubaantun-structure.jpg"), { artist: "Gerry Manacsa" }],
  [fileKey("Machaerus Panorama.jpg"), { artist: "Thomas Bantle" }],
  [fileKey("Malta Hypogeum Modell.jpg"), { artist: "Heiko Gorski (User:Moonshadow)" }],
  [fileKey("Momotombo.jpg"), { artist: "www.world-traveller.org / English Wikipedia (Importquelle)" }],
  [fileKey("MonacoLibreDeDroits.jpg"), { artist: "Georges DICK" }],
  [fileKey("Namib Desert surface.jpg"), { artist: "NASA World Wind" }],
  [fileKey("Nauru-WWIIrelic.jpg"), { artist: "Clive Cooper (Aussie19753)" }],
  [fileKey("Nordby havn Fanø.jpg"), { artist: "Malene Thyssen" }],
  [fileKey("Pitonpair.JPG"), { artist: "User:Chensiyuan" }],
  [fileKey("Port Royal Cays.png"), { artist: "NASA World Wind / User:Ratzer" }],
  [fileKey("Pulau Palawan seen from Siloso Beach, Sentosa, Singapore - 20060805.jpg"), { artist: "User:Sengkang" }],
  [fileKey("Raznas ezers.JPG"), { artist: "Jānis U." }],
  [fileKey("Samoa upolu.jpg"), { artist: "User:Kronocide" }],
  [fileKey("Soufriere.jpg"), { artist: "User:Acp" }],
  [fileKey("Sudan Uganda Modole.jpg"), { artist: "NASA World Wind" }],
  [fileKey("Thailand 421.jpg"), { artist: "Martin Püschel" }],
  [fileKey("Timor island2.jpg"), { artist: "NASA" }],
  [fileKey("WatPhouwholesite.jpg"), { artist: "User:Markalexander100" }],
  [fileKey("ZmbziRvr.jpg"), { artist: "Craig Chipperfield" }]
]);

const unavailableFiles = new Map<string, { reason: string; evidenceUrl: string }>([
  [
    fileKey("Catedral San SalvadorMarzo.jpg"),
    {
      reason: "Wikimedia Commons löschte die Datei am 28.08.2026 als eindeutige Urheberrechtsverletzung; Urheber und Lizenz dürfen nicht aus dem früheren Eintrag übernommen werden.",
      evidenceUrl: "https://commons.wikimedia.org/w/index.php?title=Special:Log&logid=406204305"
    }
  ],
  [
    fileKey("DJ-Sam-Carter Backstage-Clip-VIP-FrenchRiviera-Cannes 24.png"),
    {
      reason: "Wikimedia Commons löschte die Datei am 24.08.2026 als persönliche Datei (F10); Urheber und Lizenz sind danach nicht mehr belastbar abrufbar.",
      evidenceUrl: "https://commons.wikimedia.org/w/index.php?title=Special:Log&logid=405964547"
    }
  ]
]);

async function fetchBatch(fileNames: string[]): Promise<RequestedCommonsPage[]> {
  const url = new URL(endpoint);
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");
  url.searchParams.set("redirects", "1");
  url.searchParams.set("prop", "imageinfo");
  url.searchParams.set("iiprop", "canonicaltitle|url|extmetadata");
  url.searchParams.set("iiextmetadatafilter", "Artist|Credit|LicenseShortName|LicenseUrl|UsageTerms|AttributionRequired|Copyrighted");
  url.searchParams.set("titles", fileNames.map((fileName) => `File:${fileName}`).join("|"));

  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": userAgent
    }
  });
  if (!response.ok) throw new Error(`Wikimedia Commons returned ${response.status}: ${await response.text()}`);
  const payload = (await response.json()) as CommonsResponse;
  const pages = Object.values(payload.query?.pages ?? {});
  const aliases = new Map<string, string>();
  for (const alias of [...(payload.query?.normalized ?? []), ...(payload.query?.redirects ?? [])]) {
    aliases.set(fileKey(alias.from), alias.to);
  }
  const pagesByTitle = new Map<string, CommonsPage>();
  for (const page of pages) {
    if (page.title) pagesByTitle.set(fileKey(page.title), page);
    const canonicalTitle = page.imageinfo?.[0]?.canonicaltitle;
    if (canonicalTitle) pagesByTitle.set(fileKey(canonicalTitle), page);
  }
  const resolveTitle = (title: string) => {
    let resolvedTitle = title;
    const visited = new Set<string>();
    while (aliases.has(fileKey(resolvedTitle)) && !visited.has(fileKey(resolvedTitle))) {
      visited.add(fileKey(resolvedTitle));
      resolvedTitle = aliases.get(fileKey(resolvedTitle)) ?? resolvedTitle;
    }
    return resolvedTitle;
  };

  return fileNames.map((requestedFileName) => ({
    requestedFileName,
    page: pagesByTitle.get(fileKey(resolveTitle(`File:${requestedFileName}`)))
      ?? pagesByTitle.get(fileKey(requestedFileName))
  }));
}

async function run() {
  // Keep attribution for the complete retained inventory. Admin statistics can
  // still reference images that were played before a stricter quality filter
  // removed them from the current game pool.
  const locationsByFile = new Map<string, {
    catalogFileNames: Set<string>;
    locations: typeof catalogInventoryLocations;
  }>();
  const rawCatalogFileNames = new Set<string>();
  for (const location of catalogInventoryLocations) {
    if (location.source !== "wikimedia") continue;
    const fileName = imageFileNameForLicense(location);
    if (!fileName) continue;
    rawCatalogFileNames.add(fileName);
    const key = fileKey(fileName);
    const record = locationsByFile.get(key) ?? { catalogFileNames: new Set<string>(), locations: [] };
    record.catalogFileNames.add(fileName);
    record.locations.push(location);
    locationsByFile.set(key, record);
  }

  const catalogFileNameOrder = (left: string, right: string) => {
    const underscoreDifference = (left.match(/_/g)?.length ?? 0) - (right.match(/_/g)?.length ?? 0);
    return underscoreDifference || left.localeCompare(right, "de") || (left < right ? -1 : left > right ? 1 : 0);
  };
  const records = [...locationsByFile.values()].map((record) => ({
    ...record,
    catalogFileNames: [...record.catalogFileNames].sort(catalogFileNameOrder)
  })).sort((left, right) => catalogFileNameOrder(left.catalogFileNames[0], right.catalogFileNames[0]));
  const fileNames = records.map((record) => record.catalogFileNames[0]);
  const rawCatalogFileCount = rawCatalogFileNames.size;
  const requestedPages: RequestedCommonsPage[] = [];
  for (let index = 0; index < fileNames.length; index += batchSize) {
    const batch = fileNames.slice(index, index + batchSize);
    requestedPages.push(...(await fetchBatch(batch)));
    console.log(`Wikimedia-Metadaten: ${Math.min(index + batch.length, fileNames.length)}/${fileNames.length}`);
  }

  const pageByRequestedFile = new Map(requestedPages.map(({ requestedFileName, page }) => [fileKey(requestedFileName), page]));

  const entries = records.map((record) => {
    const requestedFileName = record.catalogFileNames[0];
    const page = pageByRequestedFile.get(fileKey(requestedFileName));
    const info = page?.imageinfo?.[0];
    const metadata = info?.extmetadata;
    const canonicalFileName = (info?.canonicaltitle ?? page?.title ?? `File:${requestedFileName}`).replace(/^File:/, "");
    const locations = record.locations;
    const unavailable = unavailableFiles.get(fileKey(requestedFileName));
    if (unavailable) {
      return {
        catalogFileName: requestedFileName,
        ...(record.catalogFileNames.length > 1 ? { catalogFileNames: record.catalogFileNames } : {}),
        fileName: canonicalFileName,
        availability: "unavailable" as const,
        unavailableReason: unavailable.reason,
        artist: null,
        license: null,
        licenseUrl: null,
        sourceUrl: unavailable.evidenceUrl,
        categories: [...new Set(locations.map((location) => location.category))].sort(),
        locationCount: locations.length
      };
    }
    const override = licenseOverrides.get(fileKey(canonicalFileName)) ?? licenseOverrides.get(fileKey(requestedFileName));
    const originalSourceUrl = info?.descriptionurl ?? sourceUrlFor(canonicalFileName);
    const artist = override?.artist ?? (attributionValue(metadata) || "Nicht angegeben");
    let license = override?.license ?? (metadataValue(metadata, "LicenseShortName") || metadataValue(metadata, "UsageTerms") || "Nicht angegeben");
    let licenseUrl = override?.licenseUrl ?? (metadata?.LicenseUrl?.value?.trim() || null);

    // Some older Commons files use a custom free-use template without a
    // standalone licence URL. In those cases the file page itself contains
    // the binding attribution or free-use terms and is the most precise link.
    if (!licenseUrl && license === "Attribution") {
      license = "Freie Nutzung mit Namensnennung gemäß Originalseite";
      licenseUrl = originalSourceUrl;
    } else if (!licenseUrl && license === "Copyrighted free use") {
      license = "Freie Nutzung gemäß Freigabe auf der Originalseite";
      licenseUrl = originalSourceUrl;
    }

    return {
      catalogFileName: requestedFileName,
      ...(record.catalogFileNames.length > 1 ? { catalogFileNames: record.catalogFileNames } : {}),
      fileName: canonicalFileName,
      availability: "available" as const,
      artist,
      license,
      licenseUrl,
      sourceUrl: originalSourceUrl,
      categories: [...new Set(locations.map((location) => location.category))].sort(),
      locationCount: locations.length
    };
  });

  const unresolved = entries.filter((entry) =>
    entry.availability !== "unavailable" && (entry.artist === "Nicht angegeben" || entry.license === "Nicht angegeben")
  );
  const unavailable = entries.filter((entry) => entry.availability === "unavailable");
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(
    outputPath,
    `${JSON.stringify({
      generatedAt: new Date().toISOString(),
      rawCatalogFileCount,
      imageCount: entries.length,
      unavailableImageCount: unavailable.length,
      entries
    }, null, 2)}\n`,
    "utf8"
  );

  console.log(`Lizenzkatalog geschrieben: ${rawCatalogFileCount} Rohreferenzen → ${entries.length} normalisierte Dateien, ${unresolved.length} unvollständig, ${unavailable.length} extern nicht mehr verfügbar.`);
  if (unresolved.length) {
    console.warn(unresolved.slice(0, 40).map((entry) => `- ${entry.fileName}: ${entry.artist} / ${entry.license}`).join("\n"));
    process.exitCode = 2;
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
