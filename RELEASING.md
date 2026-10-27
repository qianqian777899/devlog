# Releasing

The repository is public under MIT. Publishing to the npm registry is a separate owner action; this repository does not contain npm credentials or an automatic publishing workflow.

The package name is `@qianqian777899/devlog`, avoiding the unrelated unscoped `devlog` name. The executable remains `devlog`. The owner must own the matching npm scope; a GitHub username does not reserve an npm username.

1. Confirm CI is green on the commit to publish.
2. Run `npm ci && npm run check`.
3. Confirm package/scope ownership with your npm account; update `package.json` if your npm scope differs.
4. Inspect `npm pack --dry-run`, then install the tarball in a temporary directory and run `devlog --help`.
5. Update the version in `package.json`, `src/cli.ts`, tests and CHANGELOG; run `npm install --package-lock-only` and `npm run build`.
6. Commit source and `dist/`, create a version tag and GitHub release.
7. Authenticate to npm using the registry's supported authentication flow, then run `npm publish --access public` from your trusted local environment.
8. Verify registry installation before changing README instructions to recommend `npx --package @qianqian777899/devlog devlog today`.

Never commit npm tokens. A future trusted-publishing workflow should be configured with least privilege and explicit owner authorization.
