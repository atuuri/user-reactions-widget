# M4: Suggestions (planned, 0.3.0)

Read only when working on M4. Everything not stated here works as in [widget.md](widget.md).

`type="suggestion"` is a standalone element with no rating: a place for free-text improvement ideas, e.g. in a page footer or settings screen. It is not combined with a rating element. Needs the ingest server to accept `type: "suggestion"` first (already in `docs/api/openapi.yaml`: `comment` required, `score` not allowed).

```html
<user-reactions project-key="pk_live_xxx" type="suggestion"
  surface="billing" subject="invoices-page" endpoint="https://api.example.com"></user-reactions>
```

## Spec changes

- `type` also accepts `suggestion`. `comment` is ignored (there is always a text box). `question` overrides the toggle label; an empty value keeps the default.
- New part `suggest` (the toggle). Reuses `comment`, `send`.
- New event `user-reactions:suggested` with `{ id, comment, surface, subject }`, fired once the API accepts it.
- `sendFeedback({ projectKey, type: "suggestion", surface, comment })`: no score; rejects with `invalid-attribute` without a comment.
- Strings:

| Key | en | fi | sv |
|---|---|---|---|
| suggest toggle | Suggest improvements | Ehdota parannuksia | Föreslå förbättringar |
| suggest placeholder | What could we improve? | Mitä voisimme parantaa? | Vad kan vi förbättra? |
| suggest thanks | Thanks for your suggestion | Kiitos ehdotuksestasi | Tack för ditt förslag |

## Behaviour

1. **Render**: a text `<button>` "Suggest improvements" with `aria-expanded="false"` and `aria-controls` pointing at the text box. No network calls.
2. **Impression**: as for ratings, with `type: "suggestion"`.
3. **Open**: the toggle shows a textarea (max 2000 chars) and Send, sets `aria-expanded="true"` and focuses the textarea. Toggle again or Escape closes it, keeps the text and returns focus to the toggle.
4. **Send**: `POST /v1/feedback` with a new `id`, `type: "suggestion"`, `comment`, and `surface`, `subject`, `meta`, `locale`, `client` as for ratings. No `score`. Empty Send does nothing.
5. **Thanks**: after the API accepts it, the box closes and "Thanks for your suggestion" (or the `thanks` attribute) is announced (`role="status"`). `after-send` applies as for ratings (widget.md behaviour 6): with `replace` (default) the toggle is replaced by the thanks text; with `keep` the toggle stays and each new suggestion gets a new `id`.
6. **Failure**: same retry rule. On final failure fire `error`, keep the box open with the text, no thanks.
7. **Attribute changes**: changing `subject` or `meta` resets the element.

Also: demo example and fi/sv strings.

## Acceptance criteria

- Renders only the toggle; no rating buttons, no score sent.
- Toggle opens and closes the box with `aria-expanded`; Escape closes it and returns focus.
- Send matches the `suggestion` example in `docs/api/openapi.yaml` (apart from `id` and `client`); empty Send posts nothing.
- Each suggestion has a new `id`; `suggested` fires after acceptance; a failure keeps the text and fires `error`.
- One impression per element instance, with `type: "suggestion"`.
- `sendFeedback({ type: "suggestion", comment })` sends no score and rejects with `invalid-attribute` without a comment.
- IIFE bundle ≤ 8 kB min+gzip.
