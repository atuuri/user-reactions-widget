// SPDX-License-Identifier: MIT
// Checks the npm tarball the way a consumer sees it. Run after `npm run build`.
//  1. Contents: only package.json, README, LICENSE and the built files.
//  2. Install: the tarball installs into an empty project.
//  3. Runtime: `import { sendFeedback } from "@user-reactions/widget"` works in Node.
//  4. Types: the declarations type-check under "bundler" and "nodenext" resolution.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const tsc = resolve('node_modules/typescript/bin/tsc');
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const fail = (msg) => {
  console.error(`pack-check: ${msg}`);
  process.exit(1);
};

if (!existsSync('dist/user-reactions.js') || !existsSync('dist/types/index.d.ts')) fail('dist/ is incomplete; run npm run build first');

const tmp = mkdtempSync(join(tmpdir(), 'ur-pack-'));
try {
  // 1. Contents (scripts ignored: the build already ran and is what gets checked)
  const [info] = JSON.parse(run('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', tmp]));
  const files = info.files.map((f) => f.path).sort();
  const allowed = (f) => ['package.json', 'README.md', 'LICENSE'].includes(f) || /^dist\/(user-reactions\.(m?js)|types\/[\w-]+\.d\.ts)$/.test(f);
  const required = ['package.json', 'README.md', 'LICENSE', 'dist/user-reactions.js', 'dist/user-reactions.mjs', 'dist/types/index.d.ts'];
  const extra = files.filter((f) => !allowed(f));
  const missing = required.filter((f) => !files.includes(f));
  if (extra.length) fail(`unexpected files in tarball: ${extra.join(', ')}`);
  if (missing.length) fail(`missing from tarball: ${missing.join(', ')}`);
  console.log(`✓ tarball ${info.filename}: ${files.length} files, ${info.size} B packed`);

  // 2. Install into an empty consumer project
  const app = join(tmp, 'consumer');
  mkdirSync(app);
  writeFileSync(join(app, 'package.json'), JSON.stringify({ name: 'consumer', private: true, type: 'module' }));
  run('npm', ['install', join(tmp, info.filename), '--no-audit', '--no-fund', '--ignore-scripts', '--prefer-offline'], app);
  console.log('✓ installs into an empty project');

  // 3. Runtime in Node (no DOM): the headless client must work, the element must not crash the import
  const smoke = `
    import * as m from ${JSON.stringify(pkg.name)};
    import { createRequire } from 'node:module';
    const require = createRequire(import.meta.url);
    const calls = [];
    globalThis.fetch = async (url, init) => { calls.push({ url, init }); return new Response(null, { status: 202 }); };
    const { id } = await m.sendFeedback({ projectKey: 'pk', type: 'thumbs', score: 1, surface: 'pack-check', endpoint: 'https://api.test' });
    const body = JSON.parse(calls[0].init.body);
    const ok = typeof m.UserReactionsElement === 'function' && m.VERSION === ${JSON.stringify(pkg.version)}
      && calls[0].url === 'https://api.test/v1/feedback' && body.id === id && body.client === 'headless@' + m.VERSION
      && require.resolve(${JSON.stringify(pkg.name + '/iife')}).endsWith('user-reactions.js')
      && require(${JSON.stringify(pkg.name + '/package.json')}).version === m.VERSION;
    if (!ok) { console.error(JSON.stringify({ VERSION: m.VERSION, url: calls[0]?.url, body })); process.exit(1); }
  `;
  try {
    run(process.execPath, ['--input-type=module', '-e', smoke], app);
  } catch (e) {
    fail(`Node import/sendFeedback smoke test failed\n${e.stdout}${e.stderr}`);
  }
  console.log(`✓ Node: import + sendFeedback work, VERSION ${pkg.version}`);

  // 4. Types under the two resolution modes consumers use
  writeFileSync(
    join(app, 'index.ts'),
    `import { sendFeedback, UserReactionsElement, type FeedbackType, type RatedDetail } from ${JSON.stringify(pkg.name)};
const t: FeedbackType = 'thumbs';
const r: Promise<{ id: string }> = sendFeedback({ projectKey: 'pk', type: t, score: 0, surface: 's' });
const d: RatedDetail | undefined = undefined;
export { r, d, UserReactionsElement };
`,
  );
  for (const [module, moduleResolution] of [['esnext', 'bundler'], ['nodenext', 'nodenext']]) {
    writeFileSync(
      join(app, 'tsconfig.json'),
      JSON.stringify({ compilerOptions: { strict: true, noEmit: true, target: 'es2022', lib: ['es2022', 'dom'], types: [], module, moduleResolution }, files: ['index.ts'] }),
    );
    try {
      run(process.execPath, [tsc, '-p', 'tsconfig.json'], app);
    } catch (e) {
      fail(`types do not resolve with moduleResolution "${moduleResolution}"\n${e.stdout}${e.stderr}`);
    }
    console.log(`✓ types: moduleResolution ${moduleResolution}`);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
