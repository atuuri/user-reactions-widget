# Releasing

`@user-reactions/widget` is published to npm by `.github/workflows/release.yml` when a version tag is pushed. The CDN (jsDelivr, unpkg) serves the npm files automatically, and the workflow also creates a GitHub Release with the built files and an SRI hash.

```
git push v0.1.0 ─► verify (tag = package.json, tag on main, typecheck, tests, build, size, pack check)
               ─► wait for approval (npm-publish environment)
               ─► npm publish (files from verify) ─► GitHub Release with CDN URL + integrity hash
```

Pre-release versions (`0.2.0-beta.1`) are published with the `next` dist-tag and marked as pre-releases, so they never become the default install.

## Every release

1. Move the `Unreleased` entries in `CHANGELOG.md` under the new version and merge that to `main`.
2. From an up-to-date `main`:
   ```sh
   npm version 0.1.0        # or: npm version patch | minor | prerelease --preid beta
   git push --follow-tags
   ```
3. In GitHub → Actions → Release, wait for `verify`, then approve the `publish` job.
4. Check https://www.npmjs.com/package/@user-reactions/widget and the GitHub release.

The version in `package.json` is the only place to change: the build injects it into the `client` field (`widget@x.y.z`).

If `verify` fails, nothing is published. Fix on `main`, delete the tag (`git push --delete origin v0.1.0 && git tag -d v0.1.0`) and tag again. A version that reached npm cannot be re-published; release a new patch instead.

## One-time setup (maintainer)

These need the maintainer's npm and GitHub accounts; they cannot be done from the repository.

### npm
1. npm account with two-factor authentication.
2. npm organisation `user-reactions` (free plan), with "require 2FA" for members.

### GitHub repository settings
3. **Environment** (Settings → Environments → New environment): `npm-publish`.
   - Required reviewers: the maintainer.
   - Deployment branches and tags: "Selected", add tag rule `v*`.
4. **Ruleset for `main`** (Settings → Rules → Rulesets): require a pull request (0 required approvals for a single maintainer, who cannot approve their own PRs) and the status checks `Test (Node 22)` and `Test (Node 24)`.
5. **Ruleset for tags `v*`**: restrict creation, update and deletion; bypass list: the maintainer. Without this, anyone with write access could start a release.
6. **Keep the repository public.** Provenance (the npm badge proving the package was built here) only works from public repositories, and the package's repository link must resolve. If it were made private, releases would still publish, but without provenance.

### First publish (bootstrap)
npm only lets you configure trusted publishing on a package that already exists, so the first release uses a short-lived token. If npm offers trusted publishing for a not-yet-published package, skip steps 7 and 9 and do step 8 first.

7. npmjs.com → Access Tokens → Generate New Token → Granular:
   - Expiration: 1 day. Permissions: read and write on the `user-reactions` organisation's packages.
   - Enable "bypass two-factor authentication" (needed for CI).
   - Store it as secret `NPM_TOKEN` in the `npm-publish` **environment** (not a repository secret).
   - Release 0.1.0 as above.
8. npmjs.com → `@user-reactions/widget` → Settings → Trusted publishing → GitHub Actions:
   - Owner `atuuri`, repository `user-reactions-widget`, workflow `release.yml`, environment `npm-publish`.
   - Then set publishing access to "Require two-factor authentication and disallow tokens".
9. Delete the `NPM_TOKEN` environment secret and revoke the token on npm. Later releases use trusted publishing (OIDC); no token is stored anywhere.

### Optional
- Grant teams access to the package in the npm org (only possible once it exists).
- Merge Dependabot PRs (`.github/dependabot.yml`) to keep actions and dev tools current. For stricter supply-chain hygiene, pin actions to commit SHAs; Dependabot keeps pinned SHAs updated too.
