// SPDX-License-Identifier: MIT
// M2: type="csat" (1–5) and type="ces" (1–7), keyboard navigation for scales.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../src/index';
import { requestBody, validateRequest } from '../tools/openapi';
import { FakeIO, comment, flush, mount, mockFetch, type Mounted } from './helpers';

beforeEach(() => {
  FakeIO.all = [];
  vi.stubGlobal('IntersectionObserver', FakeIO);
});
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

const SCALES = {
  csat: {
    max: 5,
    question: 'How satisfied are you?',
    points: ['very dissatisfied', 'dissatisfied', 'neutral', 'satisfied', 'very satisfied'],
    negative: [1, 2],
    ends: ['Very dissatisfied', 'Very satisfied'],
  },
  ces: {
    max: 7,
    question: 'How easy was this?',
    points: ['very difficult', 'difficult', 'somewhat difficult', 'neither easy nor difficult', 'somewhat easy', 'easy', 'very easy'],
    negative: [1, 2, 3],
    ends: ['Very difficult', 'Very easy'],
  },
} as const;

const buttons = (m: Mounted) => [...m.sr.querySelectorAll<HTMLButtonElement>('button[data-s]')];
const press = (m: Mounted, key: string) => {
  const target = (m.sr.activeElement as HTMLElement) ?? m.sr;
  const e = new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true });
  target.dispatchEvent(e);
  return e;
};

describe.each(Object.entries(SCALES))('type="%s"', (type, s) => {
  it(`renders ${s.max} numbered, labelled buttons, the default question and end captions`, async () => {
    const net = mockFetch();
    const m = mount({ type });
    await flush();
    const bs = buttons(m);
    expect(bs.map((b) => b.textContent)).toEqual(s.points.map((_, i) => String(i + 1)));
    bs.forEach((b, i) => {
      expect(b.tagName).toBe('BUTTON');
      expect(b.getAttribute('aria-label')).toBe(`${i + 1} of ${s.max} – ${s.points[i]}`);
      expect(b.title).toBe(b.getAttribute('aria-label'));
      expect(b.getAttribute('aria-pressed')).toBe('false');
    });
    expect(m.q('[part=question]').textContent).toBe(s.question);
    const ends = m.q('[part=scale-label]');
    expect([...ends.children].map((c) => c.textContent)).toEqual(s.ends);
    expect(ends.getAttribute('aria-hidden')).toBe('true'); // the button labels already say it
    expect(m.q('[role=group]').getAttribute('aria-labelledby')).toBe('q');
    expect(net.calls).toHaveLength(0);
    expect(m.events).toEqual([]);
  });

  it('sends the clicked score, and re-sends a changed score with the same id', async () => {
    const net = mockFetch();
    const m = mount({ type, subject: 'order-42' });
    m.btn(s.max).click();
    m.btn(1).click();
    await flush();
    const f = net.feedback();
    expect(f.map((c) => c.body.score)).toEqual([s.max, 1]);
    expect(f[0].body.id).toBe(f[1].body.id);
    for (const c of f) {
      expect(c.body).toMatchObject({ type, surface: 'assistant-answer', subject: 'order-42' });
      expect(validateRequest('/v1/feedback', c.body)).toEqual([]);
    }
    expect(m.btn(1).getAttribute('aria-pressed')).toBe('true');
    expect(m.btn(1).getAttribute('part')).toBe('button button-selected');
    expect(m.btn(s.max).getAttribute('aria-pressed')).toBe('false');
    expect(m.events.map((e) => e.detail.score)).toEqual([s.max, 1]);
    expect(m.events[0].detail).toMatchObject({ type, surface: 'assistant-answer', subject: 'order-42' });
  });

  it(`on-negative: the comment box opens for ${s.negative.join(', ')} and not for higher scores`, () => {
    mockFetch();
    for (let score = 1; score <= s.max; score++) {
      const m = mount({ type, comment: 'on-negative' });
      m.btn(score).click();
      const negative = (s.negative as readonly number[]).includes(score);
      expect(m.form().hidden, `score ${score}`).toBe(!negative);
      expect(m.thanks().textContent, `score ${score}`).toBe(negative ? '' : 'Thanks for your feedback');
    }
  });

  it('optional: the comment box opens for every score; the comment is sent with the score', async () => {
    const net = mockFetch();
    const m = mount({ type, comment: 'optional' });
    m.btn(s.max).click();
    expect(m.form().hidden).toBe(false);
    comment(m, 'Quick and clear.');
    await flush();
    expect(net.feedback()[1].body).toMatchObject({ type, score: s.max, comment: 'Quick and clear.' });
    expect(m.events.map((e) => e.type)).toEqual(['rated', 'commented']);
  });

  it('sends one impression with the scale type', async () => {
    const net = mockFetch();
    const m = mount({ type });
    FakeIO.show(m.el);
    FakeIO.show(m.el);
    await flush();
    expect(net.impressions().map((c) => c.body)).toEqual([{ type, surface: 'assistant-answer', client: expect.stringMatching(/^widget@/) }]);
  });

  it('question="" hides the question but keeps it as the group label', () => {
    mockFetch();
    const m = mount({ type, question: '' });
    expect(m.q('[part=question]').hidden).toBe(true);
    expect(m.q('[part=question]').textContent).toBe(s.question);
  });

  describe('keyboard', () => {
    it('is a single Tab stop: the first button, then the selected one', () => {
      mockFetch();
      const m = mount({ type });
      expect(buttons(m).map((b) => b.tabIndex)).toEqual(buttons(m).map((_, i) => (i == 0 ? 0 : -1)));
      m.btn(3).click();
      expect(buttons(m).filter((b) => b.tabIndex == 0)).toEqual([m.btn(3)]);
    });

    it('arrows move focus without selecting; Home/End jump to the ends; focus stays inside the scale', () => {
      const net = mockFetch();
      const m = mount({ type });
      m.btn(1).focus();
      expect(press(m, 'ArrowRight').defaultPrevented).toBe(true);
      expect(m.sr.activeElement).toBe(m.btn(2));
      press(m, 'ArrowDown');
      expect(m.sr.activeElement).toBe(m.btn(3));
      press(m, 'ArrowLeft');
      press(m, 'ArrowUp');
      expect(m.sr.activeElement).toBe(m.btn(1));
      press(m, 'ArrowLeft'); // clamps at the first button
      expect(m.sr.activeElement).toBe(m.btn(1));
      press(m, 'End');
      expect(m.sr.activeElement).toBe(m.btn(s.max));
      press(m, 'ArrowRight'); // clamps at the last button
      expect(m.sr.activeElement).toBe(m.btn(s.max));
      press(m, 'Home');
      expect(m.sr.activeElement).toBe(m.btn(1));
      // The Tab stop follows focus, so Tab back into the scale returns here.
      expect(buttons(m).filter((b) => b.tabIndex == 0)).toEqual([m.btn(1)]);
      expect(net.calls).toHaveLength(0);
      expect(m.events).toEqual([]);
    });

    it('other keys are left alone (Tab, letters)', () => {
      mockFetch();
      const m = mount({ type });
      m.btn(2).focus();
      expect(press(m, 'Tab').defaultPrevented).toBe(false);
      expect(press(m, 'a').defaultPrevented).toBe(false);
      expect(m.sr.activeElement).toBe(m.btn(2));
    });

    it('Enter/Space select through the native button click', async () => {
      const net = mockFetch();
      const m = mount({ type });
      m.btn(1).focus();
      press(m, 'ArrowRight');
      (m.sr.activeElement as HTMLButtonElement).click(); // what Enter/Space do on a <button>
      await flush();
      expect(net.feedback()[0].body.score).toBe(2);
      expect(m.btn(2).getAttribute('aria-pressed')).toBe('true');
    });
  });
});

describe('thumbs keyboard behaviour is unchanged', () => {
  it('both buttons stay in the Tab order and arrows do nothing', () => {
    mockFetch();
    const m = mount({ type: 'thumbs' });
    expect([m.btn(1).tabIndex, m.btn(0).tabIndex]).toEqual([0, 0]);
    expect(m.sr.querySelector('[part=scale-label]')).toBeNull();
    m.btn(1).focus();
    expect(press(m, 'ArrowRight').defaultPrevented).toBe(false);
    expect(m.sr.activeElement).toBe(m.btn(1));
    m.btn(0).click();
    expect([m.btn(1).tabIndex, m.btn(0).tabIndex]).toEqual([0, 0]);
  });
});

describe('contract', () => {
  it('a CES rating from the element produces the spec "ces" example (apart from id and client)', async () => {
    const ex = requestBody('/v1/feedback').examples.ces as Record<string, any>;
    const net = mockFetch();
    const m = mount({ type: ex.type, surface: ex.surface, lang: ex.locale });
    m.btn(ex.score).click();
    await flush();
    const body = net.feedback()[0].body;
    expect(validateRequest('/v1/feedback', body)).toEqual([]);
    expect({ ...body, id: ex.id, client: ex.client }).toEqual(ex);
  });

  it('scores stay inside the API range for every scale button', async () => {
    const net = mockFetch();
    for (const type of ['csat', 'ces'] as const) {
      const m = mount({ type });
      for (const b of buttons(m)) b.click();
    }
    await flush();
    for (const c of net.feedback()) expect(validateRequest('/v1/feedback', c.body)).toEqual([]);
    // Each element queues its own requests, so the two scales interleave; compare per type.
    const scores = (t: string) => net.feedback().filter((c) => c.body.type == t).map((c) => c.body.score);
    expect(scores('csat')).toEqual([1, 2, 3, 4, 5]);
    expect(scores('ces')).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});
