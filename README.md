# user-reactions

Inline feedback element for AI answers and key product flows: thumbs up/down, CSAT and CES, with an optional comment and the context of what was rated.

Status: pre-release (milestone M1: thumbs). Spec in [`docs/widget.md`](docs/widget.md), API contract in [`docs/api/openapi.yaml`](docs/api/openapi.yaml).

- Vanilla Web Component, no runtime dependencies, under 8 kB min+gzip.
- No cookies, no storage, no fingerprinting. Only the ids you pass in.
- Never breaks the host page: problems surface as a `user-reactions:error` event.

## Install

One script tag and one element:

```html
<script src="https://cdn.jsdelivr.net/npm/@user-reactions/widget@0.1/dist/user-reactions.js" defer></script>
<user-reactions project-key="pk_live_xxx" type="thumbs"
  surface="assistant-answer" subject="msg_8f2c" comment="on-negative">
</user-reactions>
```

Or from npm:

```sh
npm install @user-reactions/widget
```

```js
import "@user-reactions/widget"; // registers <user-reactions>
```

The first npm release is 0.1.0 (milestone M3); until then the CDN link and `npm install` do not resolve. The script tag uses `dist/user-reactions.js` (IIFE, also exposes `window.UserReactions`); bundlers use `dist/user-reactions.mjs`. `@0.1` follows the latest 0.1.x; pin an exact version and add the `integrity` hash from the [GitHub release notes](https://github.com/atuuri/User-reactions-widget/releases) if you want the file to never change.

## Attributes

| Attribute | Required | Notes |
|---|---|---|
| `project-key` | yes | Public, write-only project key. |
| `type` | yes | `thumbs` (`csat` and `ces` arrive in M2). |
| `surface` | yes | Where in the product, e.g. `assistant-answer`, `checkout`. ≤ 100 chars. |
| `subject` | no | What was rated, e.g. a message id. ≤ 200 chars. |
| `meta` | no | JSON object of string values, e.g. `'{"model":"gpt-x","release":"2026.11.2"}'`. |
| `comment` | no | `off` (default), `optional`, `on-negative`. |
| `question` | no | Overrides the question text. |
| `lang` | no | `en` (default). Sent as `locale`. |
| `endpoint` | no | API base URL, for self-hosting or the dev mock. |

## Events

All events bubble out of the shadow DOM (`composed`).

```js
document.addEventListener("user-reactions:rated", (e) => {
  const { id, type, score, surface, subject } = e.detail;
  if (score === 0) offerRegenerate(subject); // e.g. in an AI chat
});
document.addEventListener("user-reactions:commented", (e) => console.log(e.detail.comment));
document.addEventListener("user-reactions:error", (e) => console.warn(e.detail.code, e.detail.message));
```

## Headless client

For surfaces that cannot render the element (native apps, servers, chat hosts):

```js
import { sendFeedback } from "@user-reactions/widget";

const { id } = await sendFeedback({
  projectKey: "pk_live_xxx",
  type: "thumbs",
  score: 0,
  surface: "assistant-answer",
  subject: "msg_8f2c",
  meta: { model: "gpt-x" },
  comment: "The answer ignored my order number.",
});
```

Same payload and endpoint as the element. Rejects with a `ReactionsError` (`code`, `status`) if it fails after one retry.

## Styling

CSS custom properties: `--ur-font`, `--ur-text`, `--ur-muted`, `--ur-accent`, `--ur-bg`, `--ur-radius`, `--ur-gap`.
Parts: `question`, `button`, `button-selected`, `comment`, `send`, `thanks`.

```css
user-reactions { --ur-accent: #2563eb; --ur-muted: #667085; }
user-reactions::part(button-selected) { background: #2563eb22; }
```

## Development

Requires Node 22.12+ for development (Vitest 5).

```sh
npm install
npm run dev     # demo at http://localhost:5173/demo/ with a mock API that logs payloads
npm test        # Vitest + happy-dom, payloads checked against docs/api/openapi.yaml
npm run build   # dist/user-reactions.mjs, dist/user-reactions.js, dist/types; fails over the size budget
npm run size    # size check of the IIFE build (≤ 8 kB min+gzip)
npm run pack:check  # after build: checks the npm tarball installs and works for consumers
```

CI (`.github/workflows/ci.yml`) runs typecheck, tests, build, size and package checks on every pull request, on Node 22 and 24.

## Releasing

Releases are published from CI when a version tag is pushed, after approval:

```sh
npm version 0.1.0        # bumps package.json, commits, tags v0.1.0
git push --follow-tags   # Release workflow: verify → approve → npm + GitHub Release
```

One-time setup and details: [`docs/releasing.md`](docs/releasing.md). Changes are listed in [`CHANGELOG.md`](CHANGELOG.md).

The mock answers `POST /mock/v1/feedback` and `/mock/v1/impressions` with 202 (400 if the body breaks the API contract). Tick "Simulate API outage" in the demo to send to `/mock/fail`, which answers 503.

## License

MIT. See [LICENSE](LICENSE).
