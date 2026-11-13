// SPDX-License-Identifier: MIT
// Payloads must match docs/api/openapi.yaml: its schemas and its request examples.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../src/index';
import { sendFeedback } from '../src/client';
import { requestBody, validateRequest } from '../tools/openapi';
import { FakeIO, comment, flush, mount, mockFetch } from './helpers';

const feedback = requestBody('/v1/feedback');
const impressions = requestBody('/v1/impressions');
const thumbsDown = feedback.examples.thumbsDown as Record<string, any>;

beforeEach(() => {
  FakeIO.all = [];
  vi.stubGlobal('IntersectionObserver', FakeIO);
});
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('the validator', () => {
  it('accepts every example in the spec', () => {
    for (const [path, body] of [
      ...Object.values(feedback.examples).map((b) => ['/v1/feedback', b] as const),
      ...Object.values(impressions.examples).map((b) => ['/v1/impressions', b] as const),
    ])
      expect(validateRequest(path, body)).toEqual([]);
  });

  it.each([
    [{ extra: 1 }, 'unexpected property "extra"'],
    [{ id: 'not-a-uuid' }, 'not a uuid'],
    [{ type: 'nps' }, 'not one of thumbs, csat, ces'],
    [{ score: 8 }, 'above 7'],
    [{ score: 0.5 }, 'expected integer'],
    [{ surface: '' }, 'shorter than 1'],
    [{ subject: 'x'.repeat(201) }, 'longer than 200'],
    [{ comment: 'x'.repeat(2001) }, 'longer than 2000'],
    [{ meta: { n: 1 } }, 'expected string'],
    [{ meta: Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`k${i}`, 'v'])) }, 'more than 20 properties'],
  ])('rejects a thumbsDown example with %o', (patch, error) => {
    const errors = validateRequest('/v1/feedback', { ...thumbsDown, ...patch });
    expect(errors.join('\n')).toContain(error);
  });

  it('rejects missing required fields', () => {
    const { surface: _, ...rest } = thumbsDown;
    expect(validateRequest('/v1/feedback', rest)).toEqual(['body: missing required "surface"']);
  });
});

describe('payloads match the spec examples', () => {
  it('element: thumbs down + comment produces the thumbsDown example (apart from the random id)', async () => {
    const net = mockFetch();
    const m = mount({
      surface: thumbsDown.surface,
      subject: thumbsDown.subject,
      meta: JSON.stringify(thumbsDown.meta),
      lang: thumbsDown.locale,
      comment: 'on-negative',
    });
    m.btn(0).click();
    comment(m, thumbsDown.comment);
    await flush();
    const body = net.feedback()[1].body;
    expect(validateRequest('/v1/feedback', body)).toEqual([]);
    expect({ ...body, id: thumbsDown.id }).toEqual(thumbsDown);
  });

  it('element: the impression equals the basic example', async () => {
    const ex = impressions.examples.basic as Record<string, any>;
    const net = mockFetch();
    const m = mount({ surface: ex.surface, subject: ex.subject });
    FakeIO.show(m.el);
    await flush();
    expect(net.impressions()[0].body).toEqual(ex);
  });

  it('sendFeedback: produces the thumbsDown example, with a headless client tag', async () => {
    const net = mockFetch();
    const { id, type, score, surface, subject, meta, comment, locale } = thumbsDown;
    await sendFeedback({ projectKey: 'pk', id, type, score, surface, subject, meta, comment, locale });
    expect(net.calls[0].body).toEqual({ ...thumbsDown, client: 'headless@0.1.0' });
    expect(validateRequest('/v1/feedback', net.calls[0].body)).toEqual([]);
  });

  it('sendFeedback: produces the ces example', async () => {
    const ex = feedback.examples.ces as Record<string, any>;
    const net = mockFetch();
    await sendFeedback({ projectKey: 'pk', id: ex.id, type: ex.type, score: ex.score, surface: ex.surface, locale: ex.locale });
    expect(net.calls[0].body).toEqual({ ...ex, client: 'headless@0.1.0' });
  });
});
