# insight-feedback

Inline feedback element for AI answers and key product flows: thumbs up/down, CSAT and CES, with an optional comment and the context of what was rated.

Status: pre-release. Spec in [`docs/widget.md`](docs/widget.md), API contract in [`docs/api/openapi.yaml`](docs/api/openapi.yaml).

```html
<script src="https://cdn.example.com/insight-feedback.js" defer></script>
<insight-feedback project-key="pk_live_xxx" type="thumbs"
  surface="assistant-answer" subject="msg_8f2c" comment="on-negative">
</insight-feedback>
```

Licensed under MIT. See [LICENSE](LICENSE).
