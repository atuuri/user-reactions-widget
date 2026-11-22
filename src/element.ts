// SPDX-License-Identifier: MIT
// <user-reactions> web component. Every entry point is guarded: errors surface only
// as `user-reactions:error` events and never reach the host page.
// Colours come from the host text colour, --ur-* variables or system colours, so the
// element reads on light and dark pages without configuration.

import { type ErrorCode, type FeedbackPayload, type FeedbackType, type Meta, VERSION, clean, post, uuid } from './client.js';
import { type Strings, language, strings } from './strings.js';

export const TAG = 'user-reactions';

export interface RatedDetail {
  id: string;
  type: FeedbackType;
  score: number;
  surface: string;
  subject?: string;
}
export interface CommentedDetail {
  id: string;
  comment: string;
}
export interface ErrorDetail {
  code: ErrorCode;
  message: string;
}

type CommentMode = 'off' | 'optional' | 'on-negative';

interface Config {
  type: FeedbackType;
  surface: string;
  subject?: string;
  meta?: Meta;
  mode: CommentMode;
  locale: string;
  s: Strings;
}

/** Parses the `meta` attribute: a JSON object of at most 20 string values (≤ 200 chars each). */
export function parseMeta(raw: string): Meta | undefined {
  try {
    const m = JSON.parse(raw);
    if (m && typeof m == 'object' && !Array.isArray(m)) {
      const v = Object.values(m);
      if (v.length <= 20 && v.every((x) => typeof x == 'string' && x.length <= 200)) return m;
    }
  } catch {
    /* invalid JSON */
  }
}

/** Scale size for csat/ces, and the highest score that counts as negative for comment="on-negative". */
const MAX: Record<FeedbackType, number> = { thumbs: 2, csat: 5, ces: 7 };
const NEG: Record<FeedbackType, number> = { thumbs: 0, csat: 2, ces: 3 };

const cap = (t: string) => t[0].toUpperCase() + t.slice(1);

// Own thumb glyph; the "down" button rotates it.
const ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10h4v11H3zM7 10l4-8c1.7 0 3 1.3 3 3v4h5.5c1.4 0 2.4 1.3 2.1 2.6l-1.6 7.5c-.2 1.1-1.2 1.9-2.3 1.9H7"/></svg>';

// 50% of the text colour keeps borders at ≥ 3:1 on light and dark pages; GrayText where color-mix is unsupported.
const LINE = 'border:1px solid GrayText;border:1px solid color-mix(in srgb,currentColor 50%,transparent);border-radius:var(--ur-radius,6px);background:var(--ur-bg,transparent);color:inherit;font:inherit';

const CSS =
  `:host{display:block;font-family:var(--ur-font,inherit);color:var(--ur-text,inherit)}:host([hidden]){display:none}` +
  `.r{display:flex;flex-wrap:wrap;align-items:center;gap:var(--ur-gap,.5em)}` +
  `[part=question],[part=scale-label]{color:var(--ur-muted,inherit)}` +
  `.s{align-items:baseline}.g{display:inline-flex;flex-direction:column;gap:.25em}.g>.r{flex-wrap:nowrap;gap:.3em}.n{min-width:2.2em;padding:.3em 0;justify-content:center}` +
  `[part=scale-label]{display:flex;justify-content:space-between;gap:1em;font-size:.8em}` +
  `button{${LINE};display:inline-flex;align-items:center;padding:.3em .55em;line-height:1;cursor:pointer}` +
  `button:hover{border-color:currentColor}[aria-disabled=true]{cursor:default;opacity:.7}` +
  `[aria-pressed=true]{border-color:var(--ur-accent,currentColor);box-shadow:inset 0 0 0 1px var(--ur-accent,currentColor);color:var(--ur-accent,inherit)}` +
  `svg{width:1.15em;height:1.15em;fill:none;stroke:currentColor;stroke-width:2;stroke-linejoin:round}` +
  `[aria-pressed=true] svg{fill:currentColor;fill-opacity:.25}[data-s="0"] svg{transform:rotate(180deg)}` +
  `button:focus-visible,textarea:focus-visible{outline:2px solid var(--ur-accent,currentColor);outline-offset:2px}` +
  `form{display:flex;flex-direction:column;align-items:flex-start;gap:var(--ur-gap,.5em);margin-top:var(--ur-gap,.5em);max-width:36em}` +
  `form[hidden]{display:none}textarea{${LINE};border-radius:min(var(--ur-radius,6px),12px);box-sizing:border-box;width:100%;min-height:4.5em;padding:.5em;resize:vertical}` +
  `textarea::placeholder{color:inherit;opacity:.7}` +
  `[part=thanks]:focus{outline:none}` +
  `@media (prefers-reduced-motion:no-preference){button{transition:border-color .15s,box-shadow .15s,color .15s}.d{animation:f .25s}@keyframes f{from{opacity:0}}}`;

// Lets `import "user-reactions"` succeed outside a browser (Node, SSR) for the headless client.
const Base = (typeof HTMLElement == 'undefined' ? class {} : HTMLElement) as typeof HTMLElement;

export class UserReactionsElement extends Base {
  /** Behaviour 8: a change to any of these starts a new instance (new id, new impression). */
  static observedAttributes = ['subject', 'meta', 'type', 'lang', 'question', 'comment'];

  private c?: Config;
  private fid = '';
  private score: number | null = null;
  private failed = false;
  private done = false;
  private seen = false;
  private io?: IntersectionObserver;
  private q: Promise<unknown> = Promise.resolve();
  private sr?: ShadowRoot;
  /** Instance generation; responses for an earlier generation no longer touch the UI. */
  private gen = 0;

  connectedCallback() {
    this.guard(() => {
      if (!this.sr) {
        this.sr = this.attachShadow({ mode: 'open' });
        this.init();
      }
      this.watch();
    });
  }

  attributeChangedCallback(_name: string, old: string | null, value: string | null) {
    // Before the first connect, connectedCallback renders with the final attributes.
    if (old === value || !this.sr) return;
    this.guard(() => {
      this.init();
      if (this.isConnected) this.watch();
    });
  }

  disconnectedCallback() {
    this.guard(() => this.unwatch());
  }

  private attr(name: string) {
    return this.getAttribute(name)?.trim() || undefined;
  }

  /** `after-send="keep"` keeps the buttons after thanks; anything else replaces the element. Read when feedback is final. */
  private keep() {
    return this.attr('after-send') == 'keep';
  }

  /** The `thanks` attribute, shown as given, else the built-in string. */
  private thx() {
    return this.attr('thanks') || this.c!.s.thanks;
  }

  /** Feedback is final: only the thanks text stays, and focus follows it if it was inside the element. */
  private replace() {
    const sr = this.sr!;
    const focused = sr.activeElement;
    this.done = true;
    for (const n of sr.querySelectorAll('[part=question],.g,form')) n.remove();
    const t = this.$('[part=thanks]');
    t.textContent = this.thx();
    t.parentElement!.classList.add('d');
    if (focused) {
      t.tabIndex = -1;
      t.focus();
    }
  }

  private guard(fn: () => void) {
    try {
      fn();
    } catch (e) {
      this.fail('internal', String((e as Error)?.message || e));
    }
  }

  private fail(code: ErrorCode, message: string) {
    // Deferred so listeners added right after insertion still receive config errors.
    queueMicrotask(() => this.emit<ErrorDetail>('error', { code, message }));
  }

  private emit<T>(name: string, detail: T) {
    this.dispatchEvent(new CustomEvent(`${TAG}:${name}`, { detail, bubbles: true, composed: true }));
  }

  /** Renders a fresh instance: new id, nothing selected, no comment box or thanks, impression pending. */
  private init() {
    const sr = this.sr!;
    this.unwatch();
    this.gen++;
    this.c = undefined;
    this.score = null;
    this.failed = this.done = this.seen = false;
    sr.innerHTML = '';
    const type = this.attr('type') as FeedbackType | undefined;
    const surface = this.attr('surface');
    const subject = this.attr('subject');
    const problem = !this.attr('project-key')
      ? 'project-key is required'
      : !surface || surface.length > 100
        ? 'surface is required (max 100 characters)'
        : (subject?.length ?? 0) > 200
          ? 'subject is too long (max 200 characters)'
          : !type || !(type in MAX)
            ? `type "${type ?? ''}" is not supported`
            : '';
    if (problem) return this.fail('invalid-attribute', problem);

    const rawMeta = this.attr('meta');
    const meta = rawMeta ? parseMeta(rawMeta) : undefined;
    if (rawMeta && !meta) this.fail('invalid-meta', 'meta must be a JSON object of at most 20 string values (max 200 characters each); ignored');

    const m = this.attr('comment');
    const lang = this.attr('lang') || 'en';
    const s = strings(lang);
    const ln = `lang="${language(lang)}"`;
    this.c = {
      type: type!,
      surface: surface!,
      subject,
      meta,
      mode: m == 'optional' || m == 'on-negative' ? m : 'off',
      locale: lang.slice(0, 10),
      s,
    };
    this.fid = uuid();

    // Thumbs: 👍 (1) then 👎 (0). Scales: 1..max, one Tab stop (roving tabindex) and end captions.
    const scale = type != 'thumbs';
    const max = MAX[type!];
    const values = scale ? Array.from({ length: max }, (_, i) => i + 1) : [1, 0];
    const buttons = values
      .map((v) => `<button part="button" data-s="${v}" aria-pressed="false"${scale ? ` class="n" tabindex="${v == 1 ? 0 : -1}">${v}` : `>${ICON}`}</button>`)
      .join('');
    sr.innerHTML =
      `<style>${CSS}</style><div ${ln} class="r${scale ? ' s' : ''}"><span part="question" id="q"></span>` +
      `<span class="g" role="group" aria-labelledby="q"><span class="r">${buttons}</span>` +
      (scale ? `<span part="scale-label" aria-hidden="true"><span></span><span></span></span>` : '') +
      `</span><span part="thanks" role="status"></span></div>` +
      `<form ${ln} hidden><textarea part="comment" maxlength="2000"></textarea><button part="send" type="submit"></button></form>`;

    // question="" shows only the buttons; the hidden text still labels the group for screen readers.
    const q = this.$('[part=question]');
    q.textContent = this.attr('question') || s[type!];
    q.hidden = this.getAttribute('question')?.trim() === '';
    const points = type == 'csat' ? s.csatPoints : s.cesPoints;
    if (scale) {
      const [lo, hi] = this.sr!.querySelectorAll('[part=scale-label] span');
      lo.textContent = cap(points[0]);
      hi.textContent = cap(points[max - 1]);
      this.$('.g').addEventListener('keydown', (e) => this.guard(() => this.key(e as KeyboardEvent)));
    }
    for (const b of this.buttons()) {
      const v = +b.dataset.s!;
      const label = scale ? `${v} ${s.of} ${max} – ${points[v - 1]}` : v ? s.up : s.down;
      b.setAttribute('aria-label', label);
      b.title = label;
      b.addEventListener('click', () => this.guard(() => this.rate(+b.dataset.s!)));
    }
    const ta = this.$<HTMLTextAreaElement>('textarea');
    ta.placeholder = s.placeholder;
    ta.setAttribute('aria-label', s.placeholder);
    this.$('[part=send]').textContent = s.send;
    this.$('form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.submit().catch((err) => this.fail('internal', String(err?.message || err)));
    });
  }

  private $<T extends HTMLElement = HTMLElement>(sel: string): T {
    return this.sr!.querySelector(sel) as T;
  }

  private buttons() {
    return this.sr!.querySelectorAll<HTMLButtonElement>('[data-s]');
  }

  /** Scales only: arrows move between buttons, Home/End jump to the ends. Enter/Space are native. */
  private key(e: KeyboardEvent) {
    const bs = [...this.buttons()];
    const i = bs.indexOf(this.sr!.activeElement as HTMLButtonElement);
    const k = e.key;
    const j = k == 'ArrowRight' || k == 'ArrowDown' ? i + 1 : k == 'ArrowLeft' || k == 'ArrowUp' ? i - 1 : k == 'Home' ? 0 : k == 'End' ? bs.length - 1 : null;
    if (i < 0 || j == null) return;
    e.preventDefault();
    const t = bs[Math.max(0, Math.min(bs.length - 1, j))];
    this.rove(t);
    t.focus();
  }

  /** Scales keep a single Tab stop on the focused or selected button. */
  private rove(target: HTMLButtonElement) {
    if (this.c!.type != 'thumbs') for (const b of this.buttons()) b.tabIndex = b === target ? 0 : -1;
  }

  private watch() {
    if (this.seen || this.io || !this.c || typeof IntersectionObserver == 'undefined') return;
    this.io = new IntersectionObserver(
      (entries) =>
        this.guard(() => {
          // 0.499: browsers may report the threshold crossing as a hair below 0.5.
          if (this.seen || !entries.some((e) => e.isIntersecting && e.intersectionRatio >= 0.499)) return;
          this.seen = true;
          this.unwatch();
          const { type, surface, subject } = this.c!;
          post(this.attr('endpoint'), '/v1/impressions', this.attr('project-key') || '', clean({ type, surface, subject, client: `widget@${VERSION}` })).catch(
            (e) => this.fail(e.code, e.message),
          );
        }),
      { threshold: 0.5 },
    );
    this.io.observe(this);
  }

  private unwatch() {
    this.io?.disconnect();
    this.io = undefined;
  }

  /** Queues one feedback POST; resolves true on success. Requests stay in click order. */
  private send(comment?: string): Promise<boolean> {
    const { type, surface, subject, meta, locale } = this.c!;
    const payload: FeedbackPayload = clean({ id: this.fid, type, score: this.score!, surface, subject, meta, comment, locale, client: `widget@${VERSION}` });
    const g = this.gen;
    const run = () =>
      post(this.attr('endpoint'), '/v1/feedback', this.attr('project-key') || '', payload).then(
        () => {
          if (g == this.gen) {
            this.failed = false;
            // A rating with no comment box is final once accepted, unless a newer click is queued.
            if (!comment && !this.done && this.q === p && this.$('form').hidden && !this.keep()) this.replace();
          }
          return true;
        },
        (e) => {
          this.fail(e.code, e.message);
          if (g == this.gen) {
            this.failed = true;
            // The latest send failed for good: no thanks; the selection stays so a click resends.
            if (this.q === p) this.$('[part=thanks]').textContent = '';
          }
          return false;
        },
      );
    const p: Promise<boolean> = this.q.then(run);
    this.q = p;
    return p;
  }

  private rate(score: number) {
    const c = this.c!;
    if (this.done || (score === this.score && !this.failed)) return;
    this.score = score;
    for (const b of this.buttons()) {
      const on = +b.dataset.s! === score;
      b.setAttribute('aria-pressed', String(on));
      b.setAttribute('part', on ? 'button button-selected' : 'button');
      if (on) this.rove(b);
    }
    const ask = c.mode == 'optional' || (c.mode == 'on-negative' && score <= NEG[c.type]);
    this.$('form').hidden = !ask;
    this.$('[part=thanks]').textContent = ask ? '' : this.thx();
    this.emit<RatedDetail>('rated', { id: this.fid, type: c.type, score, surface: c.surface, subject: c.subject });
    this.send();
  }

  private async submit() {
    if (this.done || this.score == null) return;
    const ta = this.$<HTMLTextAreaElement>('textarea');
    const btn = this.$<HTMLButtonElement>('[part=send]');
    const comment = ta.value.trim().slice(0, 2000);
    const keep = this.keep();
    if (comment || !keep) {
      const g = this.gen;
      btn.disabled = true;
      // An empty Send is final once the rating is accepted, so it waits for the latest rating request.
      const ok = await (comment ? this.send(comment) : this.q);
      btn.disabled = false;
      if (!ok || g != this.gen || this.done) return; // error already fired, or the element was reset; keep the text so the user can retry
      this.done = true;
      for (const b of this.buttons()) b.setAttribute('aria-disabled', 'true');
    }
    if (keep) {
      const hadFocus = this.sr!.activeElement;
      this.$('form').hidden = true;
      this.$('[part=thanks]').textContent = this.thx();
      if (hadFocus) this.$('[aria-pressed=true]').focus();
    } else this.replace();
    if (comment) this.emit<CommentedDetail>('commented', { id: this.fid, comment });
  }
}

/** Registers <user-reactions> once. No-op outside browsers or if already defined. */
export function define() {
  try {
    if (typeof customElements != 'undefined' && !customElements.get(TAG)) customElements.define(TAG, UserReactionsElement);
  } catch {
    /* never break the host page */
  }
}
