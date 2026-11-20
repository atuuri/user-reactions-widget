# Releasing

`.github/workflows/release.yml` publishes `@user-reactions/widget` to npm when a `v*` tag is pushed: verify (tag = package.json, tag on main, typecheck, tests, build, size, pack check) → wait for approval in the `npm-publish` environment → npm publish via trusted publishing (OIDC, no stored token) → GitHub Release with the CDN URL and SRI hash. jsDelivr and unpkg serve the npm files automatically. Pre-releases (`0.2.0-beta.1`) get the `next` dist-tag and never become the default install.

## Every release

1. **Release PR** from an up-to-date `main`, on a branch such as `release-0.1.0`:
   ```sh
   npm version 0.1.0 --no-git-tag-version   # or: patch | minor | prerelease --preid beta
   ```
   Rename `## Unreleased` to `## 0.1.0` in `CHANGELOG.md`. Run `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, `npm run pack:check`. Open `Release 0.1.0`; merge once `Test (Node 22)` and `Test (Node 24)` pass.
2. **Tag (maintainer only)**, from the updated `main`:
   ```sh
   git checkout main && git pull
   node -p "require('./package.json').version"   # must print 0.1.0
   git tag v0.1.0 && git push origin v0.1.0
   ```
3. **Approve**: GitHub → Actions → Release → after `verify`, **Review deployments** → approve `npm-publish`.
4. **Check** `npm view @user-reactions/widget dist-tags` and the GitHub release (npm can lag a few minutes).
5. Add a new `## Unreleased` heading to `CHANGELOG.md`.

`package.json` is the only place the version lives; the build injects it into `client` (`widget@x.y.z`).

**If something fails**
- `verify` fails: nothing is published. Fix via PR, then `git push --delete origin v0.1.0 && git tag -d v0.1.0` and tag again.
- `Publish to npm` fails with `ENEEDAUTH`: the npm trusted-publisher entry does not match or lacks **Allow npm publish**. Fix it, then **Re-run failed jobs** (no new tag).
- A version that reached npm cannot be re-published; release a new patch.

## One-time setup (for reference)

- **npm**: account with 2FA; org `user-reactions` requiring 2FA. Package → Settings → Trusted publishing → GitHub Actions: owner `atuuri`, repo `user-reactions-widget`, workflow `release.yml`, environment `npm-publish`, **Allow npm publish** ticked; publishing access "Require 2FA and disallow tokens". The bootstrap `NPM_TOKEN` (needed only for the very first publish) should be deleted from the environment and revoked on npm.
- **GitHub**: environment `npm-publish` with the maintainer as required reviewer and deployment tag rule `v*`. Ruleset on `main`: PR required (0 approvals) plus checks `Test (Node 22)` and `Test (Node 24)`. Ruleset on tags `v*`: restrict create/update/delete, bypass = maintainer only.
- **Keep the repo public**: npm provenance only works from public repositories.
- Optional: merge Dependabot PRs; pin actions to commit SHAs for stricter supply-chain hygiene.
