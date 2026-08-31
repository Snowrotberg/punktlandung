import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceMap = path.join(root, "public", "home-map-preview-monitor-short-2x.webp");
const sourceIcon = path.join(root, "app", "icon.svg");
const output = path.join(root, "public", "punktlandung-share-v2.jpg");

const width = 1200;
const height = 630;
const mapWidth = 1080;
const mapHeight = 300;

const map = await sharp(sourceMap)
  .resize(mapWidth, mapHeight, { fit: "cover", position: "centre" })
  .composite([
    {
      input: Buffer.from(
        `<svg width="${mapWidth}" height="${mapHeight}" xmlns="http://www.w3.org/2000/svg"><rect width="${mapWidth}" height="${mapHeight}" rx="24" fill="#fff"/></svg>`
      ),
      blend: "dest-in"
    }
  ])
  .png()
  .toBuffer();

const icon = await sharp(sourceIcon).resize(80, 80).png().toBuffer();

const backdrop = Buffer.from(`
  <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="mint" cx="0" cy="0" r="1" gradientTransform="translate(110 40) rotate(35) scale(500 340)">
        <stop stop-color="#1c7665" stop-opacity=".42"/>
        <stop offset="1" stop-color="#070b14" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="violet" cx="0" cy="0" r="1" gradientTransform="translate(1110 160) rotate(145) scale(430 300)">
        <stop stop-color="#6552c8" stop-opacity=".34"/>
        <stop offset="1" stop-color="#070b14" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="line" x1="0" y1="0" x2="1" y2="0">
        <stop stop-color="#5ee7bd"/>
        <stop offset="1" stop-color="#8b7cf6"/>
      </linearGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="#070b14"/>
    <rect width="${width}" height="${height}" fill="url(#mint)"/>
    <rect width="${width}" height="${height}" fill="url(#violet)"/>
    <path d="M0 246H1200" stroke="#283044" stroke-width="1"/>
    <rect x="60" y="280" width="1080" height="300" rx="24" fill="#030712" opacity=".65"/>
    <rect x="60" y="280" width="1080" height="300" rx="24" fill="none" stroke="url(#line)" stroke-opacity=".58" stroke-width="2"/>
  </svg>
`);

const typography = Buffer.from(`
  <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <style>
      .brand { font: 750 56px Inter, "Segoe UI", Arial, sans-serif; fill: #f8fafc; letter-spacing: -1.7px; }
      .claim { font: 650 32px Inter, "Segoe UI", Arial, sans-serif; fill: #f8fafc; letter-spacing: -.5px; }
      .detail { font: 600 20px Inter, "Segoe UI", Arial, sans-serif; fill: #b9c4d5; }
      .chip { font: 750 16px Inter, "Segoe UI", Arial, sans-serif; fill: #5ee7bd; letter-spacing: 1.4px; }
    </style>
    <text x="166" y="112" class="brand">Punktlandung</text>
    <text x="72" y="174" class="claim">Orte erkennen. Punktgenau landen.</text>
    <rect x="72" y="200" width="505" height="38" rx="19" fill="#5ee7bd" fill-opacity=".1" stroke="#5ee7bd" stroke-opacity=".3"/>
    <text x="94" y="225" class="detail">Kostenlos im Browser · Solo, Party &amp; Online-Raum</text>
    <text x="1002" y="225" class="chip">GEO-SPIEL</text>
  </svg>
`);

await sharp(backdrop)
  .composite([
    { input: icon, left: 72, top: 47 },
    { input: map, left: 60, top: 280 },
    { input: typography, left: 0, top: 0 }
  ])
  .jpeg({ quality: 91, chromaSubsampling: "4:4:4", mozjpeg: true })
  .toFile(output);

const metadata = await sharp(output).metadata();
console.log(`${path.relative(root, output)} ${metadata.width}x${metadata.height} ${metadata.format}`);
