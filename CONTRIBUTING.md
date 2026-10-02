# Contributing

Every change goes through a pull request and is reviewed before it is merged. The pipeline runs the tests on Linux, Windows and macOS, the repository checks, CodeQL, and a secure development check of the repository itself.

Commit messages in this repository follow Conventional Commits: `feat:`, `fix:`, `docs:`, `test:`, `ci:`, with `!` for a breaking change.

## Changing a check

1. Describe the change in docs/method.md first: what the check reports, its severity, and why it matters, with the page of Google's documentation it follows. Where the tool makes its own choice (which permissions are `direct` and which are `review`, how a removal is read, what is a warning and what is an error), say so and say why.
2. Add a test with the manifest, the Gradle file and the answers written inline, small enough that the result can be worked out by hand. Use made-up package names and host names (`com.example.orders`, `example.test`).
3. Text from the input goes through `safeText` before it reaches a finding or a note, so control characters are removed. Never put a line of a build file or the value of a string of a manifest into a finding.
4. A finding id, once released, keeps its meaning: pipelines and other tools read it from the JSON and CSV reports.

## Changing the tables

The categories, data types and purposes in `src/data.js` come from Google's Data safety help page, the permission names from the Android reference page for `Manifest.permission`, and the SDK rows from the data disclosure pages of the SDK vendors. When a page changes, save the new text in `research/sources` (the address on the first line), change `src/data.js` to match, and update docs/permissions-and-sdks.md and docs/data-safety-answers.md. `test/data.test.js` compares the tables with the saved text, so changing one without the other fails.

Never add a data type, a purpose, a permission mapping or an SDK from memory or from a blog post. A new SDK needs the vendor's own data disclosure page, opened and saved, and every data type it points at needs the vendor's label for the data and the phrase of Google's page that puts that data under the type. A mapping is `direct` only when the Android text says the permission reads that data and Google's page defines the data type as that data; everything else is `review`.

## Changing the readers

1. For the XML, JSON, catalog and Gradle readers, add a test for every form you add and one that must be refused or must not match. Keep refusing DOCTYPE and ENTITY declarations and every entity except the five XML predefines, and keep refusing JSON that is not JSON.
2. Keep the size, depth and element limits.
3. Paths are opened with `path.resolve`, never `path.join`, so an absolute path works on every system. Paths shown in a report are relative, with forward slashes. File, folder and permission names are compared exactly, letter case included, on every system. Do not assume that a backslash is a separator on Linux or macOS.

## Rules for the code

- No runtime dependencies. Node 22 or newer and nothing else.
- The tool reads the folder it is given and the answers file, and writes only to the screen. It opens no network connection, runs no program (no Gradle, no Android tool, no shell), and never follows a URL, a symbolic link or a path from an input.
- Source files stay ASCII; write any other character in a pattern as a `\u` escape.
- Never commit a real manifest, Gradle file or answers file, even as a fixture. Write small made-up files, and never put a real key, token or signing identity into one, even an expired one.

## Before you open the pull request

```
npm test
npm run check
npm run example
```
