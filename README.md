# user-reactions

Inline feedback element for AI answers and key product flows: thumbs up/down, CSAT and CES, with an optional comment and the context of what was rated.

Status: pre-release (milestone M2: thumbs, CSAT and CES). Spec in [`docs/widget.md`](docs/widget.md), API contract in [`docs/api/openapi.yaml`](docs/api/openapi.yaml).

- Vanilla Web Component, no runtime dependencies, under 8 kB min+gzip.
- No cookies, no storage, no fingerprinting. Only the ids you pass in.
- Never breaks the host page: problems surface as a `user-reactions:error` event.

## Install

One script tag and one element:

```html
<script src="https://cdn.jsdelivr.net/npm/@user-reactions/widget@0.1.0-beta.2/dist/user-reactions.js" defer></script>
<user-reactions project-key="pk_live_xxx" type="thumbs"
  surface="assistant-answer" subject="msg_8f2c" comment="on-negative"
  question="Did this answer help you?"
  endpoint="https://your-api.example">
</user-reactions>
```

There is no hosted API yet, so `endpoint` is required: point it at your own server or the [dev mock](#development).

Or from npm:

```sh
npm install @user-reactions/widget
```

```js
import "@user-reactions/widget"; // registers <user-reactions>
```

The current release is the beta `0.1.0-beta.2`; install it from npm with `npm install @user-reactions/widget@next`. In the script tag, pin the exact version: a range such as `@0.1` does not match pre-releases, so it only resolves from 0.1.0 (milestone M3) on. The script tag uses `dist/user-reactions.js` (IIFE, also exposes `window.UserReactions`); bundlers use `dist/user-reactions.mjs`. To make sure the file never changes, add the `integrity` hash from the [GitHub release notes](https://github.com/atuuri/user-reactions-widget/releases).

## Attributes

| Attribute | Required | Notes |
|---|---|---|
| `project-key` | yes | Public, write-only project key. |
| `type` | yes | `thumbs` (👍/👎, score 1/0), `csat` (1–5) or `ces` (1–7). |
| `surface` | yes | Where in the product, e.g. `assistant-answer`, `checkout`. ≤ 100 chars. |
| `subject` | no | What was rated, e.g. a message id. ≤ 200 chars. |
| `meta` | no | JSON object of string values, e.g. `'{"model":"gpt-x","release":"2026.11.2"}'`. |
| `comment` | no | `off` (default), `optional`, `on-negative`. |
| `question` | no | Overrides the question text. Defaults to "Was this helpful?", "How satisfied are you?" or "How easy was this?" by type. `question=""` shows only the buttons; screen readers still hear the default question. |
| `lang` | no | `en` (default). Sent as `locale`. |
| `endpoint` | yes, for now | API base URL, e.g. `https://your-api.example` or `/mock`. The element appends `/v1/impressions` and `/v1/feedback`. Required until the hosted API launches; without it nothing is sent and `user-reactions:error` fires with `invalid-attribute`. |

## Requests

The element sends two kinds of `POST` request, with a JSON body and an `X-Project-Key` header:

- **`/v1/impressions`**: once per element, the first time at least half of it is visible. It lets you work out the response rate.
- **`/v1/feedback`**: on each rating, and again with the same `id` when a comment is sent.

Because of the custom header, browsers send a CORS preflight first. Your server must allow the page's origin and the `Content-Type` and `X-Project-Key` headers. A page opened from a local file has the origin `null`; serving the test page from the dev server avoids CORS altogether.

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
  endpoint: "https://your-api.example",
});
```

Same payload and endpoint as the element. Rejects with a `ReactionsError` (`code`, `status`) if it fails after one retry.

## Styling

CSS custom properties: `--ur-font`, `--ur-text`, `--ur-muted`, `--ur-accent`, `--ur-bg`, `--ur-radius`, `--ur-gap`.
Parts: `question`, `button`, `button-selected`, `scale-label` (csat/ces end captions), `comment`, `send`, `thanks`.

```css
user-reactions { --ur-accent: #2563eb; --ur-muted: #667085; }
user-reactions::part(button-selected) { background: #2563eb22; }
```

## Development

Requires Node 22.12+ for development (Vitest 5); `nvm use` picks it up from `.nvmrc`.

```sh
npm install
npm run dev     # demo at http://localhost:5173/demo/ with a mock API that logs payloads
                # your own test page: put it in demo/ and set endpoint="/mock"
                # after npm run build: /demo/embed.html tests the built bundle on a plain page
npm test        # Vitest + happy-dom, payloads checked against docs/api/openapi.yaml
npm run build   # dist/user-reactions.mjs, dist/user-reactions.js, dist/types; fails over the size budget
npm run size    # size check of the IIFE build (≤ 8 kB min+gzip)
npm run pack:check  # after build: checks the npm tarball installs and works for consumers
```

CI (`.github/workflows/ci.yml`) runs typecheck, tests, build, size and package checks on every pull request, on Node 22 and 24.

## Releasing

Releases are published from CI when the maintainer pushes a version tag, after approval:

1. A `Release x.y.z` PR bumps the version (`npm version x.y.z --no-git-tag-version`) and the changelog heading.
2. After it is merged, the maintainer runs `git tag vx.y.z && git push origin vx.y.z` on `main`.
3. The Release workflow verifies, waits for approval, then publishes to npm and creates the GitHub Release.

One-time setup and details: [`docs/releasing.md`](docs/releasing.md). Changes are listed in [`CHANGELOG.md`](CHANGELOG.md).

The mock answers `POST /mock/v1/feedback` and `/mock/v1/impressions` with 202 (400 if the body breaks the API contract). Tick "Simulate API outage" in the demo to send to `/mock/fail`, which answers 503.

## License

MIT. See [LICENSE](LICENSE).
