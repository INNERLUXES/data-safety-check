## What changes

<!-- One or two sentences. -->

## Checks

- [ ] `npm test`, `npm run check` and `npm run example` pass, and the files under `examples/output` are the ones `npm run example` wrote
- [ ] A change to a check, a mapping or a reader is described in docs/method.md, and has a test with the manifest, the Gradle file and the answers written inline, and a near miss that must not match
- [ ] A change to a data type, a purpose, a permission mapping or an SDK follows the official pages: the new page text is saved in research/sources, `src/data.js` and docs/permissions-and-sdks.md match it, and nothing was added from memory
- [ ] Text from the input goes through `safeText`, and no line of a Gradle file, no string value of a manifest and no free text of the answers reaches a report; the tool still runs no Gradle or Android tool, fetches nothing, opens no connection and follows no symbolic link
- [ ] Paths are opened with `path.resolve`, shown relative with forward slashes, and file, folder and permission names are compared exactly, so the result is the same on Linux, macOS and Windows
- [ ] No real manifest, Gradle file or answers file and no real key, token or signing identity in fixtures or examples
- [ ] The commit messages of this pull request follow Conventional Commits
