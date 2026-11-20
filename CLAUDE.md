# user-reactions-widget: embeddable feedback element

MIT-licensed, public repo. The product has two repos:
- `user-reactions-widget` (this repo): the embeddable element and a tiny headless client.
- `platform` (private): ingest API server and reports.

Never add server code, pricing, customer names, business notes or secrets to this repo: it and its full history are public.

## Source of truth
- `docs/widget.md`: behaviour, attributes, events, current milestone and acceptance criteria. The README links here; don't duplicate the spec in the README.
- `docs/m4-suggestions.md`: next milestone. Read only when working on M4.
- `docs/api/openapi.yaml`: the ingest API contract the widget calls.

If code and spec disagree, update the spec in the same PR or ask first.

## Reading the repo
- Skip `package-lock.json` and `dist/`; read only the spec sections a task needs.
- `docs/releasing.md` only for release work.

## Hard constraints
- Vanilla TypeScript Web Component, **no runtime dependencies**.
- Bundle budget: **8 kB min+gzip** for the IIFE build. Fail the build if exceeded.
- Two builds: ES module (npm) and IIFE (one `<script>` tag).
- Shadow DOM; styling only through CSS custom properties and `::part()`.
- Accessible: real `<button>` elements, keyboard operable, sensible ARIA labels, visible focus, respects `prefers-reduced-motion`.
- Privacy: no cookies, no storage, no fingerprinting, no personal data. Only opaque ids passed in by the host.
- Must never break the host page: catch all errors, fail silently except for the `error` event.
- Every source file starts with `// SPDX-License-Identifier: MIT`.

## Tooling
- npm, Vite (library mode), Vitest + happy-dom; `yaml` for the dev-only contract validator (`tools/openapi.ts`).
- Scripts: `npm run dev` (demo + mock endpoint), `build`, `test`, `typecheck`, `size`, `pack:check`.
- Ask before adding any other dev dependency.

## Working style
- Small PRs, one milestone per PR (see `docs/widget.md` → Milestones).
- Add or update tests with every behaviour change.
- Keep the README install snippet working and its version pin current.
