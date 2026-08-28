export function normalizeImageLicenseFileName(value: string) {
  return value.replaceAll("_", " ").normalize("NFC").trim().toLocaleLowerCase();
}

function normalizeImageLicenseLookupFileName(value: string) {
  return normalizeImageLicenseFileName(value).replace(/(?<=\d)×(?=\d)/g, "x");
}

export type ImageLicenseEntryFileNames = {
  fileName: string;
  catalogFileName?: string;
  catalogFileNames?: string[];
};

export function imageLicenseEntryFileNames(entry: ImageLicenseEntryFileNames) {
  return [...new Set([entry.catalogFileName, ...(entry.catalogFileNames ?? []), entry.fileName]
    .filter((fileName): fileName is string => Boolean(fileName?.trim()))
    .map((fileName) => fileName.trim()))];
}

export function imageLicenseCatalogFileName(entry: ImageLicenseEntryFileNames) {
  return entry.catalogFileName?.trim() || entry.catalogFileNames?.find((fileName) => fileName.trim()) || entry.fileName;
}

export function imageLicenseEntryMatchesFile(entry: ImageLicenseEntryFileNames, fileName: string) {
  const normalizedFileName = normalizeImageLicenseLookupFileName(fileName);
  return imageLicenseEntryFileNames(entry).some((candidate) =>
    normalizeImageLicenseLookupFileName(candidate) === normalizedFileName
  );
}

export function imageFileNameForLicense(location: { imageFile?: string; panoramaUrl?: string }): string | undefined {
  if (location.imageFile?.trim()) return location.imageFile.trim();
  if (!location.panoramaUrl) return undefined;
  try {
    const url = new URL(location.panoramaUrl);
    for (const marker of ["/Special:FilePath/", "/Special:Redirect/file/"]) {
      if (url.pathname.includes(marker)) return decodeURIComponent(url.pathname.split(marker).pop() ?? "") || undefined;
    }
    if (url.hostname === "upload.wikimedia.org") {
      return decodeURIComponent(url.pathname.split("/").filter(Boolean).at(-1) ?? "") || undefined;
    }
  } catch {
    return undefined;
  }
  return undefined;
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

export function imageCommonsSourceHref(fileName: string) {
  return `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(fileName.trim()).replace(/%20/g, "_")}`;
}

export function imageLicenseHref(fileName?: string) {
  if (!fileName) return "/lizenzen#bildnachweise";
  return `/lizenzen?bild=${encodeURIComponent(fileName)}#${imageLicenseEntryId(fileName)}`;
}
