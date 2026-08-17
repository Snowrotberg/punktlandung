import type { GeoLocation } from "@/types/game";

function withFinalPunctuation(value: string): string {
  return /[.!?…]$/.test(value) ? value : `${value}.`;
}

function factualSentence(title: string, description: string): string {
  if (description.toLocaleLowerCase("de-DE").includes(title.toLocaleLowerCase("de-DE"))) {
    return withFinalPunctuation(description);
  }
  if (/^Hauptstadt\b/i.test(description)) return withFinalPunctuation(`${title} ist die ${description.charAt(0).toLocaleLowerCase("de-DE")}${description.slice(1)}`);
  if (/^(Stadt|Gemeinde|Metropole|Insel|Landschaft|Gebirge|Wüste|Berg|Fluss|See)\b/i.test(description)) {
    return withFinalPunctuation(`${title} ist eine ${description.charAt(0).toLocaleLowerCase("de-DE")}${description.slice(1)}`);
  }
  return withFinalPunctuation(`${title}: ${description}`);
}

export function normalizeLocationDescription(value: string | null | undefined, maximumLength = 240): string | null {
  const plain = String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#(?:39|x27);/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
  if (!plain) return null;

  const sentences = plain.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.slice(0, 2).map((sentence) => sentence.trim()).join(" ").trim() ?? plain;
  if (sentences.length <= maximumLength) return sentences;
  const shortened = sentences.slice(0, maximumLength - 1).replace(/\s+\S*$/, "").trim();
  return `${shortened || sentences.slice(0, maximumLength - 1).trim()}…`;
}

export function locationShortDescription(location: Pick<GeoLocation, "title" | "shortDescription">): string | undefined {
  const description = normalizeLocationDescription(location.shortDescription);
  return description ? factualSentence(location.title, description) : undefined;
}
