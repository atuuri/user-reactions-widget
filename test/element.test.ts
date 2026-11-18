// SPDX-License-Identifier: MIT
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../src/index';
import { VERSION } from '../src/client';
import { validateRequest } from '../tools/openapi';
import { FakeIO, comment, flush, mount, mockFetch } from './helpers';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

beforeEach(() => {
  FakeIO.all = [];
  vi.stubGlobal('IntersectionObserver', FakeIO);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('render', () => {
  it('shows the question and two labelled, unpressed buttons without any network call', async () => {
    const net = mockFetch();
    const m = mount();
    await flush();
    expect(m.q('[part=question]').textContent).toBe('Was this helpful?');
    expect(m.btn(1).getAttribute('aria-label')).toBe('Helpful');
    expect(m.btn(0).getAttribute('aria-label')).toBe('Not helpful');
    for (const s of [0, 1] as const) {
      expect(m.btn(s).tagName).toBe('BUTTON');
      expect(m.btn(s).getAttribute('aria-pressed')).toBe('false');
      expect(m.btn(s).getAttribute('part')).toBe('button');
    }
    expect(m.thanks().getAttribute('role')).toBe('status');
    expect(m.form().hidden).toBe(true);
    expect(net.calls).toHaveLength(0);
    expect(m.events).toHaveLength(0);
  });

  it('exposes the styling parts', () => {
    mockFetch();
    const m = mount();
    for (const p of ['question', 'button', 'comment', 'send', 'thanks']) expect(m.sr.querySelector(`[part~=${p}]`), p).not.toBeNull();
  });

  it('uses the question attribute as text, not HTML', () => {
    mockFetch();
    const m = mount({ question: '<b>Did this answer help?</b>' });
    expect(m.q('[part=question]').textContent).toBe('<b>Did this answer help?</b>');
    expect(m.sr.querySelector('b')).toBeNull();
  });

  it('question="" shows only the buttons, still labelled for screen readers', () => {
    mockFetch();
    const m = mount({ question: '' });
    const q = m.q('[part=question]') as HTMLElement;
    expect(q.hidden).toBe(true);
    expect(q.textContent).toBe('Was this helpful?');
    expect(m.sr.querySelector('[role=group]')!.getAttribute('aria-labelledby')).toBe(q.id);
    expect(m.btn(1).getAttribute('aria-label')).toBe('Helpful');
  });

  it('shows the default question when the attribute is absent', () => {
    mockFetch();
    expect((mount().q('[part=question]') as HTMLElement).hidden).toBe(false);
  });

  it('does not touch the host element id', () => {
    mockFetch();
    const m = mount({ id: 'host-id' });
    m.btn(1).click();
    expect(m.el.id).toBe('host-id');
  });
});

describe('impressions', () => {
  it('sends exactly one impression per element instance, once at least 50% is visible', async () => {
    const net = mockFetch();
    const m = mount({ subject: 'msg_1' });
    FakeIO.show(m.el, 0.3);
    await flush();
    expect(net.impressions()).toHaveLength(0);

    FakeIO.show(m.el, 0.6);
    FakeIO.show(m.el, 1);
    await flush();
    expect(net.impressions()).toHaveLength(1);

    // Moving the node in the DOM is still the same instance.
    m.el.remove();
    document.body.append(m.el);
    FakeIO.show(m.el, 1);
    await flush();
    expect(net.impressions()).toHaveLength(1);

    const [imp] = net.impressions();
    expect(imp.url).toBe('https://api.test/v1/impressions');
    expect(imp.body).toEqual({ type: 'thumbs', surface: 'assistant-answer', subject: 'msg_1', client: `widget@${VERSION}` });
    expect(validateRequest('/v1/impressions', imp.body)).toEqual([]);
  });

  it('observes with a 50% threshold', () => {
    mockFetch();
    mount();
    expect(FakeIO.all[0].opts?.threshold).toBe(0.5);
  });

  it('a new instance sends its own impression', async () => {
    const net = mockFetch();
    const a = mount();
    const b = mount();
    FakeIO.show(a.el);
    FakeIO.show(b.el);
    FakeIO.show(a.el);
    await flush();
    expect(net.impressions()).toHaveLength(2);
  });

  it('does not throw when IntersectionObserver is unavailable', async () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const net = mockFetch();
    const m = mount();
    await flush();
    expect(m.events).toEqual([]);
    expect(net.calls).toHaveLength(0);
  });
});

describe('rating', () => {
  it('marks the button and immediately posts feedback with a client-generated UUID', async () => {
    const net = mockFetch();
    const m = mount({ subject: 'msg_8f2c' });
    m.btn(1).click();
    expect(m.btn(1).getAttribute('aria-pressed')).toBe('true');
    expect(m.btn(1).getAttribute('part')).toBe('button button-selected');
    expect(m.btn(0).getAttribute('aria-pressed')).toBe('false');
    await flush();
    const [f] = net.feedback();
    expect(f.url).toBe('https://api.test/v1/feedback');
    expect(f.headers['X-Project-Key']).toBe('pk_test_123');
    expect(f.headers['Content-Type']).toBe('application/json');
    expect(f.credentials).toBe('omit');
    expect(f.body.id).toMatch(UUID);
    expect(f.body).toMatchObject({ type: 'thumbs', score: 1, surface: 'assistant-answer', subject: 'msg_8f2c', locale: 'en', client: `widget@${VERSION}` });
    expect(validateRequest('/v1/feedback', f.body)).toEqual([]);
  });

  it('fires user-reactions:rated (bubbling, composed) with id, type, score, surface, subject', async () => {
    mockFetch();
    const m = mount({ subject: 'msg_1' });
    const seen: Event[] = [];
    document.addEventListener('user-reactions:rated', (e) => seen.push(e));
    m.btn(0).click();
    expect(seen[0].bubbles).toBe(true);
    expect(seen[0].composed).toBe(true);
    expect(m.events).toEqual([{ type: 'rated', detail: { id: expect.stringMatching(UUID), type: 'thumbs', score: 0, surface: 'assistant-answer', subject: 'msg_1' } }]);
  });

  it('changing the rating re-sends with the same id', async () => {
    const net = mockFetch();
    const m = mount();
    m.btn(1).click();
    m.btn(0).click();
    m.btn(1).click();
    await flush();
    const f = net.feedback();
    expect(f.map((c) => c.body.score)).toEqual([1, 0, 1]);
    expect(new Set(f.map((c) => c.body.id)).size).toBe(1);
    expect(m.btn(0).getAttribute('aria-pressed')).toBe('false');
    expect(m.btn(1).getAttribute('aria-pressed')).toBe('true');
  });

  it('clicking the selected button again does not re-send', async () => {
    const net = mockFetch();
    const m = mount();
    m.btn(1).click();
    await flush();
    m.btn(1).click();
    await flush();
    expect(net.feedback()).toHaveLength(1);
  });

  it('sends rating changes in click order even when responses are slow', async () => {
    let release!: () => void;
    const slow = () => new Promise<Response>((r) => (release = () => r(new Response('{}', { status: 202 }))));
    const net = mockFetch(slow);
    const m = mount();
    m.btn(1).click();
    m.btn(0).click();
    await flush();
    expect(net.feedback()).toHaveLength(1); // second waits for the first
    release();
    await flush();
    expect(net.feedback().map((c) => c.body.score)).toEqual([1, 0]);
  });

  it('separate instances get separate ids', async () => {
    const net = mockFetch();
    mount().btn(1).click();
    mount().btn(1).click();
    await flush();
    const [a, b] = net.feedback();
    expect(a.body.id).not.toBe(b.body.id);
  });
});

describe('comment modes', () => {
  it('on-negative: thumbs down shows the comment box, thumbs up does not', async () => {
    mockFetch();
    const m = mount({ comment: 'on-negative' });
    m.btn(1).click();
    expect(m.form().hidden).toBe(true);
    expect(m.thanks().textContent).toBe('Thanks for your feedback');

    m.btn(0).click();
    expect(m.form().hidden).toBe(false);
    expect(m.thanks().textContent).toBe('');

    m.btn(1).click();
    expect(m.form().hidden).toBe(true);
    expect(m.thanks().textContent).toBe('Thanks for your feedback');
  });

  it('on-negative: thumbs up alone never shows the box', () => {
    mockFetch();
    const m = mount({ comment: 'on-negative' });
    m.btn(1).click();
    expect(m.form().hidden).toBe(true);
  });

  it('optional: the comment box shows for both thumbs', () => {
    mockFetch();
    for (const s of [0, 1] as const) {
      const m = mount({ comment: 'optional' });
      m.btn(s).click();
      expect(m.form().hidden).toBe(false);
      expect(m.thanks().textContent).toBe('');
    }
  });

  it('off (default) and unknown values: no comment box, thanks right after rating', () => {
    mockFetch();
    for (const mode of [null, 'off', 'bogus']) {
      for (const s of [0, 1] as const) {
        const m = mount({ comment: mode });
        m.btn(s).click();
        expect(m.form().hidden).toBe(true);
        expect(m.thanks().textContent).toBe('Thanks for your feedback');
      }
    }
  });

  it('the comment box is labelled, limited to 2000 characters and has a Send button', () => {
    mockFetch();
    const m = mount({ comment: 'optional' });
    const ta = m.q<HTMLTextAreaElement>('textarea');
    expect(ta.maxLength).toBe(2000);
    expect(ta.placeholder).toBe('Tell us more (optional)');
    expect(ta.getAttribute('aria-label')).toBe('Tell us more (optional)');
    expect(m.q('[part=send]').textContent).toBe('Send');
  });

  it('Send re-posts the same id with the comment, fires commented, shows thanks and locks the rating', async () => {
    const net = mockFetch();
    const m = mount({ comment: 'on-negative' });
    m.btn(0).click();
    comment(m, '  The answer ignored my order number.  ');
    await flush();
    const [rating, withComment] = net.feedback();
    expect(withComment.body).toEqual({ ...rating.body, comment: 'The answer ignored my order number.' });
    expect(validateRequest('/v1/feedback', withComment.body)).toEqual([]);
    expect(m.events.map((e) => e.type)).toEqual(['rated', 'commented']);
    expect(m.events[1].detail).toEqual({ id: rating.body.id, comment: 'The answer ignored my order number.' });
    expect(m.form().hidden).toBe(true);
    expect(m.thanks().textContent).toBe('Thanks for your feedback');
    expect(m.btn(0).getAttribute('aria-disabled')).toBe('true');

    m.btn(1).click(); // rating can no longer change
    await flush();
    expect(net.feedback()).toHaveLength(2);
    expect(m.btn(0).getAttribute('aria-pressed')).toBe('true');
  });

  it('Send with an empty box just shows thanks and posts nothing', async () => {
    const net = mockFetch();
    const m = mount({ comment: 'optional' });
    m.btn(1).click();
    comment(m, '   ');
    await flush();
    expect(net.feedback()).toHaveLength(1);
    expect(m.thanks().textContent).toBe('Thanks for your feedback');
    expect(m.events.map((e) => e.type)).toEqual(['rated']);
  });
});

describe('failure', () => {
  it('network failure: retries once after 1 s, then fires user-reactions:error and does not throw', async () => {
    vi.useFakeTimers();
    const net = mockFetch('network', 'network');
    const m = mount();
    expect(() => m.btn(0).click()).not.toThrow();
    await vi.advanceTimersByTimeAsync(0);
    expect(net.feedback()).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(999);
    expect(net.feedback()).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(net.feedback()).toHaveLength(2);
    expect(net.feedback()[1].body).toEqual(net.feedback()[0].body);
    expect(m.events.at(-1)).toEqual({ type: 'error', detail: { code: 'network', message: 'Failed to fetch' } });
  });

  it('keeps the UI usable after a failure: the user can rate again', async () => {
    vi.useFakeTimers();
    const net = mockFetch('network', 'network');
    const m = mount();
    m.btn(0).click();
    await vi.advanceTimersByTimeAsync(1000);
    expect(m.events.some((e) => e.type == 'error')).toBe(true);
    m.btn(0).click(); // same button resends after a failure
    await vi.advanceTimersByTimeAsync(0);
    expect(net.feedback()).toHaveLength(3);
    m.btn(1).click();
    await vi.advanceTimersByTimeAsync(0);
    expect(net.feedback().map((c) => c.body.score)).toEqual([0, 0, 0, 1]);
    expect(new Set(net.feedback().map((c) => c.body.id)).size).toBe(1);
  });

  it('a 5xx followed by success recovers without an error event', async () => {
    vi.useFakeTimers();
    const net = mockFetch(503);
    const m = mount();
    m.btn(1).click();
    await vi.advanceTimersByTimeAsync(1000);
    expect(net.feedback()).toHaveLength(2);
    expect(m.events.map((e) => e.type)).toEqual(['rated']);
  });

  it('a 4xx is not retried and fires an http error', async () => {
    vi.useFakeTimers();
    const net = mockFetch(400);
    const m = mount();
    m.btn(1).click();
    await vi.advanceTimersByTimeAsync(2000);
    expect(net.feedback()).toHaveLength(1);
    expect(m.events.at(-1)).toEqual({ type: 'error', detail: { code: 'http', message: 'HTTP 400 from /v1/feedback' } });
  });

  it('a failed comment keeps the box and text so the user can retry', async () => {
    vi.useFakeTimers();
    const net = mockFetch(202, 'network', 'network');
    const m = mount({ comment: 'on-negative' });
    m.btn(0).click();
    comment(m, 'Wrong answer');
    await vi.advanceTimersByTimeAsync(1000);
    expect(m.events.map((e) => e.type)).toEqual(['rated', 'error']);
    expect(m.form().hidden).toBe(false);
    expect(m.q<HTMLTextAreaElement>('textarea').value).toBe('Wrong answer');
    expect(m.q<HTMLButtonElement>('[part=send]').disabled).toBe(false);

    comment(m, 'Wrong answer');
    await vi.advanceTimersByTimeAsync(0);
    expect(net.feedback()).toHaveLength(4);
    expect(m.events.map((e) => e.type)).toEqual(['rated', 'error', 'commented']);
  });

  it('impression failure fires an error event', async () => {
    vi.useFakeTimers();
    mockFetch(500, 500);
    const m = mount();
    FakeIO.show(m.el);
    await vi.advanceTimersByTimeAsync(1000);
    expect(m.events).toEqual([{ type: 'error', detail: { code: 'http', message: 'HTTP 500 from /v1/impressions' } }]);
  });

  it('a missing fetch implementation is reported, not thrown', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', undefined);
    const m = mount();
    expect(() => m.btn(1).click()).not.toThrow();
    await vi.advanceTimersByTimeAsync(1000);
    expect(m.events.at(-1)?.detail.code).toBe('network');
  });
});

describe('attributes', () => {
  it.each([
    [{ 'project-key': null }, 'project-key is required'],
    [{ surface: null }, 'surface is required (max 100 characters)'],
    [{ surface: 'x'.repeat(101) }, 'surface is required (max 100 characters)'],
    [{ subject: 'x'.repeat(201) }, 'subject is too long (max 200 characters)'],
    [{ type: null }, 'type "" is not supported'],
    [{ type: 'nps' }, 'type "nps" is not supported'],
  ])('invalid %o fires invalid-attribute and renders nothing', async (attrs, message) => {
    const net = mockFetch();
    const m = mount(attrs);
    await flush();
    expect(m.events).toEqual([{ type: 'error', detail: { code: 'invalid-attribute', message } }]);
    expect(m.sr.querySelector('button')).toBeNull();
    FakeIO.show(m.el);
    expect(net.calls).toHaveLength(0);
  });

  it.each([['{not json'], ['["a"]'], ['{"n":1}'], [JSON.stringify(Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`k${i}`, 'v'])))]])(
    'invalid meta %s is ignored and fires invalid-meta',
    async (meta) => {
      const net = mockFetch();
      const m = mount({ meta });
      await flush();
      expect(m.events.map((e) => e.detail.code)).toEqual(['invalid-meta']);
      m.btn(1).click();
      await flush();
      expect(net.feedback()[0].body).not.toHaveProperty('meta');
    },
  );

  it('valid meta and lang are sent as meta and locale', async () => {
    const net = mockFetch();
    const m = mount({ meta: '{"model":"gpt-x","release":"2026.11.2"}', lang: 'fi' });
    m.btn(1).click();
    await flush();
    expect(net.feedback()[0].body).toMatchObject({ meta: { model: 'gpt-x', release: '2026.11.2' }, locale: 'fi' });
  });

  it('without an endpoint, still renders but sends nothing and fires invalid-attribute', async () => {
    const net = mockFetch();
    const m = mount({ endpoint: null });
    m.btn(1).click();
    await flush();
    expect(net.calls).toHaveLength(0);
    expect(m.events.at(-1)).toEqual({
      type: 'error',
      detail: { code: 'invalid-attribute', message: 'endpoint is required until the hosted API launches' },
    });
  });

  it('reads endpoint at send time and tolerates a trailing slash', async () => {
    const net = mockFetch();
    const m = mount();
    m.el.setAttribute('endpoint', 'http://localhost:5173/mock/');
    m.btn(1).click();
    await flush();
    expect(net.feedback()[0].url).toBe('http://localhost:5173/mock/v1/feedback');
  });
});
