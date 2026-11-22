# M5: Replace with thanks (planned, 0.3.0)

Read only when working on M5. Everything not stated here works as in [widget.md](widget.md).

Once feedback is final, the element replaces itself with the thanks message, so a finished rating doesn't keep asking. This becomes the **default**. Today's behaviour, where the buttons stay after thanks, stays available as an opt-out.

```html
<user-reactions project-key="pk_live_xxx" type="thumbs" surface="assistant-answer" subject="msg_8f2c"
  thanks="Thanks, this helps us improve" endpoint="https://api.example.com"></user-reactions>

<!-- 0.1/0.2 behaviour: keep the buttons after thanks -->
<user-reactions after-send="keep" ...></user-reactions>
```

## Spec changes

- New attribute `after-send`: `replace` (default) or `keep`. Unknown values act as `replace`. Read when the feedback becomes final, so it does not reset the element.
- New attribute `thanks`: overrides the thanks text in both modes, shown as given and not translated (like `question`). An empty value keeps the default.
- No new strings: reuses the existing thanks string in en, fi and sv.
- No new parts or events: the replaced state is the existing `thanks` part.
- Behaviour 6 (Thanks) in widget.md is rewritten to describe both modes. Behaviour 4 (Change rating) applies until the element is replaced.

## Behaviour (`after-send="replace"`)

1. **When feedback is final**:
   - No comment box for the chosen score: once the API accepts the rating.
   - Comment box shown: once the API accepts the comment. An empty Send is final as soon as the rating has been accepted.
   Until then, rating and changing the rating work as today.
2. **Replace**: the question, buttons, captions and comment box are removed. Only the thanks text is left, in the `thanks` part with `role="status"`, so it is announced.
3. **Focus**: if focus was inside the element, it moves to the thanks text (`tabindex="-1"`, no visible focus ring needed), so keyboard users are not dropped to the top of the page.
4. **Motion**: a short fade only under `prefers-reduced-motion: no-preference`; otherwise the swap is instant.
5. **Failure**: nothing is replaced. As today, `error` fires, the selection stays, clicking the same button resends and a failed comment keeps its text.
6. **Attribute changes**: changing a reset attribute (`subject`, `meta`, `type`, `lang`, `question`, `comment`) brings back the full element as a new instance, as in behaviour 8. Chat UIs that reuse nodes keep working.
7. **Suggestions (M4)**: the same applies to `type="suggestion"`: once a suggestion is accepted, the toggle is replaced by the suggestion thanks. With `keep`, the toggle stays as specified in [m4-suggestions.md](m4-suggestions.md).

With `after-send="keep"` the element behaves exactly as in 0.1.0 and 0.2.0 (apart from `thanks`).

## Versioning

This changes the default behaviour for 0.1/0.2 users, which semver allows in a 0.x minor release. The 0.3.0 changelog lists it under **Changed** with the one-line opt-out (`after-send="keep"`), and the README install snippet moves to 0.3.0.

Also: demo examples for both modes.

## Acceptance criteria

- Default: after a thumbs rating with no comment box is accepted, only the thanks text is shown, with `role="status"`; no buttons remain.
- With a comment box: the element is replaced only after the comment (or an empty Send) is accepted; the rating can be changed until then.
- A final failed send replaces nothing; the selection and comment text stay and `error` fires.
- If focus was on a button or Send, it ends on the thanks text after the swap.
- Changing `subject` or `meta` after the swap shows the full element again, with a new `id` and one new impression.
- `after-send="keep"` passes the existing M1–M3 tests unchanged.
- `thanks="…"` replaces the default text in both modes; `thanks=""` keeps the default.
- With `prefers-reduced-motion: reduce`, nothing animates.
- IIFE bundle ≤ 8 kB min+gzip.
