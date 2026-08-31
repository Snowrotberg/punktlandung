import type { GeoLocation } from "@/types/game";

function withFinalPunctuation(value: string): string {
  return /[.!?…]$/.test(value) ? value : `${value}.`;
}

export const locationDescriptionMaximumLength = 220;

function hasBalancedParentheses(value: string): boolean {
  let depth = 0;
  for (const character of value) {
    if (character === "(") depth += 1;
    if (character === ")") depth -= 1;
    if (depth < 0) return false;
  }
  return depth === 0;
}

function looksLikeSentenceFragment(value: string): boolean {
  return !hasBalancedParentheses(value)
    || /\b(?:bzw|ca|d|Dr|Jh|Nr|Prof|sg|St|u|v|vgl|z)\.$/i.test(value);
}

function completeSentences(value: string): string[] {
  const segmenter = new Intl.Segmenter("de", { granularity: "sentence" });
  const segments = [...segmenter.segment(value)].map(({ segment }) => segment.trim()).filter(Boolean);
  const completed: string[] = [];
  let pending = "";
  for (const [index, segment] of segments.entries()) {
    pending = `${pending} ${segment}`.trim();
    const ordinalContinues = /\b\d{1,2}\.$/.test(pending) && /^(?:Jahr|Jahrhundert|Jh\.)\b/i.test(segments[index + 1] ?? "");
    if (looksLikeSentenceFragment(pending) || ordinalContinues) continue;
    completed.push(pending);
    pending = "";
  }
  if (pending && !looksLikeSentenceFragment(pending)) completed.push(pending);
  return completed;
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

export function normalizeLocationDescription(value: string | null | undefined, maximumLength = locationDescriptionMaximumLength): string | null {
  const plain = String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#(?:39|x27);/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
  if (!plain) return null;

  const normalizedSentences = completeSentences(plain).slice(0, 2).join(" ").trim();
  if (!normalizedSentences) return null;
  const sentences = normalizedSentences;
  if (sentences.length <= maximumLength) return sentences;
  const shortened = sentences.slice(0, maximumLength - 1).replace(/\s+\S*$/, "").trim();
  return `${shortened || sentences.slice(0, maximumLength - 1).trim()}…`;
}

export function locationShortDescription(location: Pick<GeoLocation, "title" | "shortDescription">): string | undefined {
  const description = normalizeLocationDescription(location.shortDescription);
  if (!description) return undefined;
  return normalizeLocationDescription(factualSentence(location.title, description)) ?? undefined;
}
