// SPDX-License-Identifier: MIT
// Headless client and shared transport. Safe to import outside a browser.

declare const __UR_VERSION__: string; // injected from package.json by vite.config.ts

export const VERSION: string = __UR_VERSION__;
export const RETRY_DELAY_MS = 1000;

/** Rating types carry a score; `open` is free text with no score. */
export type RatingType = 'thumbs' | 'csat' | 'ces';
export type FeedbackType = RatingType | 'open';
export type Meta = Record<string, string>;
export type ErrorCode = 'invalid-attribute' | 'invalid-meta' | 'network' | 'http' | 'internal';

export interface FeedbackPayload {
  id: string;
  type: FeedbackType;
  /** Ratings only; never sent for `open`. */
  score?: number;
  surface: string;
  subject?: string;
  meta?: Meta;
  comment?: string;
  locale?: string;
  client?: string;
}

export interface ImpressionPayload {
  type: FeedbackType;
  surface: string;
  subject?: string;
  client?: string;
}

interface SendCommon extends Omit<FeedbackPayload, 'id' | 'client' | 'type' | 'score' | 'comment'> {
  projectKey: string;
  /** Re-use an id to update an earlier item (server upserts). Generated when omitted. */
  id?: string;
  /** API base URL. Required until the hosted API launches. */
  endpoint?: string;
}

/** A rating with a score and optional comment, or open feedback: a comment and no score. */
export type SendFeedbackOptions = SendCommon &
  ({ type: RatingType; score: number; comment?: string } | { type: 'open'; score?: never; comment: string });

/** Error raised by the transport. `code` matches the element's `user-reactions:error` codes. */
export class ReactionsError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}

/** RFC 4122 v4 UUID. Uses crypto.randomUUID where available (secure contexts only). */
export function uuid(): string {
  const c = globalThis.crypto;
  if (c.randomUUID) {
    try {
      return c.randomUUID();
    } catch {
      /* insecure context: fall through */
    }
  }
  const b = c.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 15) | 64;
  b[8] = (b[8] & 63) | 128;
  const h = Array.from(b, (x) => (x + 256).toString(16).slice(1)).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Drops undefined and empty-string fields so payloads only carry what was set. */
export function clean<T extends object>(o: T): T {
  for (const k in o) if (o[k] === undefined || o[k] === ('' as never)) delete o[k];
  return o;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Retry only what could succeed on a second try: network errors, 429 and 5xx. */
const retryable = (e: ReactionsError) => e.code == 'network' || e.status == 429 || (e.status ?? 0) >= 500;

/**
 * POST JSON to `${endpoint}${path}`. Retries once after 1 s on retryable failures.
 * Rejects with ReactionsError. No cookies are sent. Without an endpoint nothing is sent:
 * there is no hosted API yet, so a built-in default would only produce failed requests.
 */
export async function post(endpoint: string | undefined, path: string, projectKey: string, body: object): Promise<Response> {
  if (!endpoint) throw new ReactionsError('invalid-attribute', 'endpoint is required until the hosted API launches');
  const url = endpoint.replace(/\/+$/, '') + path;
  const attempt = async () => {
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Project-Key': projectKey },
        body: JSON.stringify(body),
        credentials: 'omit',
      });
    } catch (e) {
      throw new ReactionsError('network', (e as Error)?.message || 'Network error');
    }
    if (!res.ok) throw new ReactionsError('http', `HTTP ${res.status} from ${path}`, res.status);
    return res;
  };
  try {
    return await attempt();
  } catch (e) {
    if (!retryable(e as ReactionsError)) throw e;
    await wait(RETRY_DELAY_MS);
    return attempt();
  }
}

/**
 * Send one feedback item without rendering the element (native apps, servers, chat hosts).
 * Same payload and endpoint as the element. `open` sends no score and needs a comment. Resolves with the item id; rejects with ReactionsError.
 */
export async function sendFeedback(options: SendFeedbackOptions): Promise<{ id: string }> {
  const { projectKey, endpoint, id = uuid(), type, surface, subject, meta, comment, locale } = options;
  const open = type == 'open';
  if (open && !comment?.trim()) throw new ReactionsError('invalid-attribute', 'comment is required for type "open"');
  const score = open ? undefined : options.score;
  const payload: FeedbackPayload = clean({ id, type, score, surface, subject, meta, comment, locale, client: `headless@${VERSION}` });
  await post(endpoint, '/v1/feedback', projectKey, payload);
  return { id };
}
