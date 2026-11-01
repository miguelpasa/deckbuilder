import { riotContentSchema, type RiotContent } from "./schema";

export class RiotError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "RiotError";
  }
}

export class RiotAccessError extends RiotError {
  constructor(status: number) {
    super(
      `Riot API returned ${status}: the API key is not (yet) authorised for Riftbound content. ` +
        "Riot must approve the product registration for this key before /riftbound/content/v1/contents works.",
      status,
    );
    this.name = "RiotAccessError";
  }
}

export class RiotRateLimitError extends RiotError {
  constructor(readonly retryAfterMs?: number) {
    super("Riot API rate limit exceeded (429) after all retries", 429);
    this.name = "RiotRateLimitError";
  }
}

export class RiotServerError extends RiotError {
  constructor(status: number) {
    super(`Riot API server error (${status}) after all retries`, status);
    this.name = "RiotServerError";
  }
}

export class RiotResponseError extends RiotError {
  constructor(message: string, status?: number) {
    super(message, status);
    this.name = "RiotResponseError";
  }
}

export interface RiotClientOptions {
  apiKey?: string;
  region?: string;
  locale?: string;
  timeoutMs?: number;
  maxRetries?: number;
  baseDelayMs?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Parses a Retry-After header (seconds or HTTP date) into milliseconds. */
export function parseRetryAfter(value: string | null, now = Date.now()): number | undefined {
  if (!value) return undefined;
  const secs = Number(value);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const date = Date.parse(value);
  if (!Number.isNaN(date)) return Math.max(0, date - now);
  return undefined;
}

export function contentUrl(region: string, locale: string): string {
  return `https://${region}.api.riotgames.com/riftbound/content/v1/contents?locale=${encodeURIComponent(locale)}`;
}

/** Fetches the raw (unvalidated) JSON content payload. */
export async function fetchRiotContentRaw(options: RiotClientOptions = {}): Promise<unknown> {
  const apiKey = options.apiKey ?? process.env.RIOT_API_KEY;
  if (!apiKey) throw new RiotError("RIOT_API_KEY is not set");
  const region = options.region ?? process.env.RIOT_REGION ?? "americas";
  const locale = options.locale ?? "en_US";
  const timeoutMs = options.timeoutMs ?? 30_000;
  const maxRetries = options.maxRetries ?? 4;
  const baseDelayMs = options.baseDelayMs ?? 500;
  const doFetch = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  const url = contentUrl(region, locale);

  let lastRetryAfter: number | undefined;
  for (let attempt = 0; ; attempt++) {
    let res: Response | undefined;
    let networkError: unknown;
    try {
      res = await doFetch(url, {
        headers: { "X-Riot-Token": apiKey, Accept: "application/json" },
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      });
    } catch (err) {
      networkError = err;
    }

    if (res) {
      if (res.ok) {
        try {
          return await res.json();
        } catch {
          throw new RiotResponseError("Riot API returned a non-JSON body", res.status);
        }
      }
      if (res.status === 401 || res.status === 403) throw new RiotAccessError(res.status);
      if (res.status !== 429 && res.status < 500) {
        throw new RiotResponseError(`Riot API request failed with status ${res.status}`, res.status);
      }
      lastRetryAfter = parseRetryAfter(res.headers.get("Retry-After"));
    }

    if (attempt >= maxRetries) {
      if (res?.status === 429) throw new RiotRateLimitError(lastRetryAfter);
      if (res) throw new RiotServerError(res.status);
      throw new RiotResponseError(
        `Riot API request failed: ${networkError instanceof Error ? networkError.message : String(networkError)}`,
      );
    }

    const backoff = baseDelayMs * 2 ** attempt;
    await sleep(res?.status === 429 && lastRetryAfter !== undefined ? lastRetryAfter : backoff);
  }
}

/** Fetches and validates the Riftbound content catalog. */
export async function fetchRiotContent(options: RiotClientOptions = {}): Promise<RiotContent> {
  const raw = await fetchRiotContentRaw(options);
  const parsed = riotContentSchema.safeParse(raw);
  if (!parsed.success) {
    throw new RiotResponseError(`Riot content failed validation: ${parsed.error.message.slice(0, 500)}`);
  }
  return parsed.data;
}

