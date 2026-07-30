import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();

const targets = [
  "public/punktlandung-kartenbild.jpg",
  "public/category-icons/mixed-trim.png",
  "public/category-icons/landmarks-trim.png",
  "public/category-icons/cities-trim.png",
  "public/category-icons/landscapes-trim.png",
  "public/category-icons/flags-trim.png",
  "public/category-icons/capitals-trim.png",
  "public/category-icons/satellite-preview.png",
  "public/category-icons/streetview-preview.png",
  "public/mode-icons/solo-modus-crop.png",
  "public/mode-icons/party-modus-crop.png",
  "public/mode-icons/online-modus-crop.png",
  "public/mode-icons/online-raum3-crop.png"
];

for (const relativeInput of targets) {
  const input = path.join(root, relativeInput);
  const output = input.replace(/\.(?:png|jpe?g)$/i, ".webp");
  const before = (await fs.stat(input)).size;

  await sharp(input)
    .webp({ quality: 84, alphaQuality: 92, effort: 6 })
    .toFile(output);

  const after = (await fs.stat(output)).size;
  const savedPercent = Math.round((1 - after / before) * 100);
  console.log(`${path.relative(root, output)}: ${Math.round(before / 1024)} KiB -> ${Math.round(after / 1024)} KiB (${savedPercent}% kleiner)`);
}
