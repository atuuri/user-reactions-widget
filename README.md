# user-reactions

`<user-reactions>` is a feedback element you place in a user flow, such as a knowledge base answer or an AI chat response. Built to measure changes in user experience with light setup.

The element captures a rating (thumbs up/down, CSAT or CES), an optional comment and the context you pass in (`surface`, `subject`, `meta`), counts impressions so the response rate is measurable, and sends it to your feedback API.

- Vanilla Web Component, no runtime dependencies, under 8 kB min+gzip.
- No cookies, no storage, no fingerprinting. Only the ids you pass in.
- Never breaks the host page: problems surface as a `user-reactions:error` event.

Status: `0.2.0` (milestones M1–M6: thumbs, CSAT/CES scales, en/fi/sv, thanks replacement, open feedback, floating placement). Full reference: attributes, behaviour, events, headless client and styling in the [widget spec](https://github.com/atuuri/user-reactions-widget/blob/main/docs/widget.md); API contract in [`openapi.yaml`](https://github.com/atuuri/user-reactions-widget/blob/main/docs/api/openapi.yaml).

## Install

```html
<script src="https://cdn.jsdelivr.net/npm/@user-reactions/widget@0.2.0/dist/user-reactions.js" defer></script>
<user-reactions project-key="pk_live_xxx" type="thumbs"
  surface="assistant-answer" subject="msg_8f2c" comment="on-negative"
  endpoint="https://your-api.example">
</user-reactions>
```

Or `npm install @user-reactions/widget`, then `import "@user-reactions/widget";` (registers `<user-reactions>`; also exports `sendFeedback` for native apps and servers).

- There is no hosted API yet, so `endpoint` is required: your own server or the dev mock below.
- Upgrading from 0.1: once feedback is final, the element is now replaced by the thanks text. Add `after-send="keep"` to keep the question and buttons as before.
- For a card in the bottom-right corner instead of inline, add `placement="floating"` and put the element at the end of `<body>` (from 0.2.0).
- Pin the version in the script tag. For a fixed file, add the `integrity` hash from the [release notes](https://github.com/atuuri/user-reactions-widget/releases).
- Your server must allow CORS preflight from the page origin with the `Content-Type` and `X-Project-Key` headers.

```js
document.addEventListener("user-reactions:rated", (e) => {
  if (e.detail.score === 0) offerRegenerate(e.detail.subject);
});
```

## Development

Node 22.12+ (`nvm use` reads `.nvmrc`).

```sh
npm install
npm run dev         # http://localhost:5173/demo/ with a mock API that logs payloads
npm test            # Vitest + happy-dom, payloads checked against docs/api/openapi.yaml
npm run build       # dist/ (ESM, IIFE, types); fails over the size budget
npm run size        # IIFE size check (≤ 8 kB min+gzip)
npm run pack:check  # after build: the npm tarball installs and works for consumers
```

The mock answers `POST /mock/v1/feedback` and `/mock/v1/impressions` with 202 (400 if the body breaks the contract); `/mock/fail/v1/*` answers 503 ("Simulate API outage" in the demo). For your own test page, put it in `demo/` and set `endpoint="/mock"`. After a build, `/demo/embed.html` tests the built bundle on a plain page.

CI runs typecheck, tests, build, size and package checks on every PR, on Node 22 and 24. Releases: [`docs/releasing.md`](docs/releasing.md). Changes: [`CHANGELOG.md`](CHANGELOG.md).

## License

MIT. See [LICENSE](LICENSE).
