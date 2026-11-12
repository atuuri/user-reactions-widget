// SPDX-License-Identifier: MIT
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_ENDPOINT, ReactionsError, VERSION, sendFeedback, uuid } from '../src/client';
import { spec, validateRequest } from '../tools/openapi';
import { mockFetch } from './helpers';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const base = { projectKey: 'pk_test_123', type: 'thumbs', score: 0, surface: 'assistant-answer', endpoint: 'https://api.test' } as const;

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('sendFeedback', () => {
  it('posts a valid Feedback payload with the project key and no credentials', async () => {
    const net = mockFetch();
    const { id } = await sendFeedback({ ...base, subject: 'msg_1', meta: { model: 'gpt-x' }, comment: 'Wrong', locale: 'en' });
    const [c] = net.calls;
    expect(c.url).toBe('https://api.test/v1/feedback');
    expect(c.headers).toEqual({ 'Content-Type': 'application/json', 'X-Project-Key': 'pk_test_123' });
    expect(c.credentials).toBe('omit');
    expect(id).toMatch(UUID);
    expect(c.body).toEqual({ id, type: 'thumbs', score: 0, surface: 'assistant-answer', subject: 'msg_1', meta: { model: 'gpt-x' }, comment: 'Wrong', locale: 'en', client: 'headless@0.1.0' });
    expect(validateRequest('/v1/feedback', c.body)).toEqual([]);
  });

  it('omits fields that were not given', async () => {
    const net = mockFetch();
    await sendFeedback({ ...base, subject: undefined, comment: '' });
    expect(Object.keys(net.calls[0].body).sort()).toEqual(['client', 'id', 'score', 'surface', 'type']);
  });

  it('re-uses a given id so a later call updates the same item', async () => {
    const net = mockFetch();
    const { id } = await sendFeedback(base);
    await sendFeedback({ ...base, id, comment: 'More detail' });
    expect(net.calls.map((c) => c.body.id)).toEqual([id, id]);
  });

  it('defaults to the hosted endpoint from the API contract', async () => {
    expect(DEFAULT_ENDPOINT).toBe(spec.servers[0].url);
    const net = mockFetch();
    await sendFeedback({ ...base, endpoint: undefined });
    expect(net.calls[0].url).toBe('https://api.example.com/v1/feedback');
  });

  it('retries once after 1 s on a network error', async () => {
    vi.useFakeTimers();
    const net = mockFetch('network');
    const p = sendFeedback(base);
    await vi.advanceTimersByTimeAsync(999);
    expect(net.calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(p).resolves.toHaveProperty('id');
    expect(net.calls).toHaveLength(2);
  });

  it.each([429, 500, 503])('retries %i once, then rejects with an http ReactionsError', async (status) => {
    vi.useFakeTimers();
    const net = mockFetch(status, status);
    const p = sendFeedback(base);
    const check = expect(p).rejects.toMatchObject({ code: 'http', status });
    await vi.advanceTimersByTimeAsync(1000);
    await check;
    expect(net.calls).toHaveLength(2);
  });

  it.each([400, 401])('does not retry %i', async (status) => {
    const net = mockFetch(status);
    const err = await sendFeedback(base).catch((e) => e);
    expect(err).toBeInstanceOf(ReactionsError);
    expect(err).toMatchObject({ code: 'http', status, message: `HTTP ${status} from /v1/feedback` });
    expect(net.calls).toHaveLength(1);
  });

  it('rejects with a network ReactionsError after the retry fails', async () => {
    vi.useFakeTimers();
    mockFetch('network', 'network');
    const p = sendFeedback(base);
    const check = expect(p).rejects.toMatchObject({ code: 'network', message: 'Failed to fetch' });
    await vi.advanceTimersByTimeAsync(1000);
    await check;
  });

  it('touches no cookies or storage', async () => {
    mockFetch();
    const set = vi.spyOn(Storage.prototype, 'setItem');
    const cookie = document.cookie;
    await sendFeedback(base);
    expect(set).not.toHaveBeenCalled();
    expect(document.cookie).toBe(cookie);
  });
});

describe('uuid', () => {
  it('produces v4 UUIDs', () => {
    expect(uuid()).toMatch(UUID);
  });

  it('falls back to getRandomValues outside secure contexts', () => {
    const c = globalThis.crypto;
    vi.stubGlobal('crypto', { getRandomValues: (a: Uint8Array<ArrayBuffer>) => c.getRandomValues(a) });
    const ids = new Set(Array.from({ length: 50 }, uuid));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(id).toMatch(UUID);
  });
});

it('VERSION matches package.json', () => {
  expect(VERSION).toBe(JSON.parse(readFileSync('package.json', 'utf8')).version);
});
