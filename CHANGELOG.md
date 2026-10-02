# Changes

## 1.0.0

First release.

- Checks the Data safety answers of an Android app, kept in the repository as a small JSON file, against the app. Reads files only; never runs Gradle, an Android tool or a build and never fetches anything.
- Reads every `AndroidManifest.xml` (the main manifest, flavours and build types under `src/*/`, and other modules) with a small strict XML reader that refuses DOCTYPE and ENTITY declarations. Collects `<uses-permission>` and `<uses-permission-sdk-23>`, with the line of each; `tools:node="remove"` drops a permission. Manifests of test source sets are left out.
- Reads `build.gradle`, `build.gradle.kts` and `gradle/libs.versions.toml` as text, with comments blanked, for dependency coordinates, and matches them with a small table of well-known SDKs (analytics, crash reporting, ads, maps, auth). Dependencies of test configurations are left out.
- Maps permissions and SDKs to the data types of Google's Data safety form. A mapping is `direct` or `review`; a `review` mapping is never more than a review finding.
- The categories, data types and purposes come from Google's Data safety help page, the permission names from the Android reference, and the SDK rows from the vendors' data disclosure pages. They are kept in `src/data.js`, and a test compares them with the saved text in `research/sources`.
- Twelve checks: `parse-error`, `answers-missing`, `answers-invalid`, `no-purpose`, `permission-undeclared`, `sdk-undeclared`, `declared-not-collected`, `unknown-data-type`, `unknown-purpose`, `duplicate-type`, `malformed-entry` and `permission-review`.
- Every finding has an id, a severity (error, warning, review), the file and line, the subject, a message and a fix.
- Reports as text, Markdown, JSON and CSV; `--fail-on` for a pipeline gate; exit code `2` for a usage or input error.
- Safe input: only the folder and the answers file are read, symbolic links are not followed, files over 10 MB are refused, XML and JSON nested more than 64 deep are refused, no line of a build file and no string value of a manifest is printed, and control characters are removed from every text shown.
- Release packages come with a CycloneDX SBOM, SHA-256 checksums and a build provenance attestation.
