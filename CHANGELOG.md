# Changelog

All notable changes to `@user-reactions/widget`. Versions follow [Semantic Versioning](https://semver.org/).

## Unreleased

### Changed
- **Default behaviour:** once feedback is final (the rating is accepted, or the comment when the comment box is shown), the element is replaced by the thanks message: question, buttons and comment box are removed, focus inside the element moves to the thanks text, and a short fade runs only under `prefers-reduced-motion: no-preference`. To keep the 0.1 behaviour, add `after-send="keep"`.
- With the default, an empty Send waits until the rating is accepted.

### Added
- `type="open"`: open feedback with no rating. A "Give feedback" toggle (`aria-expanded`, Escape closes) shows a free-text box; Send posts `type: "open"` with the comment and no score. Works with `after-send` and `thanks` like ratings; fires `commented` once accepted. New part `toggle`; new en/fi/sv strings for the toggle and its placeholder.
- `placement="floating"`: shows the element as a card fixed to the bottom-right corner (bottom-left in right-to-left pages), full width under 480 px. A close button (part `close`) and Escape hide it for the page view; with the default `after-send` it hides about 4 s after thanks, but not while hovered or keyboard-focused. New event `user-reactions:dismissed` with `{ reason: "close" | "done" }`; nothing is stored. New custom properties `--ur-offset` and `--ur-z`; new en/fi/sv string for the close button. `inline` stays the default.
- Demo: a floating card example.
- `sendFeedback({ type: "open", comment })`: sends no score and rejects with `invalid-attribute` without a comment.
- Demo: an open feedback example.
- `after-send="replace|keep"` attribute.
- `thanks` attribute: custom thanks text in both modes, shown as given.
- Demo: a custom `thanks` (with fi/sv) on the help article, and an `after-send="keep"` example.

### Docs
- Roadmap: M5 Replace with thanks moves ahead of Suggestions and ships as 0.2.0. The M5 plan is folded into `docs/widget.md`.
- Roadmap: Suggestions is renamed Open feedback (`type="open"`, was `type="suggestion"`) and ships in 0.2.0 with M5; floating placement moves to 0.3.0. The plan is folded into `docs/widget.md`.
- API contract: the free-text type is `open` instead of `suggestion`.
- Roadmap: floating placement (M6) moves from 0.3.0 into 0.2.0. Its plan is folded into `docs/widget.md`.
- Roadmap: a future, unscheduled option to turn off impressions, with what it does to the response rate.

## 0.1.0

First stable release; npm `latest` and ranges such as `@0.1` now resolve to it.

### Added
- Finnish and Swedish for every built-in string, including scale labels and end captions. `lang` matches the primary subtag (`fi-FI` → `fi`); other languages show English. `locale` is still sent as given.
- Changing `subject`, `meta`, `type`, `lang`, `question` or `comment` resets the element as a new instance: new `id`, nothing selected, comment box and thanks cleared, one new impression once visible. For chat UIs that reuse nodes.
- Demo: a dark page section, a locale picker (None, English, Finnish, Swedish) and a reused-node example.

### Changed
- Readable on dark pages without `--ur-*`: borders at 50% of the text colour (`GrayText` fallback), focus ring falls back to the text colour instead of `Highlight`, a stronger selected state and a readable placeholder.
- The comment box radius is capped at 12 px, so a pill `--ur-radius` only rounds the buttons.

### Fixed
- After a final failed send, the thanks message is removed and the selection kept; clicking the same button resends.
- Late responses for an earlier instance no longer lock or thank a reset element.

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
