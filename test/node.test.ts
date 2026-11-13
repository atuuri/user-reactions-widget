// SPDX-License-Identifier: MIT
// @vitest-environment node
// The headless client must be importable from the package entry outside a browser.
import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => vi.unstubAllGlobals());

it('importing the package in Node exposes sendFeedback and does not throw', async () => {
  expect(typeof (globalThis as any).HTMLElement).toBe('undefined');
  const mod = await import('../src/index');
  expect(typeof mod.sendFeedback).toBe('function');

  const fetch = vi.fn(async () => new Response('{}', { status: 202 }));
  vi.stubGlobal('fetch', fetch);
  const { id } = await mod.sendFeedback({ projectKey: 'pk', type: 'thumbs', score: 1, surface: 'server' });
  expect(id).toMatch(/^[0-9a-f-]{36}$/);
  expect(fetch).toHaveBeenCalledOnce();
});
