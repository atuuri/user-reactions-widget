# Changelog

All notable changes to `@user-reactions/widget`. Versions follow [Semantic Versioning](https://semver.org/).

## Unreleased

### Docs
- Trimmed the docs: `docs/widget.md` is the single reference (README links to it), M4 moved to `docs/m4-suggestions.md`, shorter `docs/releasing.md`.

## 0.1.0-beta.3

### Added
- `type="csat"` (1–5) and `type="ces"` (1–7). Buttons are labelled "1 of 5 – very dissatisfied" and so on, with captions under the ends of the scale (styling part `scale-label`). `comment="on-negative"` opens the comment box for CSAT 1–2 and CES 1–3.
- Keyboard navigation for scales: one Tab stop, arrow keys and Home/End move between buttons, Enter/Space select. Thumbs keep both buttons in the Tab order.
- Demo: CSAT and CES examples on the demo page and on `demo/embed.html`.

## 0.1.0-beta.2

### Added
- `question=""` shows only the thumbs, without question text. Screen readers still hear the default question.

### Changed
- `endpoint` is required until the hosted API launches. Without it the element and `sendFeedback()` send nothing and report `invalid-attribute`, instead of sending to the placeholder `https://api.example.com`.

### Docs
- README: install snippet pins the beta version (`@0.1` does not match pre-releases), documents the impression and feedback requests, and the CORS requirements for test servers.

## 0.1.0-beta.1

### Added
- `<user-reactions type="thumbs">` element: impressions, rating with upsert by id, comment modes `off` / `optional` / `on-negative`, `rated` / `commented` / `error` events, one retry on network errors, 429 and 5xx.
- `sendFeedback()` headless client, importable outside the browser.
- ES module and IIFE builds with TypeScript declarations; 8 kB min+gzip budget for the IIFE.
