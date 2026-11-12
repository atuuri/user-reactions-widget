# user-reactions

Inline feedback element for AI answers and key product flows: thumbs up/down, CSAT and CES, with an optional comment and the context of what was rated.

Status: pre-release. Spec in [`docs/widget.md`](docs/widget.md), API contract in [`docs/api/openapi.yaml`](docs/api/openapi.yaml).

```html
<script src="https://cdn.example.com/user-reactions.js" defer></script>
<user-reactions project-key="pk_live_xxx" type="thumbs"
  surface="assistant-answer" subject="msg_8f2c" comment="on-negative">
</user-reactions>
```

Licensed under MIT. See [LICENSE](LICENSE).
