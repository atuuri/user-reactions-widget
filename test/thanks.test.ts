// SPDX-License-Identifier: MIT
// M5 Replace with thanks: after-send="replace" (default) and "keep", the thanks attribute.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../src/index';
import { LANGS } from '../src/strings';
import { FakeIO, comment, flush, mount, mockFetch, type Mounted } from './helpers';

beforeEach(() => {
  FakeIO.all = [];
  vi.stubGlobal('IntersectionObserver', FakeIO);
});
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

const THANKS = LANGS.en.thanks;

/** Default mode: the helpers pin after-send="keep" for the M1–M3 suites, so clear it here. */
const replace = (attrs: Record<string, string | null> = {}) => mount({ 'after-send': null, ...attrs });

/** A reply the test resolves by hand, to look at the element while a request is in flight. */
function deferred() {
  let resolve!: (status: number) => void;
  const reply = () => new Promise<Response>((r) => (resolve = (s) => r(new Response(s == 202 ? '{}' : null, { status: s }))));
  // The request starts after queued promises settle, so wait for it before answering.
  return {
    reply,
    resolve: async (s = 202) => {
      await flush();
      resolve(s);
    },
  };
}

function isReplaced(m: Mounted) {
  return !m.q('[data-s]') && !m.q('[part=question]') && !m.q('form') && !m.q('.g');
}

describe('after-send="replace" (default)', () => {
  it('thumbs with no comment box: once the rating is accepted, only the thanks text is left', async () => {
    const d = deferred();
    mockFetch(d.reply);
    const m = replace();
    m.btn(1).click();
    expect(m.btn(1).getAttribute('aria-pressed')).toBe('true'); // not replaced while in flight
    await d.resolve();
    await flush();
    expect(isReplaced(m)).toBe(true);
    expect(m.thanks().textContent).toBe(THANKS);
    expect(m.thanks().getAttribute('role')).toBe('status');
    expect(m.q('button')).toBeNull();
  });

  it.each(['replace', 'bogus', ''])('after-send="%s" acts as replace', async (v) => {
    mockFetch();
    const m = replace({ 'after-send': v });
    m.btn(0).click();
    await flush();
    expect(isReplaced(m)).toBe(true);
  });

  it('scales: a score with no comment box replaces the element too', async () => {
    mockFetch();
    const m = replace({ type: 'csat', comment: 'on-negative' });
    m.btn(4).click();
    await flush();
    expect(isReplaced(m)).toBe(true);
    expect(m.q('[part=scale-label]')).toBeNull();
  });

  it('changing the rating before the first response waits for the latest one', async () => {
    const a = deferred();
    const b = deferred();
    const f = mockFetch(a.reply, b.reply);
    const m = replace();
    m.btn(1).click();
    m.btn(0).click();
    await a.resolve();
    await flush();
    expect(isReplaced(m)).toBe(false);
    await b.resolve();
    await flush();
    expect(isReplaced(m)).toBe(true);
    expect(f.feedback().map((c) => c.body.score)).toEqual([1, 0]);
  });

  it('with a comment box: replaced only after the comment is accepted; the rating can change until then', async () => {
    const f = mockFetch();
    const m = replace({ comment: 'optional' });
    m.btn(1).click();
    await flush();
    expect(isReplaced(m)).toBe(false);
    m.btn(0).click();
    await flush();
    expect(isReplaced(m)).toBe(false);
    comment(m, 'Wrong answer');
    await flush();
    expect(isReplaced(m)).toBe(true);
    expect(m.thanks().textContent).toBe(THANKS);
    expect(m.events.filter((e) => e.type == 'commented')).toHaveLength(1);
    expect(f.feedback().map((c) => [c.body.score, c.body.comment])).toEqual([
      [1, undefined],
      [0, undefined],
      [0, 'Wrong answer'],
    ]);
  });

  it('on-negative: a thumbs down with the box open is not replaced by its own rating response', async () => {
    mockFetch();
    const m = replace({ comment: 'on-negative' });
    m.btn(0).click();
    await flush();
    expect(m.form().hidden).toBe(false);
    expect(isReplaced(m)).toBe(false);
  });

  it('an empty Send is final once the rating is accepted, and posts nothing', async () => {
    const d = deferred();
    const f = mockFetch(d.reply);
    const m = replace({ comment: 'optional' });
    m.btn(1).click();
    comment(m, '   ');
    await flush();
    expect(isReplaced(m)).toBe(false); // rating still in flight
    await d.resolve();
    await flush();
    expect(isReplaced(m)).toBe(true);
    expect(f.feedback()).toHaveLength(1);
    expect(m.events.filter((e) => e.type == 'commented')).toHaveLength(0);
  });

  it('an empty Send after a failed rating replaces nothing', async () => {
    mockFetch(400);
    const m = replace({ comment: 'optional' });
    m.btn(1).click();
    await flush();
    comment(m, '');
    await flush();
    expect(isReplaced(m)).toBe(false);
    expect(m.events.filter((e) => e.type == 'error')).toHaveLength(1);
  });

  it('a failed rating replaces nothing: error fires, the selection stays, clicking again resends', async () => {
    const f = mockFetch(400);
    const m = replace();
    m.btn(1).click();
    await flush();
    expect(isReplaced(m)).toBe(false);
    expect(m.btn(1).getAttribute('aria-pressed')).toBe('true');
    expect(m.thanks().textContent).toBe('');
    expect(m.events.map((e) => e.type)).toEqual(['rated', 'error']);
    m.btn(1).click();
    await flush();
    expect(f.feedback()).toHaveLength(2);
    expect(isReplaced(m)).toBe(true);
  });

  it('a failed comment replaces nothing and keeps its text', async () => {
    mockFetch(202, 400);
    const m = replace({ comment: 'optional' });
    m.btn(0).click();
    await flush();
    comment(m, 'Too long');
    await flush();
    expect(isReplaced(m)).toBe(false);
    expect(m.q<HTMLTextAreaElement>('textarea').value).toBe('Too long');
    expect(m.events.at(-1)?.type).toBe('error');
  });

  it('focus on a rating button moves to the thanks text', async () => {
    mockFetch();
    const m = replace();
    m.btn(1).focus();
    m.btn(1).click();
    await flush();
    expect(m.sr.activeElement).toBe(m.thanks());
    expect(m.thanks().tabIndex).toBe(-1);
  });

  it('focus on Send moves to the thanks text', async () => {
    mockFetch();
    const m = replace({ comment: 'optional' });
    m.btn(1).click();
    await flush();
    m.q<HTMLButtonElement>('[part=send]').focus();
    comment(m, 'Nice');
    await flush();
    expect(m.sr.activeElement).toBe(m.thanks());
  });

  it('focus elsewhere is left alone', async () => {
    mockFetch();
    const m = replace();
    m.btn(1).click();
    await flush();
    expect(m.sr.activeElement).toBeNull();
    expect(m.thanks().hasAttribute('tabindex')).toBe(false);
  });

  it('the swap is marked for the fade, which runs only under prefers-reduced-motion: no-preference', async () => {
    mockFetch();
    const m = replace();
    m.btn(1).click();
    await flush();
    expect(m.thanks().parentElement!.classList.contains('d')).toBe(true);
    const css = m.q('style').textContent!;
    expect(css).toMatch(/@media \(prefers-reduced-motion:no-preference\)\{[^@]*\.d\{animation:/);
  });

  it.each([
    ['subject', 'msg_2'],
    ['meta', '{"model":"b"}'],
  ])('changing %s after the swap brings back the full element as a new instance', async (name, value) => {
    const f = mockFetch();
    const m = replace({ subject: 'msg_1', meta: '{"model":"a"}' });
    FakeIO.show(m.el);
    m.btn(1).click();
    await flush();
    expect(isReplaced(m)).toBe(true);
    const first = f.feedback()[0].body.id;
    m.el.setAttribute(name, value);
    expect(isReplaced(m)).toBe(false);
    expect(m.btn(1).getAttribute('aria-pressed')).toBe('false');
    FakeIO.show(m.el);
    await flush();
    expect(f.impressions()).toHaveLength(2);
    m.btn(0).click();
    await flush();
    expect(f.feedback()[1].body.id).not.toBe(first);
    expect(isReplaced(m)).toBe(true);
  });

  it('a late response for an earlier instance does not replace a reset element', async () => {
    const d = deferred();
    mockFetch(d.reply);
    const m = replace({ subject: 'msg_1' });
    m.btn(1).click();
    m.el.setAttribute('subject', 'msg_2');
    await d.resolve();
    await flush();
    expect(isReplaced(m)).toBe(false);
  });

  it('after-send is read when feedback becomes final', async () => {
    const d = deferred();
    mockFetch(d.reply);
    const m = replace();
    m.btn(1).click();
    m.el.setAttribute('after-send', 'keep');
    await d.resolve();
    await flush();
    expect(isReplaced(m)).toBe(false);
    expect(m.thanks().textContent).toBe(THANKS);
    expect(m.btn(1).getAttribute('aria-pressed')).toBe('true'); // no reset either
  });

  it('lang="fi" shows the Finnish thanks', async () => {
    mockFetch();
    const m = replace({ lang: 'fi' });
    m.btn(1).click();
    await flush();
    expect(m.thanks().textContent).toBe(LANGS.fi.thanks);
  });
});

describe('after-send="keep"', () => {
  it('keeps the question and buttons after thanks, as in 0.1.0', async () => {
    mockFetch();
    const m = mount({ 'after-send': 'keep' });
    m.btn(1).click();
    await flush();
    expect(isReplaced(m)).toBe(false);
    expect(m.thanks().textContent).toBe(THANKS);
    m.btn(0).click();
    expect(m.btn(0).getAttribute('aria-pressed')).toBe('true');
  });
});

describe('thanks attribute', () => {
  it.each(['replace', 'keep'])('after-send="%s": overrides the thanks text, as given', async (mode) => {
    mockFetch();
    const m = mount({ 'after-send': mode, lang: 'fi', thanks: 'Thanks, this helps us improve' });
    m.btn(1).click();
    await flush();
    expect(m.thanks().textContent).toBe('Thanks, this helps us improve');
  });

  it('after a comment, too', async () => {
    mockFetch();
    const m = mount({ 'after-send': 'keep', comment: 'optional', thanks: 'Got it' });
    m.btn(0).click();
    comment(m, 'Hm');
    await flush();
    expect(m.thanks().textContent).toBe('Got it');
  });

  it.each(['', '   '])('thanks="%s" keeps the default', async (v) => {
    mockFetch();
    const m = replace({ thanks: v });
    m.btn(1).click();
    await flush();
    expect(m.thanks().textContent).toBe(THANKS);
  });

  it('changing thanks does not reset the element', () => {
    mockFetch();
    const m = replace();
    m.btn(1).click();
    m.el.setAttribute('thanks', 'Other');
    expect(m.btn(1).getAttribute('aria-pressed')).toBe('true');
  });
});
