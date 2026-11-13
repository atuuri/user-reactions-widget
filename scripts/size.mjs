// SPDX-License-Identifier: MIT
// Fails when the IIFE build exceeds the 8 kB min+gzip budget (CLAUDE.md, docs/widget.md).
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const BUDGET = 8000; // bytes; 8 kB read as 8000 so it holds under either kB definition
const files = { 'dist/user-reactions.js': true, 'dist/user-reactions.mjs': false };

let failed = false;
for (const [file, enforced] of Object.entries(files)) {
  let src;
  try {
    src = readFileSync(file);
  } catch {
    console.error(`size: ${file} not found; run npm run build first`);
    process.exit(1);
  }
  const gz = gzipSync(src, { level: 9 }).length;
  const over = enforced && gz > BUDGET;
  failed ||= over;
  console.log(`${over ? '✗' : '✓'} ${file}  ${src.length} B min, ${gz} B gzip${enforced ? ` (budget ${BUDGET} B)` : ''}`);
}
if (failed) {
  console.error('size: IIFE bundle is over budget');
  process.exit(1);
}
