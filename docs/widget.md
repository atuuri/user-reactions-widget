# Widget spec

Status: draft v1 (2026-11-12). The single source for behaviour, attributes, events and styling; the README only links here. Future work: [impressions opt-out](#future-impressions-opt-out-not-scheduled).

## Purpose
A feedback element that teams drop next to an AI answer or a key flow, inline by default or as a [floating card](#floating-placement-placementfloating) in the corner of the page. It captures a rating, an optional comment (or, with `type="open"`, open feedback with no rating) and the context of what was rated (`surface`, `subject`, `meta`), and sends it to the ingest API (`docs/api/openapi.yaml`). The value is the context, not the buttons.

## Element

```html
<script src="https://cdn.jsdelivr.net/npm/@user-reactions/widget@0.2.0/dist/user-reactions.js" defer></script>

<user-reactions project-key="pk_live_xxx" type="thumbs" surface="assistant-answer" subject="msg_8f2c"
  meta='{"model":"gpt-x","release":"2026.11.2"}' comment="on-negative" lang="fi"
  endpoint="https://your-api.example"></user-reactions>
```

Package `@user-reactions/widget`, served from npm by jsDelivr and unpkg. Pin the version; pre-releases (for example `0.2.0-beta.1`) are published under the npm `next` tag and are not matched by ranges such as `@0.2`.

### Attributes

| Attribute | Required | Values | Notes |
|---|---|---|---|
| `project-key` | yes | string | Public, write-only project key. Sent as `X-Project-Key`. |
| `type` | yes | `thumbs`, `csat`, `ces`, `open` | Scale to render, or `open` for free text with no rating ([Open feedback](#open-feedback-typeopen)). |
| `surface` | yes | string ≤ 100 | Where in the product, e.g. `assistant-answer`, `checkout`. |
| `subject` | no | string ≤ 200 | What was rated, e.g. message id, order step. |
| `meta` | no | JSON object, string values, ≤ 20 keys | Model, prompt version, release, experiment. Invalid → ignored, `invalid-meta` fired. |
| `comment` | no | `off` (default), `optional`, `on-negative` | `on-negative`: comment box only for thumbs down, CSAT 1–2, CES 1–3. Ignored for `open`, which always has a text box. |
| `question` | no | string | Overrides the question. `question=""` hides it; the default text still labels the button group for screen readers. For `open` it relabels the toggle, and an empty value keeps the default. |
| `after-send` | no | `replace` (default), `keep` | After the final send, `replace` leaves only the thanks text; `keep` keeps the question and buttons (0.1 behaviour). Unknown values act as `replace`. Read when feedback becomes final; changing it does not reset. |
| `thanks` | no | string | Overrides the thanks text in both modes, shown as given and not translated. An empty value keeps the default. Changing it does not reset. |
| `placement` | no | `inline` (default), `floating` | `floating` shows the element as a card fixed to the bottom-right corner ([Floating placement](#floating-placement-placementfloating)). Unknown values act as `inline`. Changing it does not reset. |
| `lang` | no | `en` (default), `fi`, `sv` | Built-in strings, matched by primary subtag (`fi-FI` → `fi`); other languages show English. Sent as `locale` as given. |
| `endpoint` | yes, until the hosted API launches | URL | API base URL; the element appends `/v1/impressions` and `/v1/feedback`. Without it the element renders, but each request it would send fires `invalid-attribute` instead. |

### Scales and stored scores

| Type | Buttons | Score sent |
|---|---|---|
| `thumbs` | 👍 / 👎 (icons, labelled) | 1 = up, 0 = down |
| `csat` | 1–5 | 5 = very satisfied |
| `ces` | 1–7 | 7 = very easy |
| `open` | none: a toggle and a text box | no score; `comment` is required |

Scale buttons show the number and are labelled "`n` of `max` – `point`" (also the tooltip). Points, lowest first:
- `csat`: very dissatisfied, dissatisfied, neutral, satisfied, very satisfied.
- `ces`: very difficult, difficult, somewhat difficult, neither easy nor difficult, somewhat easy, easy, very easy.

Captions under the first and last button name the ends; they are `aria-hidden`, since the button labels already say it.

### Default strings

`src/strings.ts` is the source for every built-in string in en, fi and sv: questions, "Helpful" / "Not helpful", scale labels, end captions, placeholder, Send and thanks, and for `open` the toggle label ("Give feedback") and its placeholder ("What would you like to tell us?"). `open` uses the same Send and thanks strings as ratings. A custom `question` or `thanks` is shown as given and is not translated.

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
8. **Attribute changes**: changing `subject`, `meta`, `type`, `lang`, `question` or `comment` resets the element as a new instance: new `id`, nothing selected, comment box and thanks cleared, and one new impression once visible. This also brings back the full element after `replace`. Needed for chat UIs that reuse nodes. Requests already sent keep their old `id` and no longer affect the UI. `endpoint` and `project-key` are read at send time, `after-send` and `thanks` when thanks shows, and `placement` applies at once; none of them reset.

### Open feedback (`type="open"`)

A standalone element with no rating: a place for any free-text feedback (ideas, problems, questions), e.g. in a page footer or settings screen. It is not combined with a rating element.

```html
<user-reactions project-key="pk_live_xxx" type="open"
  surface="billing" subject="invoices-page" endpoint="https://api.example.com"></user-reactions>
```

1. **Render**: a text `<button>` (part `toggle`, "Give feedback" or `question`) with `aria-expanded="false"` and `aria-controls` pointing at the text box. No network calls.
2. **Impression**: as for ratings, with `type: "open"`.
3. **Open**: the toggle shows the text box (max 2000 chars) and Send, sets `aria-expanded="true"` and focuses the box. The toggle again, or Escape inside the box, closes it, keeps the text and returns focus to the toggle.
4. **Send**: `POST /v1/feedback` with `id`, `type: "open"`, `comment`, and `surface`, `subject`, `meta`, `locale`, `client` as for ratings. No `score`. An empty Send does nothing. The feedback is final once the API accepts it.
5. **Thanks**: `after-send` applies as in behaviour 6. With `replace` (default) the toggle and box are replaced by the thanks text, and focus inside the element moves to it. With `keep` the box closes and clears, thanks shows in the `thanks` part, focus inside the element returns to the toggle, and the next feedback gets a new `id`.
6. **Failure**: same retry rule. On final failure fire `error`, keep the box open with the text and show no thanks; Send again resends with the same `id`.
7. **Attribute changes**: as behaviour 8.

### Floating placement (`placement="floating"`)

The element shows as a small card fixed to the bottom-right corner of the viewport instead of in the page flow. It is opt-in and works with every `type`, including `open`. The card is never triggered: it shows like any element, when the host puts it on the page.

```html
<!-- Put it at the end of <body>, so it comes last in the Tab order -->
<user-reactions project-key="pk_live_xxx" type="csat" surface="checkout" placement="floating"
  endpoint="https://api.example.com"></user-reactions>
```

1. **Position**: `position: fixed` at the bottom-right, using logical properties (`inset-block-end`, `inset-inline-end`), so it sits on the left in right-to-left pages. `--ur-offset` from the viewport edges, plus `env(safe-area-inset-*)`. Under 480 px wide it spans the viewport minus `--ur-offset` on each side. The host element is the card, so hosts style it with `user-reactions[placement=floating]` and the usual properties.
2. **Look**: opaque `--ur-bg` (system `Canvas` by default) with `--ur-text` (system `CanvasText` by default), so it reads on any page; `--ur-radius` capped at 12 px like the comment box; a light shadow and a 1 px border at 50% of the text colour.
3. **Close**: a labelled close `<button>` (part `close`) in the top inline-end corner, last in the Tab order, and Escape while focus is inside the card. In open feedback, Escape in the text box closes the box first. Closing hides the card for this page view (the element sets `hidden` on itself) and fires `dismissed` with `reason: "close"`. Nothing is stored; hosts that want dismissal to persist store it themselves. Focus is not moved; hosts that want it somewhere specific set it on `dismissed`.
4. **After thanks**: with `after-send="replace"` (default) the card keeps the thanks text and the close button, then hides about 4 s later and fires `dismissed` with `reason: "done"`. The wait does not run while the pointer is over the card or keyboard focus is inside it, and starts again when both leave. Focus left inside by a mouse click (for example on the thanks text after `replace`) does not hold it, so mouse users are not left with a card that never hides. With `keep` it never hides on its own. A failed send hides nothing.
5. **Not a modal**: no backdrop, no focus trap, no auto-focus. It stays at its own place in the Tab order.
6. **Impression**: as for inline elements; a floating card is usually visible at once, so it fires on show. A dismissed card is done: re-adding the element, or a reset attribute change (behaviour 8), shows it again as a new instance with a new impression.
7. **Motion**: slide-in on show and fade-out on hide only under `prefers-reduced-motion: no-preference`.
8. **One per page**: each floating element positions itself independently, so two would overlap. Use one floating element per page.

Requests are JSON `POST`s with an `X-Project-Key` header, so browsers send a CORS preflight: the server must allow the page origin and the `Content-Type` and `X-Project-Key` headers.

## Events (CustomEvent, bubbles, composed)

| Event | `detail` | Fires |
|---|---|---|
| `user-reactions:rated` | `{ id, type, score, surface, subject }` | On selection, before the request completes |
| `user-reactions:commented` | `{ id, comment }` | Once the API accepts the comment, or the open feedback for `type="open"` |
| `user-reactions:dismissed` | `{ reason }` | Floating only, when the card hides: `"close"` (close button or Escape) or `"done"` (about 4 s after thanks) |
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

For open feedback, pass `type: "open"` and a `comment` and no `score`: `sendFeedback({ projectKey, type: "open", surface, comment, endpoint })`. It never sends a score for `open`, and rejects with `invalid-attribute` and sends nothing when the comment is missing or blank.

Same payload and endpoint as the element, with `client: "headless@<version>"`. Optional `id` updates an earlier item. Without `endpoint` it rejects with `invalid-attribute` and sends nothing. Rejects with `ReactionsError` (`code` as above, plus `status` for `http`) after the same retry rule. Importing outside a browser does not register the element.

## Styling

- Custom properties: `--ur-font`, `--ur-text`, `--ur-muted`, `--ur-accent`, `--ur-bg`, `--ur-radius`, `--ur-gap`; for the floating card also `--ur-offset` (distance from the viewport edges, default 16px) and `--ur-z` (stacking order, default 2147483000).
- Parts: `question`, `button`, `button-selected`, `scale-label` (csat/ces end captions), `toggle` (open feedback), `comment`, `send`, `thanks`, `close` (floating card).
- Inherits font; looks native on light and dark pages. Colours derive from the text colour (borders at 50%, focus ring and selected state at full strength) unless `--ur-*` is set, with system colours (`GrayText`) as fallbacks. Compact: one line for thumbs, scales add a caption line.
- The comment box radius is capped at 12 px, so a pill `--ur-radius` only rounds the buttons.
- Transitions, the fade after `replace` and the floating card's slide-in and fade-out run only under `prefers-reduced-motion: no-preference`.

## Accessibility

- Labelled buttons ("Helpful", "Not helpful", "1 of 5 – very dissatisfied"), `aria-pressed` on the selected one.
- Scales are one Tab stop (selected button, else the first). ←/→ and ↑/↓ move focus without selecting, Home/End jump to the ends, Enter/Space select. Thumbs keep both buttons in the Tab order.
- Open feedback: the toggle is a real `<button>` with `aria-expanded` and `aria-controls`; Escape in the box closes it and returns focus to the toggle.
- Thanks is announced with `role="status"`. After `replace`, focus that was inside the element moves to the thanks text.
- Floating card: a labelled close button ("Close", "Sulje", "Stäng") and Escape; not a modal, so no focus trap and no auto-focus.

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
4. **M5 Replace with thanks** – done (0.2.0; moved ahead of M4): once feedback is final, the element is replaced by the thanks message by default (`after-send="keep"` opts out); custom `thanks` text. Default change listed in the changelog with the opt-out; README install snippet moves to 0.2.0 at release. Demo examples for both modes.
5. **M4 Open feedback** – done (0.2.0): `type="open"`, a "Give feedback" toggle with a free-text box and no rating ([Open feedback](#open-feedback-typeopen)). Planned as "Suggestions" (`type="suggestion"`); renamed because it takes any open feedback, not only improvement ideas. Needs the ingest server to accept `type: "open"` before release. Demo example.
6. **M6 Floating placement** – done (0.2.0; moved from 0.3.0): `placement="floating"` shows a card in the bottom-right corner; `inline` stays the default ([Floating placement](#floating-placement-placementfloating)). New `close` string in fi/sv for native review. Demo example and README note.
7. **Impressions opt-out**, future, not scheduled: see [below](#future-impressions-opt-out-not-scheduled).

## Acceptance criteria (M6)

- `placement="floating"` renders a fixed card in the bottom-right; `inline` and unknown values render as before, with no close button.
- Readable on a dark page with no `--ur-*` set (WCAG AA for text, borders, focus ring, selected state).
- Close button and Escape hide the card and fire `dismissed` with `reason: "close"`; nothing is stored.
- With the default `after-send`, the card hides about 4 s after thanks with `reason: "done"`, and not while hovered or keyboard-focused.
- One impression on show; changing `placement` does not send another or change the `id`.
- No focus trap: Tab and Shift+Tab move in and out of the card in DOM order.
- With `prefers-reduced-motion: reduce`, nothing animates.
- IIFE bundle ≤ 8 kB min+gzip.

## Acceptance criteria (M4)

- Renders only the toggle; no rating buttons, no score sent.
- The toggle opens and closes the box with `aria-expanded`; Escape closes it and returns focus to the toggle.
- Send matches the `open` example in `docs/api/openapi.yaml` (apart from `id` and `client`); an empty Send posts nothing.
- Default `replace`: after acceptance only the thanks text is left; `keep`: the toggle stays and each new feedback has a new `id`. `commented` fires after acceptance; a final failure keeps the text and fires `error`.
- One impression per element instance, with `type: "open"`.
- `sendFeedback({ type: "open", comment })` sends no score and rejects with `invalid-attribute` without a comment.
- IIFE bundle ≤ 8 kB min+gzip.

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

M1–M3 criteria are covered by the tests in `test/`; M4 by `test/open.test.ts`, M5 by `test/thanks.test.ts`, M6 by `test/floating.test.ts`.

## Future: impressions opt-out (not scheduled)

Spec only: not implemented and not planned for a release yet.

An attribute, for example `impressions="off"`, stops the element from sending `POST /v1/impressions`. Ratings, comments and open feedback are sent as today. For hosts that do not want a request on every view (strict privacy or security reviews, request budgets, pages that show the element many times) or that count views their own way.

**Effect on the response rate.** The response rate is feedback ÷ impressions for a surface, so impressions are its denominator:
- A surface where every element has impressions off has no response rate. Reports show feedback counts only and say the rate is unavailable, never 0% or 100%.
- A surface that mixes elements with and without impressions overstates its rate: feedback from the opted-out elements counts, their views do not. The docs will say to use one setting per surface.
- Today's feedback payload does not say whether impressions were sent, so the server cannot tell an opted-out surface from one with a broken impression call.
- Open feedback (`type="open"`) is least affected: its response rate is rarely the point.

Open questions for when it is scheduled:
- Attribute name and values (`impressions="off"` or a boolean such as `no-impressions`).
- Whether feedback should carry a flag (for example `impressions: false`) so reports can tell the cases apart. That is an API contract change and needs the platform.
- Whether the headless client gets `sendImpression()`, so hosts that opt out of automatic impressions can still count views when they choose.

## Out of scope

Targeting and triggers, triggered pop-ups and modals, multi-question surveys, NPS, native iOS/Android SDKs, offline queueing, analytics, any storage of user identity.
