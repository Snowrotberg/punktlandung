import type { RankedPromptAsset, RankedPromptAssetReader } from "./rankedGameHttp.server";

const defaultHosts = ["commons.wikimedia.org", "upload.wikimedia.org", "thumb.wikimedia.org"];
const allowedImageTypes = new Set(["image/avif", "image/gif", "image/jpeg", "image/png", "image/webp"]);
const rankedPromptWidth = 1200;

function wikimediaRasterTarget(url: URL): URL {
  const hostname = url.hostname.toLowerCase();
  const prefixes = ["/wiki/Special:FilePath/", "/wiki/Special:Redirect/file/"];
  const prefix = hostname === "commons.wikimedia.org"
    ? prefixes.find((candidate) => url.pathname.startsWith(candidate))
    : null;
  const uploadFile = hostname === "upload.wikimedia.org" && !url.pathname.includes("/thumb/")
    ? url.pathname.split("/").filter(Boolean).at(-1)
    : null;
  if (!prefix && !uploadFile) return url;
  let title: string;
  try {
    title = decodeURIComponent(prefix ? url.pathname.slice(prefix.length) : uploadFile!);
  } catch {
    return url;
  }
  const rasterUrl = new URL(`https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(title)}`);
  rasterUrl.searchParams.set("width", String(rankedPromptWidth));
  return rasterUrl;
}

export type SafeRankedPromptAssetReaderOptions = {
  allowedHosts?: readonly string[];
  fetchImpl?: typeof fetch;
  maxBytes?: number;
  timeoutMs?: number;
  maxRedirects?: number;
};

/** Fetches ranked prompt bytes server-side while preventing SSRF and source leaks. */
export class SafeRankedPromptAssetReader implements RankedPromptAssetReader {
  private readonly allowedHosts: ReadonlySet<string>;
  private readonly fetchImpl: typeof fetch;
  private readonly maxBytes: number;
  private readonly timeoutMs: number;
  private readonly maxRedirects: number;

  constructor(options: SafeRankedPromptAssetReaderOptions = {}) {
    this.allowedHosts = new Set((options.allowedHosts ?? defaultHosts).map((host) => host.toLowerCase()));
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.maxBytes = options.maxBytes ?? 18 * 1024 * 1024;
    this.timeoutMs = options.timeoutMs ?? 4_500;
    this.maxRedirects = options.maxRedirects ?? 3;
    if (this.allowedHosts.size === 0) throw new Error("At least one ranked prompt host is required.");
    if (!Number.isSafeInteger(this.maxBytes) || this.maxBytes < 1 || !Number.isSafeInteger(this.timeoutMs) || this.timeoutMs < 1) {
      throw new Error("Ranked prompt fetch limits are invalid.");
    }
    if (!Number.isInteger(this.maxRedirects) || this.maxRedirects < 0 || this.maxRedirects > 5) {
      throw new Error("Ranked prompt redirect limit is invalid.");
    }
  }

  async read(sourceUrl: string): Promise<RankedPromptAsset | null> {
    let target = this.safeUrl(sourceUrl);
    if (!target) return null;
    // Keep ranked prompts bounded by requesting a passive raster thumbnail.
    target = wikimediaRasterTarget(target);
    try {
      for (let redirects = 0; redirects <= this.maxRedirects; redirects += 1) {
        const response = await this.fetchImpl(target, {
          method: "GET",
          redirect: "manual",
          cache: "force-cache",
          signal: AbortSignal.timeout(this.timeoutMs),
          headers: {
            accept: "image/avif,image/webp,image/png,image/jpeg,image/gif",
            "user-agent": "Punktlandung/1.0 (https://punktlandung.app; aintartstudio@gmail.com)"
          }
        });
        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get("location");
          if (!location || redirects === this.maxRedirects) return null;
          target = this.safeUrl(new URL(location, target).toString());
          if (!target) return null;
          continue;
        }
        if (!response.ok) return null;
        const contentType = response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() ?? "";
        if (!allowedImageTypes.has(contentType)) return null;
        const declaredLength = Number(response.headers.get("content-length"));
        if (Number.isFinite(declaredLength) && declaredLength > this.maxBytes) return null;
        const bytes = await response.arrayBuffer();
        if (bytes.byteLength === 0 || bytes.byteLength > this.maxBytes) return null;
        return { bytes, contentType };
      }
    } catch {
      return null;
    }
    return null;
  }

  private safeUrl(value: string): URL | null {
    try {
      const url = new URL(value);
      if (url.protocol !== "https:" || url.username || url.password || url.port || !this.allowedHosts.has(url.hostname.toLowerCase())) {
        return null;
      }
      return url;
    } catch {
      return null;
    }
  }
}
