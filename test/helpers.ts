// SPDX-License-Identifier: MIT
import { vi } from 'vitest';

export interface Call {
  url: string;
  path: string;
  headers: Record<string, string>;
  credentials?: RequestCredentials;
  body: any;
}

type Reply = number | 'network' | (() => Promise<Response>);

/**
 * Stubs global fetch. Each request takes the next reply from `replies`
 * (status code, 'network' to reject), then falls back to 202.
 */
export function mockFetch(...replies: Reply[]) {
  const calls: Call[] = [];
  const fn = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({
      url,
      path: new URL(url, 'http://x').pathname,
      headers: init.headers as Record<string, string>,
      credentials: init.credentials,
      body: JSON.parse(init.body as string),
    });
    const r = replies.shift() ?? 202;
    if (r == 'network') throw new TypeError('Failed to fetch');
    if (typeof r == 'function') return r();
    return new Response(r == 202 ? '{}' : null, { status: r });
  });
  vi.stubGlobal('fetch', fn);
  return {
    fn,
    calls,
    feedback: () => calls.filter((c) => c.path.endsWith('/v1/feedback')),
    impressions: () => calls.filter((c) => c.path.endsWith('/v1/impressions')),
  };
}

/** Controllable IntersectionObserver: call FakeIO.show(el, ratio) to simulate visibility. */
export class FakeIO {
  static all: FakeIO[] = [];
  targets = new Set<Element>();
  constructor(
    public cb: IntersectionObserverCallback,
    public opts?: IntersectionObserverInit,
  ) {
    FakeIO.all.push(this);
  }
  observe(el: Element) {
    this.targets.add(el);
  }
  unobserve(el: Element) {
    this.targets.delete(el);
  }
  disconnect() {
    this.targets.clear();
  }
  takeRecords() {
    return [];
  }
  static show(el: Element, ratio = 1) {
    for (const io of [...FakeIO.all]) {
      if (!io.targets.has(el)) continue;
      const entry = { target: el, isIntersecting: ratio > 0, intersectionRatio: ratio } as unknown as IntersectionObserverEntry;
      io.cb([entry], io as unknown as IntersectionObserver);
    }
  }
}

export interface Mounted {
  el: HTMLElement;
  sr: ShadowRoot;
  events: { type: string; detail: any }[];
  btn: (score: number) => HTMLButtonElement;
  q: <T extends Element = HTMLElement>(sel: string) => T;
  form: () => HTMLFormElement;
  thanks: () => HTMLElement;
}

export const BASE = { 'project-key': 'pk_test_123', type: 'thumbs', surface: 'assistant-answer', endpoint: 'https://api.test' };

/** Creates <user-reactions> with attributes, appends it and records its events from `document`. */
export function mount(attrs: Record<string, string | null> = {}): Mounted {
  const el = document.createElement('user-reactions');
  for (const [k, v] of Object.entries({ ...BASE, ...attrs })) if (v != null) el.setAttribute(k, v);
  const events: Mounted['events'] = [];
  for (const t of ['rated', 'commented', 'error'])
    document.addEventListener(`user-reactions:${t}`, (e) => {
      if (e.target === el) events.push({ type: t, detail: (e as CustomEvent).detail });
    });
  document.body.append(el);
  const sr = el.shadowRoot!;
  const q = <T extends Element = HTMLElement>(sel: string) => sr.querySelector(sel) as T;
  return {
    el,
    sr,
    events,
    q,
    btn: (s) => q<HTMLButtonElement>(`button[data-s="${s}"]`),
    form: () => q<HTMLFormElement>('form'),
    thanks: () => q('[part=thanks]'),
  };
}

/** Lets queued promises and microtasks settle (real timers). */
export const flush = () => new Promise((r) => setTimeout(r, 0));

/** Types into the comment box and presses Send. */
export function comment(m: Mounted, text: string) {
  const ta = m.q<HTMLTextAreaElement>('textarea');
  ta.value = text;
  m.q<HTMLButtonElement>('[part=send]').click();
}
