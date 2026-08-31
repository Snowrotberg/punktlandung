import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const catalogPath = path.join(process.cwd(), "data", "generated", "locations.generated.json");
const wikidataEndpoint = "https://www.wikidata.org/w/api.php";
const wikipediaEndpoint = "https://de.wikipedia.org/w/api.php";
const userAgent = process.env.WIKIDATA_USER_AGENT ?? "Punktlandung/1.0 (location description enrichment; aintartstudio@gmail.com)";
const wikidataBatchSize = 50;
const wikipediaBatchSize = 20;
const maximumLength = 220;
const sentenceSegmenter = new Intl.Segmenter("de", { granularity: "sentence" });

function plainText(value) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\[[^\]]*]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function withoutParentheticalAsides(value) {
  let depth = 0;
  let result = "";
  for (const character of String(value ?? "")) {
    if (character === "(") {
      depth += 1;
      continue;
    }
    if (character === ")" && depth > 0) {
      depth -= 1;
      if (depth === 0) result += " ";
      continue;
    }
    if (depth === 0) result += character;
  }
  return plainText(result);
}

function sentences(value) {
  const segments = [...sentenceSegmenter.segment(plainText(value))].map(({ segment }) => segment.trim()).filter(Boolean);
  const completed = [];
  let pending = "";
  for (const [index, segment] of segments.entries()) {
    pending = `${pending} ${segment}`.trim();
    const openParentheses = (pending.match(/\(/g) ?? []).length - (pending.match(/\)/g) ?? []).length;
    const abbreviationFragment = /\b(?:bzw|ca|d|Dr|Jh|Nr|Prof|sg|St|u|v|vgl|z)\.$/i.test(pending);
    const ordinalContinues = /\b\d{1,2}\.$/.test(pending) && /^(?:Jahr|Jahrhundert|Jh\.)\b/i.test(segments[index + 1] ?? "");
    if (pending.length < 35 || openParentheses > 0 || abbreviationFragment || ordinalContinues) continue;
    completed.push(pending);
    pending = "";
  }
  if (pending.length >= 35 && (pending.match(/\(/g) ?? []).length === (pending.match(/\)/g) ?? []).length) completed.push(pending);
  return completed;
}

function shortenedSentence(value, limit = maximumLength) {
  const clean = plainText(value);
  if (!clean) return null;
  if (/…$/.test(clean)) return null;
  if (clean.length <= limit) return /[.!?]$/.test(clean) ? clean : `${clean}.`;
  return null;
}

function informativeScore(sentence, title, index) {
  const lower = sentence.toLocaleLowerCase("de-DE");
  if (/^(sie|er|es|dort|damit|dabei|dadurch|heute|nach einer berechnung)\b/.test(lower)) return -100;
  if (/punktlandung|wird .* gespielt/.test(lower)) return -100;
  let score = Math.max(0, 7 - index * 0.45);
  if (lower.includes(title.toLocaleLowerCase("de-DE"))) score += 2;
  if (/unesco|weltkulturerbe|weltnaturerbe|größte|grösste|älteste|historisch|geschichte|gegründet|erbaut|residenz|festival|papst|palast|brücke|burg|schloss|tempel|kathedrale|vulkan|gebirge|nationalpark|naturpark|wasserfall|wüste|fjord|küste|rh[oô]ne|fluss|see\b/.test(lower)) score += 9;
  if (/prägt|zeichnet sich|gilt als|zählt zu|gehört zu|entstand|war zwischen|diente als|überspannt|liegt an|liegt am|liegt auf/.test(lower)) score += 5;
  if (/einwohner|verwaltungssitz|präfektur|gemeinde im|gemeinde in|departement|provinzhauptstadt|koordinaten|postleitzahl/.test(lower)) score -= 3;
  if (/^\S+ ist (?:eine|ein|die) (?:stadt|gemeinde|hauptstadt|insel|dorf)\b/.test(lower) && !/\d|unesco|historisch|fluss|küste|gebirge|see|pazifik|atlantik|mittelmeer|im (?:norden|osten|süden|westen)|auf der insel\b/.test(lower)) score -= 4;
  if (/bekannt(?:e[snr]?)? wahrzeichen|eines der bekanntesten|beliebtes reiseziel|touristenattraktion/.test(lower)) score -= 14;
  if (sentence.length > maximumLength + 80) score -= 3;
  return score;
}

export function selectLocationDescription(extract, title) {
  const candidates = sentences(extract).slice(0, 14);
  const ranked = candidates
    .map((sentence, index) => withoutParentheticalAsides(sentence))
    .filter((sentence) => sentence.length >= 35)
    .map((sentence, index) => ({ sentence, score: informativeScore(sentence, title, index), index }))
    .sort((first, second) => second.score - first.score || first.index - second.index);
  const selected = ranked.find(({ score, sentence }) => score >= 4 && shortenedSentence(sentence))?.sentence;
  return selected ? shortenedSentence(selected) : null;
}

function isUsefulStoredDescription(value) {
  const lower = plainText(value).toLocaleLowerCase("de-DE");
  if (!lower || /punktlandung|wird .* gespielt|geografischer ort/.test(lower)) return false;
  return /unesco|weltkulturerbe|wahrzeichen|ber(?:ü|ue)hmt|bekannt|bedeutend|historisch|gegründet|erbaut|residenz|festival|palast|brücke|burg|schloss|tempel|kathedrale|vulkan|nationalpark|wasserfall|fjord/.test(lower);
}

async function fetchEntityMetadata(ids) {
  const url = new URL(wikidataEndpoint);
  url.searchParams.set("action", "wbgetentities");
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");
  url.searchParams.set("props", "sitelinks|descriptions");
  url.searchParams.set("languages", "de");
  url.searchParams.set("sitefilter", "dewiki");
  url.searchParams.set("ids", ids.join("|"));
  const response = await fetch(url, { headers: { "user-agent": userAgent } });
  if (!response.ok) throw new Error(`Wikidata request failed with ${response.status}`);
  const payload = await response.json();
  const entities = Array.isArray(payload.entities) ? payload.entities : Object.values(payload.entities ?? {});
  return new Map(entities.flatMap((entity) => entity.id ? [[entity.id, {
    articleTitle: entity.sitelinks?.dewiki?.title ?? null,
    wikidataDescription: entity.descriptions?.de?.value ?? null
  }]] : []));
}

async function fetchWikipediaExtracts(titles) {
  const url = new URL(wikipediaEndpoint);
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");
  url.searchParams.set("prop", "extracts");
  url.searchParams.set("exintro", "1");
  url.searchParams.set("explaintext", "1");
  url.searchParams.set("exchars", "1800");
  url.searchParams.set("redirects", "1");
  url.searchParams.set("titles", titles.join("|"));
  const response = await fetch(url, { headers: { "user-agent": userAgent } });
  if (!response.ok) throw new Error(`Wikipedia request failed with ${response.status}`);
  const payload = await response.json();
  const pages = new Map((payload.query?.pages ?? []).flatMap((page) => page.title && page.extract ? [[page.title, page.extract]] : []));
  const aliases = new Map([
    ...(payload.query?.normalized ?? []).map(({ from, to }) => [from, to]),
    ...(payload.query?.redirects ?? []).map(({ from, to }) => [from, to])
  ]);
  const canonicalTitle = (title) => {
    let current = title;
    const visited = new Set();
    while (aliases.has(current) && !visited.has(current)) {
      visited.add(current);
      current = aliases.get(current);
    }
    return current;
  };
  return new Map(titles.flatMap((title) => {
    const extract = pages.get(canonicalTitle(title)) ?? pages.get(title);
    return extract ? [[title, extract]] : [];
  }));
}

const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
const ids = [...new Set(catalog.map((location) => location.wikidataId).filter((id) => /^Q\d+$/.test(id)))];
const metadata = new Map();
for (let index = 0; index < ids.length; index += wikidataBatchSize) {
  const fetched = await fetchEntityMetadata(ids.slice(index, index + wikidataBatchSize));
  fetched.forEach((value, key) => metadata.set(key, value));
}

const titles = [...new Set([...metadata.values()].map(({ articleTitle }) => articleTitle).filter(Boolean))];
const extracts = new Map();
for (let index = 0; index < titles.length; index += wikipediaBatchSize) {
  const fetched = await fetchWikipediaExtracts(titles.slice(index, index + wikipediaBatchSize));
  fetched.forEach((value, key) => extracts.set(key, value));
}

const descriptions = new Map();
for (const [id, entity] of metadata) {
  const articleDescription = entity.articleTitle
    ? selectLocationDescription(extracts.get(entity.articleTitle), entity.articleTitle)
    : null;
  const fallback = isUsefulStoredDescription(entity.wikidataDescription)
    ? shortenedSentence(entity.wikidataDescription)
    : null;
  if (!articleDescription && !fallback) continue;
  descriptions.set(id, {
    description: articleDescription ?? fallback,
    sourceUrl: articleDescription
      ? `https://de.wikipedia.org/wiki/${encodeURIComponent(entity.articleTitle.replace(/ /g, "_"))}`
      : `https://www.wikidata.org/wiki/${id}`
  });
}

let updated = 0;
let unresolved = 0;
const enriched = catalog.map((location) => {
  const resolved = descriptions.get(location.wikidataId);
  const { shortDescription: _oldDescription, descriptionSourceUrl: _oldSource, ...base } = location;
  if (!resolved) {
    unresolved += 1;
    return base;
  }
  if (resolved.description !== location.shortDescription || resolved.sourceUrl !== location.descriptionSourceUrl) updated += 1;
  return { ...base, shortDescription: resolved.description, descriptionSourceUrl: resolved.sourceUrl };
});

await writeFile(catalogPath, `${JSON.stringify(enriched, null, 2)}\n`, "utf8");
console.log(`Location descriptions: ${descriptions.size}/${ids.length} entities resolved, ${updated} catalog entries updated, ${unresolved} variants unresolved.`);
