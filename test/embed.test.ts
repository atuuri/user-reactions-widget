// SPDX-License-Identifier: MIT
// Acceptance: embedding with one <script> tag and one element works on a plain HTML page.
// Builds the real IIFE bundle and loads it into a fresh, script-enabled page.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Window } from 'happy-dom';
import { build } from 'vite';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { VERSION } from '../src/client';

let dir: string;
let iife: string;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'ur-embed-'));
  await build({ configFile: 'vite.config.ts', logLevel: 'silent', build: { outDir: dir, emptyOutDir: true } });
  iife = readFileSync(join(dir, 'user-reactions.js'), 'utf8');
}, 30_000);

afterAll(() => rmSync(dir, { recursive: true, force: true }));

async function page(html: string) {
  const window = new Window({
    url: 'https://host.example/',
    settings: { enableJavaScriptEvaluation: true, suppressInsecureJavaScriptEnvironmentWarning: true },
  });
  const posts: { url: string; body: any }[] = [];
  (window as any).fetch = vi.fn(async (url: string, init: RequestInit) => {
    posts.push({ url, body: JSON.parse(init.body as string) });
    return { ok: true, status: 202 };
  });
  const errors: unknown[] = [];
  window.addEventListener('error', (e) => errors.push(e));
  window.document.write(html.replaceAll('BUNDLE', () => iife)); // function form: the bundle contains $ sequences
  await window.happyDOM.waitUntilComplete();
  return { window, document: window.document, posts, errors };
}

const ELEMENT = `<user-reactions project-key="pk_test" type="thumbs" surface="checkout" comment="on-negative" endpoint="https://api.test"></user-reactions>`;

it.each([
  ['script after the element', `<!doctype html><html><body><p>Order placed.</p>${ELEMENT}<script>BUNDLE</script></body></html>`],
  ['script in <head> (element upgraded later)', `<!doctype html><html><head><script>BUNDLE</script></head><body>${ELEMENT}</body></html>`],
])('works with %s', async (_, html) => {
  const { window, document, posts, errors } = await page(html);
  const el = document.querySelector('user-reactions')!;
  const sr = el.shadowRoot!;
  expect(sr, 'element upgraded').toBeTruthy();
  expect(sr.querySelector('[part=question]')!.textContent).toBe('Was this helpful?');

  (sr.querySelector('button[data-s="0"]') as unknown as HTMLButtonElement).click();
  await window.happyDOM.waitUntilComplete();
  expect(sr.querySelector('form')!.hidden).toBe(false);
  expect(posts).toHaveLength(1);
  expect(posts[0].url).toBe('https://api.test/v1/feedback');
  expect(posts[0].body).toMatchObject({ type: 'thumbs', score: 0, surface: 'checkout', client: `widget@${VERSION}` });

  expect(errors).toEqual([]);
  await window.happyDOM.close();
});

it('loading the bundle twice is harmless', async () => {
  const { document, errors } = await page(`<!doctype html><html><body>${ELEMENT}<script>BUNDLE</script><script>BUNDLE</script></body></html>`);
  expect(document.querySelector('user-reactions')!.shadowRoot).toBeTruthy();
  expect(errors).toEqual([]);
});

it('the built bundle renders csat and ces scales on a plain page', async () => {
  const scales = ['csat', 'ces']
    .map((t) => `<user-reactions project-key="pk_test" type="${t}" surface="${t}-page" endpoint="https://api.test"></user-reactions>`)
    .join('');
  const { window, document, posts, errors } = await page(`<!doctype html><html><body>${scales}<script>BUNDLE</script></body></html>`);
  const [csat, ces] = [...document.querySelectorAll('user-reactions')].map((el) => el.shadowRoot!);
  expect(csat.querySelectorAll('button[data-s]')).toHaveLength(5);
  expect(ces.querySelectorAll('button[data-s]')).toHaveLength(7);
  expect(ces.querySelector('[part=question]')!.textContent).toBe('How easy was this?');

  (ces.querySelector('button[data-s="6"]') as unknown as HTMLButtonElement).click();
  await window.happyDOM.waitUntilComplete();
  expect(posts.map((p) => p.body)).toEqual([expect.objectContaining({ type: 'ces', score: 6, surface: 'ces-page' })]);
  expect(errors).toEqual([]);
  await window.happyDOM.close();
});
