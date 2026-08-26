export function normalizeImageLicenseFileName(value: string) {
  return value.replaceAll("_", " ").normalize("NFC").trim().toLocaleLowerCase();
}

function stableFileHash(value: string) {
  let hash = 2166136261;
  for (const character of normalizeImageLicenseFileName(value)) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function imageLicenseEntryId(fileName: string) {
  return `bild-${stableFileHash(fileName)}`;
}

export function imageLicenseHref(fileName?: string) {
  if (!fileName) return "/lizenzen#bildnachweise";
  return `/lizenzen?bild=${encodeURIComponent(fileName)}#${imageLicenseEntryId(fileName)}`;
}
