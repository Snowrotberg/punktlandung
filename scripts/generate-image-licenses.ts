import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { builtInLocations } from "../data/locations";
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
  };
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

function sourceUrlFor(fileName: string): string {
  return `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(fileName).replace(/%20/g, "_")}`;
}

function fileKey(fileName: string): string {
  return fileName.replace(/^File:/i, "").replaceAll("_", " ").normalize("NFC").trim().toLocaleLowerCase();
}

const licenseOverrides = new Map<string, { artist?: string; license: string; licenseUrl: string }>([
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
  ]
]);

async function fetchBatch(fileNames: string[]): Promise<CommonsPage[]> {
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
  return Object.values(payload.query?.pages ?? {});
}

async function run() {
  const locationsByFile = new Map<string, typeof builtInLocations>();
  for (const location of builtInLocations) {
    if (location.source !== "wikimedia") continue;
    const fileName = imageFileNameForLicense(location);
    if (!fileName) continue;
    const locations = locationsByFile.get(fileName) ?? [];
    locations.push(location);
    locationsByFile.set(fileName, locations);
  }

  const fileNames = [...locationsByFile.keys()].sort((a, b) => a.localeCompare(b, "de"));
  const pages: CommonsPage[] = [];
  for (let index = 0; index < fileNames.length; index += batchSize) {
    const batch = fileNames.slice(index, index + batchSize);
    pages.push(...(await fetchBatch(batch)));
    console.log(`Wikimedia-Metadaten: ${Math.min(index + batch.length, fileNames.length)}/${fileNames.length}`);
  }

  const pageByFile = new Map<string, CommonsPage>();
  for (const page of pages) {
    const canonicalTitle = page.imageinfo?.[0]?.canonicaltitle ?? page.title ?? "";
    const fileName = canonicalTitle.replace(/^File:/, "");
    if (fileName) pageByFile.set(fileKey(fileName), page);
    if (page.title) pageByFile.set(fileKey(page.title), page);
  }

  const entries = fileNames.map((requestedFileName) => {
    const page = pageByFile.get(fileKey(requestedFileName));
    const info = page?.imageinfo?.[0];
    const metadata = info?.extmetadata;
    const canonicalFileName = (info?.canonicaltitle ?? page?.title ?? `File:${requestedFileName}`).replace(/^File:/, "");
    const locations = locationsByFile.get(requestedFileName) ?? [];
    const override = licenseOverrides.get(fileKey(canonicalFileName));
    const artist = override?.artist ?? (metadataValue(metadata, "Artist") || metadataValue(metadata, "Credit") || "Nicht angegeben");
    const originalSourceUrl = info?.descriptionurl ?? sourceUrlFor(canonicalFileName);
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
      fileName: canonicalFileName,
      artist,
      license,
      licenseUrl,
      sourceUrl: originalSourceUrl,
      categories: [...new Set(locations.map((location) => location.category))].sort(),
      locationCount: locations.length
    };
  });

  const unresolved = entries.filter((entry) => entry.artist === "Nicht angegeben" || entry.license === "Nicht angegeben");
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(
    outputPath,
    `${JSON.stringify({ generatedAt: new Date().toISOString(), imageCount: entries.length, entries }, null, 2)}\n`,
    "utf8"
  );

  console.log(`Lizenzkatalog geschrieben: ${entries.length} Bilder, ${unresolved.length} unvollständige Einträge.`);
  if (unresolved.length) {
    console.warn(unresolved.slice(0, 20).map((entry) => `- ${entry.fileName}: ${entry.artist} / ${entry.license}`).join("\n"));
    process.exitCode = 2;
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
