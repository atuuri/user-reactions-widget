# Widget spec

Status: draft v1 (2026-11-12)

## Purpose
An inline feedback element that teams drop next to an AI answer or a key flow in their product. It captures a rating, an optional comment and the context of what was rated, and sends it to the ingest API (`docs/api/openapi.yaml`).

The value is the context, not the buttons. Every rating carries `surface`, `subject` and `meta`, so the report can show which answer, feature or release a rating belongs to.

## Element

```html
<script src="https://cdn.jsdelivr.net/npm/@user-reactions/widget@0.1/dist/user-reactions.js" defer></script>

<user-reactions
  project-key="pk_live_xxx"
  type="thumbs"
  surface="assistant-answer"
  subject="msg_8f2c"
  meta='{"model":"gpt-x","release":"2026.11.2"}'
  comment="on-negative"
  lang="fi">
</user-reactions>
```

The tag name `user-reactions` matches the repo name and the npm org; the package is `@user-reactions/widget`, served from npm by jsDelivr and unpkg.

### Attributes

| Attribute | Required | Values | Notes |
|---|---|---|---|
| `project-key` | yes | string | Public, write-only project key. Sent as `X-Project-Key`. |
| `type` | yes | `thumbs`, `csat`, `ces` | Scale to render. |
| `surface` | yes | string ≤ 100 | Where in the product, e.g. `assistant-answer`, `checkout`. |
| `subject` | no | string ≤ 200 | What exactly was rated, e.g. message id, order step. |
| `meta` | no | JSON object, string values, ≤ 20 keys | Free context: model, prompt version, release, experiment. Invalid JSON → ignored, `error` event fired. |
| `comment` | no | `off` (default), `optional`, `on-negative` | `on-negative`: show comment box only for thumbs down, CSAT 1–2, CES 1–3. |
| `question` | no | string | Overrides the default question text. |
| `lang` | no | `en` (default), `fi`, `sv` | Built-in strings. |
| `endpoint` | no | URL | Defaults to the hosted API; used for self-hosting and the dev mock. |

### Scales and stored scores

| Type | Buttons | Score sent |
|---|---|---|
| `thumbs` | 👍 / 👎 (icons, labelled) | 1 = up, 0 = down |
| `csat` | 1–5 | 1–5, 5 = very satisfied |
| `ces` | 1–7 | 1–7, 7 = very easy |

### Default strings

| Key | en | fi | sv |
|---|---|---|---|
| thumbs question | Was this helpful? | Oliko tästä apua? | Var detta till hjälp? |
| csat question | How satisfied are you? | Kuinka tyytyväinen olet? | Hur nöjd är du? |
| ces question | How easy was this? | Kuinka helppoa tämä oli? | Hur enkelt var detta? |
| comment placeholder | Tell us more (optional) | Kerro lisää (vapaaehtoinen) | Berätta mer (valfritt) |
| send | Send | Lähetä | Skicka |
| thanks | Thanks for your feedback | Kiitos palautteestasi | Tack för din feedback |

Native-speaker review of fi/sv strings before first pilot.

## Behaviour

1. **Render**: question and buttons. No network calls yet.
2. **Impression**: the first time at least 50% of the element is visible (IntersectionObserver), send one `POST /v1/impressions`. Once per element instance. This makes the response rate measurable.
3. **Rate**: on click, mark the button as selected and immediately `POST /v1/feedback` with a client-generated UUID `id`.
4. **Change rating**: clicking another button re-sends with the **same `id`** (server upserts). Allowed until a comment is sent.
5. **Comment** (if enabled for that score): show textarea (max 2000 chars) and Send. Send re-posts the same `id` with `comment`. Then show the thanks state.
6. **Thanks**: if no comment box applies, show thanks right after rating. The buttons stay usable, so the rating can still change. Once a comment is sent, the buttons are locked (`aria-disabled`). Send with an empty box just shows thanks.
7. **Failure**: on a network error, HTTP 429 or 5xx, retry once after 1 s; a 4xx (bad payload, unknown key) is not retried. If it still fails, fire `error` and keep the UI usable: the user can click again, and a failed comment keeps its text. Never throw into the host page.
8. **Attribute changes**: changing `subject` or `meta` after render resets the element (new instance, new id). Needed for chat UIs that reuse nodes.

## Events (CustomEvent, bubbles, composed)

| Event | `detail` |
|---|---|
| `user-reactions:rated` | `{ id, type, score, surface, subject }` |
| `user-reactions:commented` | `{ id, comment }` |
| `user-reactions:error` | `{ code, message }` |

`rated` fires when the user selects a score, before the request completes, so the host can react immediately. `commented` fires once the API has accepted the comment.

Error codes:

| `code` | When |
|---|---|
| `invalid-attribute` | `project-key` or `surface` missing, `surface`/`subject` too long, or `type` not supported. Nothing is rendered. |
| `invalid-meta` | `meta` is not a JSON object of ≤ 20 string values (≤ 200 chars). `meta` is ignored; the element still works. |
| `network` | The request could not be made (offline, DNS, CORS), after the retry. |
| `http` | The API answered with a non-2xx status (after the retry for 429/5xx). `message` includes the status. |
| `internal` | Unexpected exception inside the element. |

Configuration errors are dispatched in a microtask, so listeners added right after inserting the element still receive them.

Host apps (including AI chat UIs) use these to react, e.g. offer a regenerate button after a thumbs-down.

## Headless client

For surfaces that cannot render the element (native mobile, server-side, MCP Apps / chat-host UIs), export a tiny function from the ES module:

```ts
import { sendFeedback } from "@user-reactions/widget";
await sendFeedback({ projectKey, type: "thumbs", score: 0, surface, subject, meta, comment });
```

Same payload and endpoint as the element, with `client: "headless@<version>"` instead of `widget@<version>`. Optional `id` (to update an earlier item) and `endpoint`. Resolves with `{ id }`; rejects with a `ReactionsError` (`code` as in the error table, plus `status` for `http`) after the same retry rule. Importing the module outside a browser does not register the element.

## Styling

- CSS custom properties: `--ur-font`, `--ur-text`, `--ur-muted`, `--ur-accent`, `--ur-bg`, `--ur-radius`, `--ur-gap`.
- Parts: `question`, `button`, `button-selected`, `comment`, `send`, `thanks`.
- Inherit font by default; looks native in light and dark host pages.
- Compact by default (one line for thumbs).

## Accessibility

- Buttons have labels (e.g. "Helpful", "Not helpful", "1 of 5 – very dissatisfied").
- `aria-pressed` on the selected button.
- Arrow keys move between scale buttons; Enter/Space selects.
- Thanks state is announced with `role="status"`.

## Dev setup

- `npm run dev` serves `demo/index.html` with four examples (thumbs in a fake chat list, thumbs at the end of a knowledge-base article, CSAT, CES) and a mock endpoint that logs payloads to the console and the page.
- Mock endpoint: `POST /mock/v1/feedback` and `/mock/v1/impressions` answer 202, or 400 if the body breaks `docs/api/openapi.yaml`. `/mock/fail/v1/*` answers 503 to exercise the retry and error path. M1 ships the thumbs example only; CSAT and CES examples arrive with M2.

## Milestones

1. **M1 Thumbs**: element with `thumbs`, impressions, comment modes, events, headless client, demo page, tests, size check, README. English strings only; other `type` values fire `invalid-attribute` until M2.
2. **M2 Scales**: `csat` and `ces`, keyboard navigation for scales, fi/sv strings.
3. **M3 Polish**: dark-mode check, reduced motion, attribute-reset behaviour, publish to npm as `@user-reactions/widget` 0.1.0 (see `docs/releasing.md`).

## Acceptance criteria (M1)

- Embedding with one `<script>` tag and one element works on a plain HTML page.
- Thumbs down with `comment="on-negative"` shows the comment box; thumbs up does not.
- Changing the rating re-sends with the same `id`.
- Exactly one impression per element instance.
- Network failure fires `user-reactions:error` and does not throw.
- IIFE bundle ≤ 8 kB min+gzip.
- Tests cover payload shape against `docs/api/openapi.yaml` examples.

## Out of scope

Targeting and triggers, pop-ups and modals, multi-question surveys, NPS, native iOS/Android SDKs, offline queueing, analytics, any storage of user identity.
