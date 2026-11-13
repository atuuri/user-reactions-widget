// SPDX-License-Identifier: MIT
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { readFileSync } from 'node:fs';
import { validateRequest } from './tools/openapi.ts';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

/**
 * Dev mock of the ingest API (see `servers` in docs/api/openapi.yaml):
 *   POST /mock/v1/feedback, POST /mock/v1/impressions → 202 (400 if the body breaks the contract)
 *   POST /mock/fail/v1/*                               → 503, to try the retry and error path
 * Every request is logged to the terminal and pushed to the demo page over the HMR socket.
 */
function mockApi(): Plugin {
  return {
    name: 'user-reactions-mock-api',
    configureServer(server) {
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
        if (req.url == '/' || req.url == '/demo') {
          res.writeHead(302, { Location: '/demo/' }).end();
          return;
        }
        const m = req.url?.match(/^\/mock(\/fail)?(\/v1\/(?:feedback|impressions))$/);
        if (!m) return next();
        const cors = {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, X-Project-Key',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
        };
        if (req.method == 'OPTIONS') return void res.writeHead(204, cors).end();
        if (req.method != 'POST') return void res.writeHead(405, cors).end();
        let raw = '';
        req.on('data', (c) => (raw += c));
        req.on('end', () => {
          const [, fail, path] = m;
          let body: any;
          let errors: string[];
          try {
            body = JSON.parse(raw);
            errors = validateRequest(path, body);
          } catch {
            errors = ['body: invalid JSON'];
          }
          if (!req.headers['x-project-key']) errors.push('missing X-Project-Key');
          const status = fail ? 503 : errors.length ? 400 : 202;
          const entry = { status, path, projectKey: req.headers['x-project-key'], body, errors };
          server.config.logger.info(`[mock] ${status} POST ${path} ${JSON.stringify(body)}${errors.length ? `\n  ${errors.join('\n  ')}` : ''}`, { timestamp: true });
          server.ws.send({ type: 'custom', event: 'ur:mock', data: entry });
          res.writeHead(status, { ...cors, 'Content-Type': 'application/json' });
          res.end(status == 202 && path.endsWith('feedback') ? JSON.stringify({ id: body.id }) : status == 202 ? '' : JSON.stringify({ errors }));
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [mockApi()],
  // Single source of the version: package.json (bumped by `npm version`).
  define: { __UR_VERSION__: JSON.stringify(pkg.version) },
  publicDir: false,
  server: { port: 5173 },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    lib: {
      entry: 'src/index.ts',
      name: 'UserReactions',
      formats: ['es', 'iife'],
      fileName: (format) => (format == 'es' ? 'user-reactions.mjs' : 'user-reactions.js'),
    },
  },
  test: {
    environment: 'happy-dom',
    include: ['test/**/*.test.ts'],
  },
});
