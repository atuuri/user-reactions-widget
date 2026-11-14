# Changelog

All notable changes to `@user-reactions/widget`. Versions follow [Semantic Versioning](https://semver.org/).

## 0.1.0-beta.1

### Added
- `<user-reactions type="thumbs">` element: impressions, rating with upsert by id, comment modes `off` / `optional` / `on-negative`, `rated` / `commented` / `error` events, one retry on network errors, 429 and 5xx.
- `sendFeedback()` headless client, importable outside the browser.
- ES module and IIFE builds with TypeScript declarations; 8 kB min+gzip budget for the IIFE.
