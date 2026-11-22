# M6: Floating placement (planned, 0.3.0)

Read only when working on M6. Everything not stated here works as in [widget.md](widget.md).

`placement="floating"` shows the element as a small card fixed to the bottom-right corner of the viewport instead of inline in the page flow. It is opt-in; `inline` stays the default. It works with every `type`, including `open`.

```html
<!-- Put it at the end of <body>, so it comes last in the Tab order -->
<user-reactions project-key="pk_live_xxx" type="csat" surface="checkout" placement="floating"
  endpoint="https://api.example.com"></user-reactions>
```

## Spec changes

- New attribute `placement`: `inline` (default) or `floating`. Unknown values act as `inline`. Changing it does not reset the element (like `endpoint`).
- New custom properties: `--ur-offset` (distance from the viewport edges, default 16 px) and `--ur-z` (stacking order, default a high value such as 2147483000).
- New part `close` (the close button). The floating card itself is the host element, so hosts style it with `user-reactions[placement=floating]` and the existing properties.
- New event `user-reactions:dismissed` with `{ reason }`, `"close"` or `"done"`, fired when the card hides. Hosts that want dismissal to persist store it themselves; the element never does.
- New string:

| Key | en | fi | sv |
|---|---|---|---|
| close | Close | Sulje | Stäng |

- Out of scope in widget.md changes from "pop-ups and modals" to "triggered pop-ups and modals": the floating card is shown like any element and never opens on its own.

## Behaviour (`placement="floating"`)

1. **Position**: `position: fixed` at the bottom-right, using logical properties (`inset-block-end`, `inset-inline-end`), so it moves to the left in right-to-left pages. Respects `env(safe-area-inset-*)`. On narrow viewports (under about 480 px) it spans the width minus `--ur-offset` on each side.
2. **Look**: opaque `--ur-bg` (system `Canvas` by default, so it works on dark pages), `--ur-radius` capped like the comment box, a light shadow and a 1 px border at 50% of the text colour, as for buttons.
3. **Close**: a labelled close `<button>` in the top corner, and Escape while focus is inside the card. Hides the card for this page view and fires `dismissed` with `reason: "close"`. The element does not move focus elsewhere; hosts that want focus to land somewhere specific set it on `dismissed`.
4. **After thanks**: with `after-send="replace"` (the default since 0.2.0), the card keeps the thanks text and the close button, then hides about 4 s later and fires `dismissed` with `reason: "done"`. The timer pauses while the pointer is over the card or focus is inside it. With `keep`, it never hides on its own.
5. **Not a modal**: no backdrop, no focus trap, no auto-focus. It stays at its own place in the Tab order.
6. **Impression**: fires as soon as the card shows, since it is visible on load. Hiding it ends that instance; re-adding the element (or a reset attribute change) shows it again as a new instance.
7. **Motion**: slide-in and fade-out only under `prefers-reduced-motion: no-preference`.
8. **More than one**: each floating element positions itself independently, so two would overlap. The docs say one floating element per page.

Also: demo example, README note, and the new string in the fi/sv native review table.

## Acceptance criteria

- `placement="floating"` renders a fixed card in the bottom-right; `inline` and unknown values render as today.
- Readable on a dark page with no `--ur-*` set (WCAG AA for text, borders, focus ring, selected state).
- Close button and Escape hide the card and fire `dismissed` with `reason: "close"`; nothing is stored.
- With the default `after-send`, the card hides about 4 s after thanks with `reason: "done"`, and not while hovered or focused.
- One impression on show; changing `placement` does not send another or change the `id`.
- No focus trap: Tab and Shift+Tab move in and out of the card in DOM order.
- With `prefers-reduced-motion: reduce`, nothing animates.
- IIFE bundle ≤ 8 kB min+gzip.
