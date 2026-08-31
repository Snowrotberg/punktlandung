import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import landscapeReviewJson from "../data/generated/landscape-context-review.generated.json";
import { catalogInventoryLocations } from "../data/locations";

const tileWidth = 360;
const imageHeight = 235;
const labelHeight = 54;
const columns = 3;

function xmlEscape(value: string): string {
  return value.replace(/[<>&'"]/g, (character) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "'": "&apos;",
    '"': "&quot;"
  })[character]!);
}

function thumbnailUrl(fileName: string): string {
  const url = new URL(`https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(fileName)}`);
  url.searchParams.set("width", "1200");
  return url.toString();
}

async function main() {
  const outputDirectory = path.resolve(process.argv[2] ?? "test-artifacts/b2-landscape-review");
  await mkdir(outputDirectory, { recursive: true });
  const candidates = landscapeReviewJson.reviewEntries.filter((entry) => entry.automaticReviewRequired);
  const rendered: Array<Record<string, unknown>> = [];
  const tiles: Buffer[] = [];

  for (const [index, entry] of candidates.entries()) {
    const location = catalogInventoryLocations.find((candidate) => candidate.id === entry.locationId);
    if (!location) throw new Error(`Katalogeintrag fehlt: ${entry.locationId}`);
    const requestedUrl = thumbnailUrl(entry.imageFile);
    const response = await fetch(requestedUrl, {
      headers: { "user-agent": "Punktlandung landscape context review/1.0" },
      redirect: "follow"
    });
    if (!response.ok || !response.headers.get("content-type")?.startsWith("image/")) {
      throw new Error(`Bildabruf fehlgeschlagen (${response.status}): ${entry.imageFile}`);
    }
    const source = Buffer.from(await response.arrayBuffer());
    const metadata = await sharp(source).metadata();
    const mobileCrop = await sharp(source)
      .resize(tileWidth, imageHeight, { fit: "cover", position: "centre" })
      .png()
      .toBuffer();
    const label = Buffer.from(
      `<svg width="${tileWidth}" height="${labelHeight}" xmlns="http://www.w3.org/2000/svg">`
      + `<rect width="100%" height="100%" fill="#071426"/>`
      + `<text x="12" y="22" fill="#7ee7cd" font-family="Arial" font-size="14" font-weight="700">${index + 1}. ${xmlEscape(entry.title)}</text>`
      + `<text x="12" y="43" fill="#d8e1ef" font-family="Arial" font-size="12">${xmlEscape(entry.countryName)} · ${xmlEscape(entry.reasons.join(", "))}</text>`
      + `</svg>`
    );
    const tile = await sharp({
      create: { width: tileWidth, height: imageHeight + labelHeight, channels: 3, background: "#071426" }
    }).composite([{ input: mobileCrop, top: 0, left: 0 }, { input: label, top: imageHeight, left: 0 }]).png().toBuffer();
    const fileName = `${String(index + 1).padStart(2, "0")}-${entry.locationId}.png`;
    await writeFile(path.join(outputDirectory, fileName), tile);
    tiles.push(tile);
    rendered.push({
      index: index + 1,
      locationId: entry.locationId,
      title: entry.title,
      countryName: entry.countryName,
      imageFile: entry.imageFile,
      requestedUrl,
      resolvedUrl: response.url,
      contentType: response.headers.get("content-type"),
      bytes: source.length,
      decodedWidth: metadata.width ?? null,
      decodedHeight: metadata.height ?? null,
      renderedFile: fileName
    });
  }

  const rows = Math.ceil(tiles.length / columns);
  const contactSheet = sharp({
    create: { width: tileWidth * columns, height: (imageHeight + labelHeight) * rows, channels: 3, background: "#020817" }
  }).composite(tiles.map((input, index) => ({
    input,
    left: (index % columns) * tileWidth,
    top: Math.floor(index / columns) * (imageHeight + labelHeight)
  })));
  await contactSheet.png().toFile(path.join(outputDirectory, "contact-sheet.png"));
  await writeFile(path.join(outputDirectory, "rendered.json"), `${JSON.stringify(rendered, null, 2)}\n`, "utf8");
  console.log(`${rendered.length} Landschaftsmotive mobil gerendert: ${outputDirectory}`);
}

void main();
