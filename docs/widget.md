# Widget spec

Status: draft v1 (2026-11-12). The single source for behaviour, attributes, events and styling; the README only links here. Future work: [M4 suggestions](m4-suggestions.md), [M6 floating placement](m6-floating.md).

## Purpose
An inline feedback element that teams drop next to an AI answer or a key flow. It captures a rating, an optional comment and the context of what was rated (`surface`, `subject`, `meta`), and sends it to the ingest API (`docs/api/openapi.yaml`). The value is the context, not the buttons.

## Element

```html
<script src="https://cdn.jsdelivr.net/npm/@user-reactions/widget@0.1.0/dist/user-reactions.js" defer></script>

<user-reactions project-key="pk_live_xxx" type="thumbs" surface="assistant-answer" subject="msg_8f2c"
  meta='{"model":"gpt-x","release":"2026.11.2"}' comment="on-negative" lang="fi"
  endpoint="https://your-api.example"></user-reactions>
```

Package `@user-reactions/widget`, served from npm by jsDelivr and unpkg. Pin the version; pre-releases (for example `0.2.0-beta.1`) are published under the npm `next` tag and are not matched by ranges such as `@0.2`.

### Attributes

| Attribute | Required | Values | Notes |
|---|---|---|---|
| `project-key` | yes | string | Public, write-only project key. Sent as `X-Project-Key`. |
| `type` | yes | `thumbs`, `csat`, `ces` | Scale to render. |
| `surface` | yes | string ≤ 100 | Where in the product, e.g. `assistant-answer`, `checkout`. |
| `subject` | no | string ≤ 200 | What was rated, e.g. message id, order step. |
| `meta` | no | JSON object, string values, ≤ 20 keys | Model, prompt version, release, experiment. Invalid → ignored, `invalid-meta` fired. |
| `comment` | no | `off` (default), `optional`, `on-negative` | `on-negative`: comment box only for thumbs down, CSAT 1–2, CES 1–3. |
| `question` | no | string | Overrides the question. `question=""` hides it; the default text still labels the button group for screen readers. |
| `after-send` | no | `replace` (default), `keep` | After the final send, `replace` leaves only the thanks text; `keep` keeps the question and buttons (0.1 behaviour). Unknown values act as `replace`. Read when feedback becomes final; changing it does not reset. |
| `thanks` | no | string | Overrides the thanks text in both modes, shown as given and not translated. An empty value keeps the default. Changing it does not reset. |
| `lang` | no | `en` (default), `fi`, `sv` | Built-in strings, matched by primary subtag (`fi-FI` → `fi`); other languages show English. Sent as `locale` as given. |
| `endpoint` | yes, until the hosted API launches | URL | API base URL; the element appends `/v1/impressions` and `/v1/feedback`. Without it the element renders, but each request it would send fires `invalid-attribute` instead. |

### Scales and stored scores

| Type | Buttons | Score sent |
|---|---|---|
| `thumbs` | 👍 / 👎 (icons, labelled) | 1 = up, 0 = down |
| `csat` | 1–5 | 5 = very satisfied |
| `ces` | 1–7 | 7 = very easy |

Scale buttons show the number and are labelled "`n` of `max` – `point`" (also the tooltip). Points, lowest first:
- `csat`: very dissatisfied, dissatisfied, neutral, satisfied, very satisfied.
- `ces`: very difficult, difficult, somewhat difficult, neither easy nor difficult, somewhat easy, easy, very easy.

Captions under the first and last button name the ends; they are `aria-hidden`, since the button labels already say it.

### Default strings

`src/strings.ts` is the source for every built-in string in en, fi and sv: questions, "Helpful" / "Not helpful", scale labels, end captions, placeholder, Send and thanks. A custom `question` or `thanks` is shown as given and is not translated.

## Behaviour

1. **Render**: question and buttons. No network calls.
2. **Impression**: the first time ≥ 50% is visible (IntersectionObserver), one `POST /v1/impressions` per element instance, so the response rate is measurable.
3. **Rate**: on click, mark the button selected and `POST /v1/feedback` with a client-generated UUID `id`.
4. **Change rating**: another click re-sends with the **same `id`** (server upserts). Allowed until feedback is final (behaviour 6).
5. **Comment** (if enabled for that score): textarea (max 2000 chars) and Send, which re-posts the same `id` with `comment`, then shows thanks.
6. **Thanks**: without a comment box, thanks shows right after rating. Feedback is **final**:
   - with no comment box for the chosen score, once the API accepts the rating (the latest one, if the rating changed while a request was in flight);
   - with the comment box shown, once the API accepts the comment. An empty Send posts nothing and is final once the rating has been accepted.

   What happens then depends on `after-send`, read at that moment:
   - **`replace`** (default): the question, buttons, captions and comment box are removed and only the thanks text stays, in the `thanks` part with `role="status"`. If focus was inside the element, it moves to the thanks text (`tabindex="-1"`, no focus ring), so keyboard users are not dropped to the top of the page. A short fade runs only under `prefers-reduced-motion: no-preference`.
   - **`keep`**: as in 0.1. Without a comment box the buttons stay usable; after a comment is sent they are locked (`aria-disabled`) and focus returns to the selected button. Send with an empty box shows thanks right away.
7. **Failure**: on a network error, 429 or 5xx, retry once after 1 s; other 4xx are not retried. If it still fails, fire `error` and keep the UI usable: nothing is replaced, the thanks message is removed, the selection stays and clicking the same button again resends; a failed comment keeps its text. Never throw into the host page.
8. **Attribute changes**: changing `subject`, `meta`, `type`, `lang`, `question` or `comment` resets the element as a new instance: new `id`, nothing selected, comment box and thanks cleared, and one new impression once visible. This also brings back the full element after `replace`. Needed for chat UIs that reuse nodes. Requests already sent keep their old `id` and no longer affect the UI. `endpoint` and `project-key` are read at send time, `after-send` and `thanks` when thanks shows; none of them reset.

Requests are JSON `POST`s with an `X-Project-Key` header, so browsers send a CORS preflight: the server must allow the page origin and the `Content-Type` and `X-Project-Key` headers.

## Events (CustomEvent, bubbles, composed)

| Event | `detail` | Fires |
|---|---|---|
| `user-reactions:rated` | `{ id, type, score, surface, subject }` | On selection, before the request completes |
| `user-reactions:commented` | `{ id, comment }` | Once the API accepts the comment |
| `user-reactions:error` | `{ code, message }` | See below |

| `code` | When |
|---|---|
| `invalid-attribute` | `project-key` or `surface` missing, `surface`/`subject` too long, or unsupported `type`: nothing is rendered. Missing `endpoint`: renders, but fires this per request. |
| `invalid-meta` | `meta` is not a JSON object of ≤ 20 string values (≤ 200 chars). Ignored; the element still works. |
| `network` | Request could not be made (offline, DNS, CORS), after the retry. |
| `http` | Non-2xx response (after the retry for 429/5xx). `message` includes the status. |
| `internal` | Unexpected exception inside the element. |

Configuration errors are dispatched in a microtask, so listeners added right after insertion still receive them. Hosts use events to react, e.g. offer "regenerate" after a thumbs-down.

## Headless client

For surfaces that cannot render the element (native apps, servers, MCP Apps / chat hosts):

```ts
import { sendFeedback } from "@user-reactions/widget";
const { id } = await sendFeedback({ projectKey, type: "thumbs", score: 0, surface, subject, meta, comment, endpoint });
```

Same payload and endpoint as the element, with `client: "headless@<version>"`. Optional `id` updates an earlier item. Without `endpoint` it rejects with `invalid-attribute` and sends nothing. Rejects with `ReactionsError` (`code` as above, plus `status` for `http`) after the same retry rule. Importing outside a browser does not register the element.

## Styling

- Custom properties: `--ur-font`, `--ur-text`, `--ur-muted`, `--ur-accent`, `--ur-bg`, `--ur-radius`, `--ur-gap`.
- Parts: `question`, `button`, `button-selected`, `scale-label` (csat/ces end captions), `comment`, `send`, `thanks`.
- Inherits font; looks native on light and dark pages. Colours derive from the text colour (borders at 50%, focus ring and selected state at full strength) unless `--ur-*` is set, with system colours (`GrayText`) as fallbacks. Compact: one line for thumbs, scales add a caption line.
- The comment box radius is capped at 12 px, so a pill `--ur-radius` only rounds the buttons.
- Transitions and the fade after `replace` run only under `prefers-reduced-motion: no-preference`.

## Accessibility

- Labelled buttons ("Helpful", "Not helpful", "1 of 5 – very dissatisfied"), `aria-pressed` on the selected one.
- Scales are one Tab stop (selected button, else the first). ←/→ and ↑/↓ move focus without selecting, Home/End jump to the ends, Enter/Space select. Thumbs keep both buttons in the Tab order.
- Thanks is announced with `role="status"`. After `replace`, focus that was inside the element moves to the thanks text.

## Milestones

1. **M1 Thumbs** – done (0.1.0-beta.1).
2. **M2 Scales** – done (0.1.0-beta.3).
3. **M3 Polish** – done (0.1.0):
   - **fi/sv strings** for every visible string, including scale labels and captions. `lang` matches the primary subtag (`fi-FI` → `fi`); unknown languages fall back to English. Native-speaker review before the first pilot.
   - **Attribute reset** (behaviour 8): new `id`, nothing selected, comment box and thanks cleared, one new impression when visible. Changing `type`, `lang`, `question` or `comment` re-renders the same way.
   - **Dark-mode check** on dark pages, with and without `--ur-*`: borders, focus ring, selected state, captions, comment box. System colours as fallbacks.
   - **Reduced motion**: transitions only under `prefers-reduced-motion: no-preference`, with a test.
   - **Beta findings**: cap the comment box radius (about 12 px) so a pill `--ur-radius` does not round it; after a final failed send, remove the thanks message and keep the selection, so clicking again resends.
   - **0.1.0**: README drops the pre-release notes; the release takes npm `latest`.
4. **M5 Replace with thanks**, current, released as 0.2.0 (moved ahead of M4): once feedback is final, the element is replaced by the thanks message by default (`after-send="keep"` opts out); custom `thanks` text. Default change listed in the changelog with the opt-out; README install snippet moves to 0.2.0 at release. Demo examples for both modes.
5. **M4 Suggestions**, released as 0.3.0: see [m4-suggestions.md](m4-suggestions.md).
6. **M6 Floating placement**, released as 0.4.0: `placement="floating"` shows a card in the bottom-right corner; `inline` stays the default. See [m6-floating.md](m6-floating.md).

## Acceptance criteria (M5)

- Default: after a thumbs rating with no comment box is accepted, only the thanks text is shown, with `role="status"`; no buttons remain.
- With a comment box: the element is replaced only after the comment (or an empty Send) is accepted; the rating can be changed until then.
- A final failed send replaces nothing; the selection and comment text stay and `error` fires.
- If focus was on a button or Send, it ends on the thanks text after the swap.
- Changing `subject` or `meta` after the swap shows the full element again, with a new `id` and one new impression.
- `after-send="keep"` passes the existing M1–M3 tests unchanged.
- `thanks="…"` replaces the default text in both modes; `thanks=""` keeps the default.
- With `prefers-reduced-motion: reduce`, nothing animates.
- IIFE bundle ≤ 8 kB min+gzip.

M1–M3 criteria are covered by the tests in `test/`; M5 by `test/thanks.test.ts`.

## Out of scope

Targeting and triggers, pop-ups and modals, multi-question surveys, NPS, native iOS/Android SDKs, offline queueing, analytics, any storage of user identity.
