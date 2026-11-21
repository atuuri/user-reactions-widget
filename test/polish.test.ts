// SPDX-License-Identifier: MIT
// M3 Polish: fi/sv strings, attribute reset, dark-mode colours, reduced motion, beta findings.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../src/index';
import { LANGS, language, strings } from '../src/strings';
import { FakeIO, comment, flush, mount, mockFetch, type Mounted } from './helpers';

beforeEach(() => {
  FakeIO.all = [];
  vi.stubGlobal('IntersectionObserver', FakeIO);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

const TYPES = ['thumbs', 'csat', 'ces'] as const;

/** Every string a user can see or hear: text, labels, tooltips and the placeholder (style excluded). */
function visible(m: Mounted) {
  const out: string[] = [];
  const walk = (n: Node) => {
    if (n.nodeName == 'STYLE') return;
    if (n.nodeType == 3 && n.textContent!.trim()) out.push(n.textContent!.trim());
    if (n instanceof Element) for (const a of ['aria-label', 'title', 'placeholder']) if (n.getAttribute(a)) out.push(n.getAttribute(a)!);
    n.childNodes.forEach(walk);
  };
  walk(m.sr);
  return out;
}

/** Renders a type with every string showing: question, buttons, captions, comment box, Send and thanks. */
function full(type: string, lang: string | null) {
  mockFetch();
  const m = mount({ type, lang, comment: 'optional' });
  m.btn(1).click();
  comment(m, ''); // empty Send shows thanks without posting
  m.form().hidden = false; // keep the box in view for the check
  return m;
}

describe('fi/sv strings', () => {
  it('every language has every key, and scales have the right number of points', () => {
    for (const [lang, s] of Object.entries(LANGS)) {
      expect(Object.keys(s).sort(), lang).toEqual(Object.keys(LANGS.en).sort());
      expect(s.csatPoints, lang).toHaveLength(5);
      expect(s.cesPoints, lang).toHaveLength(7);
      for (const v of Object.values(s).flat()) expect(v.trim(), lang).not.toBe('');
    }
  });

  it.each([
    ['fi', 'fi'],
    ['fi-FI', 'fi'],
    ['FI_fi', 'fi'],
    ['sv', 'sv'],
    ['sv-SE', 'sv'],
    ['sv-FI', 'sv'],
    ['en-GB', 'en'],
    ['de', 'en'],
    ['constructor', 'en'],
    ['', 'en'],
    [undefined, 'en'],
  ])('lang %s uses %s', (lang, expected) => {
    expect(language(lang)).toBe(expected);
    expect(strings(lang)).toBe(LANGS[expected]);
  });

  describe.each(['fi', 'fi-FI', 'sv', 'sv-SE'])('lang="%s"', (lang) => {
    const s = strings(lang);
    const english = new Set(Object.values(LANGS.en).flat().flatMap((t) => [t, t[0].toUpperCase() + t.slice(1)]));

    it.each(TYPES)('%s: every visible string and label is translated', (type) => {
      const m = full(type, lang);
      const seen = visible(m);
      expect(seen).toContain(s[type]);
      expect(seen).toContain(s.placeholder);
      expect(seen).toContain(s.send);
      expect(seen).toContain(s.thanks);
      for (const t of seen) expect(english.has(t), `"${t}" is English`).toBe(false);
      for (const el of m.sr.querySelectorAll('div, form')) expect(el.getAttribute('lang')).toBe(language(lang));
    });
  });

  it('thumbs labels and scale labels/captions use the language', () => {
    mockFetch();
    const t = mount({ lang: 'sv' });
    expect(t.btn(1).getAttribute('aria-label')).toBe('Till hjälp');
    expect(t.btn(0).title).toBe('Inte till hjälp');
    const c = mount({ type: 'csat', lang: 'fi-FI' });
    expect(c.btn(1).getAttribute('aria-label')).toBe('1 / 5 – erittäin tyytymätön');
    expect([...c.sr.querySelectorAll('[part=scale-label] span')].map((e) => e.textContent)).toEqual(['Erittäin tyytymätön', 'Erittäin tyytyväinen']);
    const e = mount({ type: 'ces', lang: 'sv' });
    expect(e.btn(7).title).toBe('7 av 7 – mycket lätt');
  });

  it('unknown languages show English and still send the given locale', async () => {
    const net = mockFetch();
    const m = mount({ lang: 'de-DE' });
    expect(m.q('[part=question]').textContent).toBe('Was this helpful?');
    expect(m.q('div').getAttribute('lang')).toBe('en');
    m.btn(1).click();
    await flush();
    expect(net.feedback()[0].body.locale).toBe('de-DE');
  });
});

describe('attribute reset (behaviour 8)', () => {
  it.each([
    ['subject', 'msg_2'],
    ['meta', '{"model":"gpt-y"}'],
  ])('changing %s gives a new id, clears the selection, box and thanks, and sends one new impression', async (name, value) => {
    const net = mockFetch();
    const m = mount({ subject: 'msg_1', comment: 'on-negative' });
    FakeIO.show(m.el);
    m.btn(0).click();
    comment(m, 'Wrong');
    await flush();
    expect(m.thanks().textContent).not.toBe('');
    const oldId = net.feedback()[0].body.id;

    m.el.setAttribute(name, value);
    expect(m.sr.querySelectorAll('[aria-pressed=true]')).toHaveLength(0);
    expect(m.sr.querySelectorAll('[aria-disabled]')).toHaveLength(0);
    expect(m.form().hidden).toBe(true);
    expect(m.q<HTMLTextAreaElement>('textarea').value).toBe('');
    expect(m.thanks().textContent).toBe('');

    FakeIO.show(m.el);
    FakeIO.show(m.el);
    await flush();
    expect(net.impressions()).toHaveLength(2);
    if (name == 'subject') expect(net.impressions()[1].body.subject).toBe('msg_2');

    m.btn(1).click();
    await flush();
    const last = net.feedback().at(-1)!.body;
    expect(last.id).not.toBe(oldId);
    expect(last.score).toBe(1);
    expect(name == 'subject' ? last.subject : last.meta).toEqual(name == 'subject' ? 'msg_2' : { model: 'gpt-y' });
    expect(m.events.filter((e) => e.type == 'rated').at(-1)!.detail.id).toBe(last.id);
  });

  it.each([
    ['type', 'csat'],
    ['lang', 'fi'],
    ['question', 'Did this answer help?'],
    ['comment', 'optional'],
  ])('changing %s re-renders as a new instance', async (name, value) => {
    const net = mockFetch();
    const m = mount();
    FakeIO.show(m.el);
    m.btn(1).click();
    await flush();
    m.el.setAttribute(name, value);
    expect(m.sr.querySelectorAll('[aria-pressed=true]')).toHaveLength(0);
    expect(m.thanks().textContent).toBe('');
    if (name == 'type') expect(m.sr.querySelectorAll('button[data-s]')).toHaveLength(5);
    if (name == 'lang') expect(m.q('[part=question]').textContent).toBe('Oliko tästä apua?');
    if (name == 'question') expect(m.q('[part=question]').textContent).toBe(value);
    FakeIO.show(m.el);
    m.btn(1).click();
    if (name == 'comment') expect(m.form().hidden).toBe(false);
    await flush();
    expect(net.impressions()).toHaveLength(2);
    expect(net.feedback()[1].body.id).not.toBe(net.feedback()[0].body.id);
  });

  it('setting an attribute to the same value changes nothing', async () => {
    const net = mockFetch();
    const m = mount({ subject: 'msg_1' });
    m.btn(1).click();
    m.el.setAttribute('subject', 'msg_1');
    expect(m.btn(1).getAttribute('aria-pressed')).toBe('true');
    m.btn(0).click();
    await flush();
    expect(new Set(net.feedback().map((c) => c.body.id)).size).toBe(1);
  });

  it('several changes before the element is visible still send exactly one impression', async () => {
    const net = mockFetch();
    const m = mount({ subject: 'msg_1' });
    m.el.setAttribute('subject', 'msg_2');
    m.el.setAttribute('meta', '{"a":"b"}');
    FakeIO.show(m.el);
    FakeIO.show(m.el);
    await flush();
    expect(net.impressions()).toHaveLength(1);
    expect(net.impressions()[0].body.subject).toBe('msg_2');
  });

  it('a reused node never re-sends with the old id, even when an old request finishes late', async () => {
    vi.useFakeTimers();
    const net = mockFetch('network', 'network');
    const m = mount({ subject: 'msg_1', comment: 'on-negative' });
    m.btn(0).click();
    comment(m, 'Slow comment');
    m.el.setAttribute('subject', 'msg_2'); // while the rating is still retrying
    await vi.advanceTimersByTimeAsync(1000);
    const oldId = net.feedback()[0].body.id;
    // The old comment still goes out with the old id, but cannot lock or thank the new instance.
    expect(m.sr.querySelectorAll('[aria-disabled]')).toHaveLength(0);
    expect(m.thanks().textContent).toBe('');
    m.btn(1).click();
    await vi.advanceTimersByTimeAsync(0);
    const fresh = net.feedback().filter((c) => c.body.subject == 'msg_2');
    expect(fresh).toHaveLength(1);
    expect(fresh[0].body.id).not.toBe(oldId);
    expect(m.events.filter((e) => e.type == 'commented')).toHaveLength(0);
  });

  it('a change while disconnected re-renders and the impression waits until connected', async () => {
    const net = mockFetch();
    const m = mount({ subject: 'msg_1' });
    m.el.remove();
    m.el.setAttribute('subject', 'msg_2');
    expect(FakeIO.all.every((io) => io.targets.size == 0)).toBe(true);
    document.body.append(m.el);
    FakeIO.show(m.el);
    await flush();
    expect(net.impressions().map((c) => c.body.subject)).toEqual(['msg_2']);
  });

  it('an invalid element recovers once its type is fixed', async () => {
    mockFetch();
    const m = mount({ type: 'nps' });
    expect(m.sr.querySelector('button')).toBeNull();
    m.el.setAttribute('type', 'thumbs');
    expect(m.sr.querySelectorAll('button[data-s]')).toHaveLength(2);
    m.el.setAttribute('type', 'bad');
    expect(m.sr.querySelector('button')).toBeNull();
    await flush();
    expect(m.events.map((e) => e.detail?.code)).toEqual(['invalid-attribute', 'invalid-attribute']);
  });
});

describe('after a final failed send', () => {
  it('removes the thanks message, keeps the selection, and clicking again resends and thanks', async () => {
    vi.useFakeTimers();
    const net = mockFetch('network', 'network');
    const m = mount();
    m.btn(1).click();
    expect(m.thanks().textContent).toBe('Thanks for your feedback');
    await vi.advanceTimersByTimeAsync(1000);
    expect(m.events.at(-1)!.type).toBe('error');
    expect(m.thanks().textContent).toBe('');
    expect(m.btn(1).getAttribute('aria-pressed')).toBe('true');

    m.btn(1).click();
    expect(m.thanks().textContent).toBe('Thanks for your feedback');
    await vi.advanceTimersByTimeAsync(0);
    expect(net.feedback()).toHaveLength(3);
    expect(m.thanks().textContent).toBe('Thanks for your feedback');
  });

  it('a failed earlier send does not remove thanks for a later one that succeeds', async () => {
    vi.useFakeTimers();
    mockFetch('network', 'network', 202);
    const m = mount();
    m.btn(1).click();
    m.btn(0).click();
    await vi.advanceTimersByTimeAsync(1000);
    expect(m.thanks().textContent).toBe('Thanks for your feedback');
  });
});

describe('styling', () => {
  const css = () => mount().sr.querySelector('style')!.textContent!;
  const NO_PREF = /@media \(prefers-reduced-motion:no-preference\)\{((?:[^{}]*\{[^{}]*\})*)\}/;

  it('reduced motion: transitions and animations only under prefers-reduced-motion: no-preference', () => {
    mockFetch();
    const s = css();
    const m = s.match(NO_PREF);
    expect(m?.[1]).toMatch(/transition:/);
    expect(s.replace(NO_PREF, '')).not.toMatch(/transition|animation|@keyframes/);
  });

  it('dark pages: colours come from currentColor, --ur-* or system colours, never fixed values', () => {
    mockFetch();
    const s = css();
    expect(s).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
    expect(s).toContain('border:1px solid GrayText');
    expect(s).toMatch(/:focus-visible\{outline:2px solid var\(--ur-accent,currentColor\)/);
    expect(s).toMatch(/\[aria-pressed=true\]\{[^}]*box-shadow:inset 0 0 0 1px var\(--ur-accent,currentColor\)/);
    expect(s).toMatch(/::placeholder\{color:inherit/);
  });

  it('caps the comment box radius at 12px so a pill --ur-radius does not round it', () => {
    mockFetch();
    expect(css()).toMatch(/textarea\{[^}]*border-radius:min\(var\(--ur-radius,6px\),12px\)/);
  });
});
