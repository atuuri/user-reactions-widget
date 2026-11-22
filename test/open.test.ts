// SPDX-License-Identifier: MIT
// M4 Open feedback: type="open", a toggle with a free-text box and no rating.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../src/index';
import { LANGS } from '../src/strings';
import { validateRequest } from '../tools/openapi';
import { FakeIO, flush, mount, mockFetch, type Mounted } from './helpers';

beforeEach(() => {
  FakeIO.all = [];
  vi.stubGlobal('IntersectionObserver', FakeIO);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Default after-send (replace) unless the test passes after-send="keep". */
const open = (attrs: Record<string, string | null> = {}) =>
  mount({ type: 'open', surface: 'billing', subject: 'invoices-page', 'after-send': null, ...attrs });

const toggle = (m: Mounted) => m.q<HTMLButtonElement>('[part=toggle]');
const box = (m: Mounted) => m.q<HTMLTextAreaElement>('textarea');
const send = (m: Mounted, text: string) => {
  box(m).value = text;
  m.q<HTMLButtonElement>('[part=send]').click();
};
const focused = (m: Mounted) => m.sr.activeElement;

describe('render', () => {
  it('shows only the toggle: no rating buttons, no question, box closed', () => {
    mockFetch();
    const m = open();
    expect(toggle(m).tagName).toBe('BUTTON');
    expect(toggle(m).textContent).toBe('Give feedback');
    expect(toggle(m).getAttribute('aria-expanded')).toBe('false');
    expect(toggle(m).getAttribute('aria-controls')).toBe(box(m).id);
    expect(m.q('[data-s]')).toBeNull();
    expect(m.q('[part=question]')).toBeNull();
    expect(m.form().hidden).toBe(true);
    expect(m.thanks().getAttribute('role')).toBe('status');
  });

  it('makes no network calls until visible, then one impression with type "open"', async () => {
    const net = mockFetch();
    const m = open();
    await flush();
    expect(net.calls).toHaveLength(0);
    FakeIO.show(m.el);
    FakeIO.show(m.el);
    await flush();
    expect(net.impressions().map((c) => c.body)).toEqual([{ type: 'open', surface: 'billing', subject: 'invoices-page', client: expect.stringMatching(/^widget@/) }]);
    expect(validateRequest('/v1/impressions', net.impressions()[0].body)).toEqual([]);
  });

  it.each([
    ['fi', 'Anna palautetta', 'Mitä haluaisit kertoa meille?'],
    ['sv-SE', 'Ge feedback', 'Vad vill du berätta för oss?'],
    ['de', 'Give feedback', 'What would you like to tell us?'],
  ])('lang="%s" uses the built-in strings', (lang, label, placeholder) => {
    mockFetch();
    const m = open({ lang });
    expect(toggle(m).textContent).toBe(label);
    expect(box(m).placeholder).toBe(placeholder);
    expect(box(m).getAttribute('aria-label')).toBe(placeholder);
  });

  it('question relabels the toggle; an empty question keeps the default', () => {
    mockFetch();
    expect(toggle(open({ question: 'Ideas for invoices?' })).textContent).toBe('Ideas for invoices?');
    expect(toggle(open({ question: '' })).textContent).toBe(LANGS.en.open);
  });

  it('ignores the comment attribute', () => {
    mockFetch();
    const m = open({ comment: 'off' });
    toggle(m).click();
    expect(m.form().hidden).toBe(false);
  });
});

describe('toggle', () => {
  it('opens the box and focuses it; toggling again closes it, keeps the text and focuses the toggle', () => {
    mockFetch();
    const m = open();
    toggle(m).click();
    expect(m.form().hidden).toBe(false);
    expect(toggle(m).getAttribute('aria-expanded')).toBe('true');
    expect(focused(m)).toBe(box(m));
    box(m).value = 'draft';
    toggle(m).click();
    expect(m.form().hidden).toBe(true);
    expect(toggle(m).getAttribute('aria-expanded')).toBe('false');
    expect(focused(m)).toBe(toggle(m));
    toggle(m).click();
    expect(box(m).value).toBe('draft');
  });

  it('Escape closes the box, keeps the text and returns focus to the toggle', () => {
    mockFetch();
    const m = open();
    toggle(m).click();
    box(m).value = 'draft';
    box(m).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
    expect(m.form().hidden).toBe(true);
    expect(toggle(m).getAttribute('aria-expanded')).toBe('false');
    expect(focused(m)).toBe(toggle(m));
    expect(box(m).value).toBe('draft');
  });
});

describe('send', () => {
  it('posts the text with a new id and no score, matching the API contract', async () => {
    const net = mockFetch();
    const m = open({ meta: '{"release":"2026.11.2"}', lang: 'fi' });
    toggle(m).click();
    send(m, '  Let me export invoices as CSV.  ');
    await flush();
    const [c] = net.feedback();
    expect(c.body).toEqual({
      id: expect.stringMatching(UUID),
      type: 'open',
      surface: 'billing',
      subject: 'invoices-page',
      meta: { release: '2026.11.2' },
      comment: 'Let me export invoices as CSV.',
      locale: 'fi',
      client: expect.stringMatching(/^widget@/),
    });
    expect(c.body).not.toHaveProperty('score');
    expect(validateRequest('/v1/feedback', c.body)).toEqual([]);
  });

  it('an empty Send posts nothing', async () => {
    const net = mockFetch();
    const m = open();
    toggle(m).click();
    send(m, '   ');
    await flush();
    expect(net.feedback()).toHaveLength(0);
    expect(m.form().hidden).toBe(false);
  });

  it('default (replace): once accepted, only the thanks text stays and focus moves to it; commented fires', async () => {
    mockFetch();
    const m = open();
    toggle(m).click();
    send(m, 'More export formats');
    expect(m.events).toEqual([]); // not before the API accepts it
    await flush();
    expect(toggle(m)).toBeNull();
    expect(m.form()).toBeNull();
    expect(m.thanks().textContent).toBe(LANGS.en.thanks);
    expect(focused(m)).toBe(m.thanks());
    expect(m.events).toEqual([{ type: 'commented', detail: { id: expect.stringMatching(UUID), comment: 'More export formats' } }]);
  });

  it('the thanks attribute replaces the default text', async () => {
    mockFetch();
    const m = open({ thanks: 'Thanks, we read every idea' });
    toggle(m).click();
    send(m, 'Idea');
    await flush();
    expect(m.thanks().textContent).toBe('Thanks, we read every idea');
  });

  it('after-send="keep": the box closes and clears, thanks shows, and the next feedback gets a new id', async () => {
    const net = mockFetch();
    const m = open({ 'after-send': 'keep' });
    toggle(m).click();
    send(m, 'First');
    await flush();
    expect(m.form().hidden).toBe(true);
    expect(toggle(m).getAttribute('aria-expanded')).toBe('false');
    expect(box(m).value).toBe('');
    expect(m.thanks().textContent).toBe(LANGS.en.thanks);
    expect(focused(m)).toBe(toggle(m));
    toggle(m).click();
    expect(m.thanks().textContent).toBe('');
    send(m, 'Second');
    await flush();
    const ids = net.feedback().map((c) => c.body.id);
    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toBe(ids[1]);
    expect(m.events.map((e) => e.detail)).toEqual([
      { id: ids[0], comment: 'First' },
      { id: ids[1], comment: 'Second' },
    ]);
  });

  it('a final failure fires error, keeps the box open with the text and shows no thanks', async () => {
    vi.useFakeTimers();
    mockFetch(503, 503);
    const m = open();
    toggle(m).click();
    send(m, 'Keep me');
    await vi.runAllTimersAsync();
    expect(m.events).toEqual([{ type: 'error', detail: { code: 'http', message: expect.stringContaining('503') } }]);
    expect(m.form().hidden).toBe(false);
    expect(box(m).value).toBe('Keep me');
    expect(m.thanks().textContent).toBe('');
    expect(m.q<HTMLButtonElement>('[part=send]').disabled).toBe(false);
  });

  it('a retry after a failure sends the same id', async () => {
    vi.useFakeTimers();
    const net = mockFetch(400);
    const m = open();
    toggle(m).click();
    send(m, 'Again');
    await vi.runAllTimersAsync();
    m.q<HTMLButtonElement>('[part=send]').click();
    await vi.runAllTimersAsync();
    const [a, b] = net.feedback().map((c) => c.body.id);
    expect(a).toBe(b);
    expect(m.thanks().textContent).toBe(LANGS.en.thanks);
  });
});

describe('attribute changes', () => {
  it('changing subject after the swap shows the toggle again with a new id and one new impression', async () => {
    const net = mockFetch();
    const m = open();
    FakeIO.show(m.el);
    toggle(m).click();
    send(m, 'One');
    await flush();
    expect(toggle(m)).toBeNull();
    m.el.setAttribute('subject', 'reports-page');
    expect(toggle(m).getAttribute('aria-expanded')).toBe('false');
    FakeIO.show(m.el);
    toggle(m).click();
    send(m, 'Two');
    await flush();
    expect(net.impressions().map((c) => c.body.subject)).toEqual(['invoices-page', 'reports-page']);
    const [a, b] = net.feedback().map((c) => c.body.id);
    expect(a).not.toBe(b);
  });

  it('switching type between open and a rating re-renders', () => {
    mockFetch();
    const m = open();
    m.el.setAttribute('type', 'thumbs');
    expect(toggle(m)).toBeNull();
    expect(m.btn(1)).not.toBeNull();
    m.el.setAttribute('type', 'open');
    expect(toggle(m)).not.toBeNull();
    expect(m.q('[data-s]')).toBeNull();
  });
});
