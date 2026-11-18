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
| `type` | yes | `thumbs`, `csat`, `ces`, `suggestion` | Scale to render, or `suggestion` for a standalone "Suggest improvements" toggle with no rating (M4, see [Suggestions](#suggestions-m4)). |
| `surface` | yes | string ≤ 100 | Where in the product, e.g. `assistant-answer`, `checkout`. |
| `subject` | no | string ≤ 200 | What exactly was rated, e.g. message id, order step. |
| `meta` | no | JSON object, string values, ≤ 20 keys | Free context: model, prompt version, release, experiment. Invalid JSON → ignored, `error` event fired. |
| `comment` | no | `off` (default), `optional`, `on-negative` | `on-negative`: show comment box only for thumbs down, CSAT 1–2, CES 1–3. Ignored for `suggestion`, which always has a text box. |
| `question` | no | string | Overrides the default question text. An empty value (`question=""`) hides the question and shows only the buttons; the default question text still labels the button group for screen readers. For `suggestion` it overrides the toggle label; an empty value keeps the default. |
| `lang` | no | `en` (default), `fi`, `sv` | Built-in strings. |
| `endpoint` | yes, until the hosted API launches | URL | API base URL; the element appends `/v1/...`. Used for self-hosting and the dev mock. Without it nothing is sent and `invalid-attribute` fires on each request the element would make; the element still renders. |

### Scales and stored scores

| Type | Buttons | Score sent |
|---|---|---|
| `thumbs` | 👍 / 👎 (icons, labelled) | 1 = up, 0 = down |
| `csat` | 1–5 | 1–5, 5 = very satisfied |
| `ces` | 1–7 | 1–7, 7 = very easy |

Scale buttons show the number and are labelled "`n` of `max` – `point`" (also the tooltip). Points, lowest first:
- `csat`: very dissatisfied, dissatisfied, neutral, satisfied, very satisfied.
- `ces`: very difficult, difficult, somewhat difficult, neither easy nor difficult, somewhat easy, easy, very easy.

Captions under the first and last button name the ends ("Very dissatisfied" … "Very satisfied"), so the direction is clear without hovering. They are hidden from screen readers, which already hear the button labels.

### Default strings

| Key | en | fi | sv |
|---|---|---|---|
| thumbs question | Was this helpful? | Oliko tästä apua? | Var detta till hjälp? |
| csat question | How satisfied are you? | Kuinka tyytyväinen olet? | Hur nöjd är du? |
| ces question | How easy was this? | Kuinka helppoa tämä oli? | Hur enkelt var detta? |
| comment placeholder | Tell us more (optional) | Kerro lisää (vapaaehtoinen) | Berätta mer (valfritt) |
| send | Send | Lähetä | Skicka |
| thanks | Thanks for your feedback | Kiitos palautteestasi | Tack för din feedback |
| suggest toggle (M4) | Suggest improvements | Ehdota parannuksia | Föreslå förbättringar |
| suggest placeholder (M4) | What could we improve? | Mitä voisimme parantaa? | Vad kan vi förbättra? |
| suggest thanks (M4) | Thanks for your suggestion | Kiitos ehdotuksestasi | Tack för ditt förslag |

Only English is built in so far: the fi and sv columns ship with M3, and need a native-speaker review before the first pilot. M3 also adds fi/sv for the strings that are only in the code so far: "Helpful" / "Not helpful", the scale labels ("`n` of `max` – `point`") and the scale end captions. Until then `lang` is sent as `locale` but the text stays English.

## Behaviour

1. **Render**: question and buttons. No network calls yet.
2. **Impression**: the first time at least 50% of the element is visible (IntersectionObserver), send one `POST /v1/impressions`. Once per element instance. This makes the response rate measurable.
3. **Rate**: on click, mark the button as selected and immediately `POST /v1/feedback` with a client-generated UUID `id`.
4. **Change rating**: clicking another button re-sends with the **same `id`** (server upserts). Allowed until a comment is sent.
5. **Comment** (if enabled for that score): show textarea (max 2000 chars) and Send. Send re-posts the same `id` with `comment`. Then show the thanks state.
6. **Thanks**: if no comment box applies, show thanks right after rating. The buttons stay usable, so the rating can still change. Once a comment is sent, the buttons are locked (`aria-disabled`). Send with an empty box just shows thanks.
7. **Failure**: on a network error, HTTP 429 or 5xx, retry once after 1 s; a 4xx (bad payload, unknown key) is not retried. If it still fails, fire `error` and keep the UI usable: the user can click again, and a failed comment keeps its text. Never throw into the host page.
8. **Attribute changes**: changing `subject` or `meta` after render resets the element (new instance, new id). Needed for chat UIs that reuse nodes.

## Suggestions (M4)

`type="suggestion"` is its own element, with no rating: a place for free-text improvement ideas, e.g. in a page footer or a settings screen. It is not combined with a rating element.

```html
<user-reactions project-key="pk_live_xxx" type="suggestion"
  surface="billing" subject="invoices-page" endpoint="https://api.example.com"></user-reactions>
```

1. **Render**: a text button "Suggest improvements" (part `suggest`) with `aria-expanded="false"`. No network calls yet.
2. **Impression**: as for ratings, one `POST /v1/impressions` with `type: "suggestion"` the first time at least 50% is visible.
3. **Open**: clicking the toggle shows a textarea (part `comment`, max 2000 chars, placeholder "What could we improve?") and Send (part `send`), sets `aria-expanded="true"` and moves focus to the textarea. Clicking the toggle again, or Escape in the textarea, closes the box, keeps the text and returns focus to the toggle.
4. **Send**: posts `POST /v1/feedback` with a new client-generated `id`, `type: "suggestion"`, `comment`, and `surface`, `subject`, `meta`, `locale`, `client` as for ratings. No `score`. Send with an empty box does nothing.
5. **Thanks**: after the API accepts it, the box closes and "Thanks for your suggestion" is announced (`role="status"`). The toggle stays, so another suggestion can be sent; each one gets a new `id`.
6. **Failure**: same retry rule as ratings. On final failure, fire `error`, keep the box open with the text, and show no thanks.
7. **Attribute changes**: as behaviour 8 (M3), changing `subject` or `meta` resets the element.

The API side is in `docs/api/openapi.yaml`: `suggestion` is a feedback type where `comment` is required and `score` is not allowed. The ingest server must accept it before a release that ships this element.

## Events (CustomEvent, bubbles, composed)

| Event | `detail` |
|---|---|
| `user-reactions:rated` | `{ id, type, score, surface, subject }` |
| `user-reactions:commented` | `{ id, comment }` |
| `user-reactions:suggested` (M4) | `{ id, comment, surface, subject }` |
| `user-reactions:error` | `{ code, message }` |

`rated` fires when the user selects a score, before the request completes, so the host can react immediately. `commented` and `suggested` fire once the API has accepted the text.

Error codes:

| `code` | When |
|---|---|
| `invalid-attribute` | `project-key` or `surface` missing, `surface`/`subject` too long, or `type` not supported: nothing is rendered. `endpoint` missing: the element renders, but each request it would send fires this instead. |
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
await sendFeedback({ projectKey, type: "suggestion", surface, comment: "Let me export invoices as CSV." }); // M4: no score
```

Same payload and endpoint as the element, with `client: "headless@<version>"` instead of `widget@<version>`. Optional `id` (to update an earlier item). `endpoint` is required until the hosted API launches; without it the call rejects with `invalid-attribute` and sends nothing. Resolves with `{ id }`; rejects with a `ReactionsError` (`code` as in the error table, plus `status` for `http`) after the same retry rule. Importing the module outside a browser does not register the element.

## Styling

- CSS custom properties: `--ur-font`, `--ur-text`, `--ur-muted`, `--ur-accent`, `--ur-bg`, `--ur-radius`, `--ur-gap`.
- Parts: `question`, `button`, `button-selected`, `scale-label` (csat/ces end captions), `suggest` (the suggestion toggle, M4), `comment`, `send`, `thanks`.
- Inherit font by default; looks native in light and dark host pages.
- Compact by default (one line for thumbs; scales add a caption line under the buttons).

## Accessibility

- Buttons have labels (e.g. "Helpful", "Not helpful", "1 of 5 – very dissatisfied").
- `aria-pressed` on the selected button.
- Scales (`csat`, `ces`) are one Tab stop: Tab lands on the selected button, or the first one. ←/→ (and ↑/↓) move focus between scale buttons without selecting; Home/End jump to the ends; Enter/Space select. Thumbs keep both buttons in the Tab order.
- Thanks state is announced with `role="status"`.
- Suggestion toggle (M4): a real `<button>` with `aria-expanded` and `aria-controls` pointing at the text box; Escape in the box closes it and returns focus to the toggle.

## Dev setup

- `npm run dev` serves `demo/index.html` with four examples (thumbs in a fake chat list, thumbs at the end of a knowledge-base article, CSAT, CES) and a mock endpoint that logs payloads to the console and the page.
- Mock endpoint: `POST /mock/v1/feedback` and `/mock/v1/impressions` answer 202, or 400 if the body breaks `docs/api/openapi.yaml`. `/mock/fail/v1/*` answers 503 to exercise the retry and error path.
- `demo/embed.html` loads the built `dist/user-reactions.js` with one script tag on a plain page (run `npm run build` first). It covers thumbs, CSAT and CES.

## Milestones

1. **M1 Thumbs**: element with `thumbs`, impressions, comment modes, events, headless client, demo page, tests, size check, README. English strings only.
2. **M2 Scales**: `csat` and `ces`, keyboard navigation for scales. Unknown `type` values fire `invalid-attribute`.
3. **M3 Polish**, released as 0.1.0 (see `docs/releasing.md`):
   - **fi/sv strings** (moved from M2) for every visible string, including the scale labels and captions. `lang` matches on the primary subtag (`fi-FI` → `fi`); unknown languages fall back to English. Native-speaker review before the first pilot.
   - **Attribute reset** (behaviour 8): changing `subject` or `meta` resets the element: new `id`, nothing selected, comment box and thanks cleared, one new impression when visible. Changing `type`, `lang`, `question` or `comment` re-renders the same way.
   - **Dark-mode check** on dark host pages, with and without `--ur-*` set: borders, focus ring, selected state, captions, comment box. Fix contrast issues; system colours as fallbacks.
   - **Reduced motion**: keep transitions behind `prefers-reduced-motion: no-preference`, with a test so nothing new animates.
   - **Beta findings**: cap the comment box radius (about 12 px) so a pill `--ur-radius` does not round it; after the final failed send, remove the thanks message and keep the selection, so clicking again resends (the `error` event still fires, no visible error text).
   - **0.1.0**: README drops the pre-release notes; the release takes npm `latest`.
4. **M4 Suggestions**, released as 0.2.0: standalone `type="suggestion"` element ([Suggestions](#suggestions-m4)), `user-reactions:suggested` event, `sendFeedback()` with `type: "suggestion"`, fi/sv strings, demo example. Needs the ingest server to accept `type: "suggestion"` first.

## Acceptance criteria (M1)

- Embedding with one `<script>` tag and one element works on a plain HTML page.
- Thumbs down with `comment="on-negative"` shows the comment box; thumbs up does not.
- Changing the rating re-sends with the same `id`.
- Exactly one impression per element instance.
- Network failure fires `user-reactions:error` and does not throw.
- IIFE bundle ≤ 8 kB min+gzip.
- Tests cover payload shape against `docs/api/openapi.yaml` examples.

## Acceptance criteria (M2)

- `type="csat"` shows buttons 1–5 and sends scores 1–5; `type="ces"` shows 1–7 and sends 1–7, with labels and end captions as above.
- `comment="on-negative"` shows the comment box for CSAT 1–2 and CES 1–3, and not for higher scores.
- Changing a scale rating re-sends with the same `id`; impressions, events, retry and `question=""` behave as for thumbs.
- A scale is one Tab stop; arrow keys and Home/End move focus within it; Enter/Space select.
- A CES rating from the element matches the `ces` example in `docs/api/openapi.yaml`.
- The built IIFE renders CSAT and CES on a plain HTML page and stays ≤ 8 kB min+gzip.

## Acceptance criteria (M3)

- With `lang="fi"` / `"sv"` (and `"fi-FI"`), every visible string and button label is in that language; unknown languages show English.
- Changing `subject` or `meta` on a rendered element: the next rating uses a new `id`, nothing is selected, and exactly one new impression is sent for the new instance. A reused node never re-sends with the old `id`.
- The widget is readable on a dark host page with no `--ur-*` set: text, borders, focus ring and selected state meet WCAG AA contrast.
- With `prefers-reduced-motion: reduce`, nothing transitions or animates.
- A pill `--ur-radius` does not round the comment box beyond about 12 px.
- After a final failed send, no thanks message is shown; clicking the same button resends.
- IIFE bundle ≤ 8 kB min+gzip.

## Acceptance criteria (M4)

- `type="suggestion"` renders only the "Suggest improvements" toggle; no rating buttons, no score sent.
- The toggle opens and closes the text box with `aria-expanded`; Escape closes it and returns focus.
- Send posts a feedback item that matches the `suggestion` example in `docs/api/openapi.yaml` (apart from `id` and `client`); empty Send posts nothing.
- Each sent suggestion has a new `id`; `user-reactions:suggested` fires after the API accepts it; a failure keeps the text and fires `error`.
- One impression per element instance, with `type: "suggestion"`.
- `sendFeedback({ type: "suggestion", comment })` sends no score and rejects with `invalid-attribute` without a comment.
- IIFE bundle ≤ 8 kB min+gzip.

## Out of scope

Targeting and triggers, pop-ups and modals, multi-question surveys, NPS, native iOS/Android SDKs, offline queueing, analytics, any storage of user identity.
