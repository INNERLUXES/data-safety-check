# data-safety-check

Checks the Data safety answers of an Android app against the app itself. You keep the answers you give in Play Console in a small JSON file in the repository. The tool reads every `AndroidManifest.xml` (the main manifest, the flavours and build types under `src/*/`, and the other modules), collects the permissions, reads the Gradle files for the well-known SDKs among the dependencies, maps both to the data types of Google's Data safety form, and compares them with the answers file. It reports a data type that a permission or an SDK points at and the answers leave out, a declared data type with no purpose, a name that Google does not list, and an answers file that is missing or cannot be read. Every finding names the file and the line.

Google asks every app on Google Play for a Data safety form, and says the form must account for what the app's libraries and SDKs send off the device. The form is filled in once in a web page, and the manifest and the dependencies keep changing around it: a new permission for a feature, an analytics SDK added for a release, a library bumped to a version that sends more. None of them breaks a build. They show up later, as a policy email or a rejected update. This tool compares the two in a second, so the check can run on every pull request.

- Every finding has an id, a severity (error, warning, review), the file, the line, a plain message and a fix.
- The data types and purposes come from Google's Data safety help page, the permission names from the Android reference, and the SDK rows from the vendors' own data disclosure pages. They are kept in [src/data.js](src/data.js), and a test compares them with the saved text of the pages in [research/sources](research/sources). [docs/permissions-and-sdks.md](docs/permissions-and-sdks.md) shows the mappings as tables with their source addresses.
- Every mapping is indicative. Google's page says an app does not declare data it does not collect or share, even when it holds a permission for it. So a permission or an SDK only points at a data type: where that depends on what the app does the finding is a review finding, and no mapping is ever an error.
- The manifests are read by a small, strict XML reader that refuses a DOCTYPE or an entity declaration, so a manifest cannot make the tool expand entities or read another file. `tools:node="remove"` drops a permission.
- Gradle files are read as text, never run: comments are blanked, then dependency coordinates are matched by name, also through `gradle/libs.versions.toml`. Nothing is evaluated.
- Reports as text, Markdown, JSON and CSV, with an exit code for a pipeline gate.
- It reads files only. It never runs Gradle or a build, prints no line of a build file, fetches nothing and opens no network connection.
- Plain JavaScript, no dependencies; the same files always give the same report.

```
npm test
```

```
ℹ tests 76
ℹ pass 75
ℹ fail 0
ℹ skipped 1
```

The skipped test makes a symbolic link, which Windows does not allow without a privilege; on Linux and macOS all 76 run.

## Quick start

Requires Node 22 or newer. There is nothing to install.

```
git clone https://github.com/INNERLUXES/data-safety-check.git
cd data-safety-check
node bin/data-safety-check.js examples/android-app
```

Or without a clone, in the folder of your project:

```
npx --yes github:INNERLUXES/data-safety-check .
```

The tool reads `data-safety.json` in that folder; `--answers <file>` names another one. [docs/data-safety-answers.md](docs/data-safety-answers.md) describes the format, which is a list of the data types you declare, with `collected`, `shared` and `purposes` for each.

`examples/` holds a made-up "orders" app. `examples/android-app` is wrong on purpose. Its main manifest asks for precise location and the camera, and removes the microphone permission that a feedback library adds. A paid flavour adds the permission to read contacts. It depends on Google Analytics for Firebase, through a version catalog. Its answers file declares precise location correctly, but gives the email address no purpose, spells one purpose wrong, says contacts are neither collected nor shared, and leaves out two data types that the analytics SDK points at. A `build` folder with a made-up merged manifest is there to show that build output is left out. `examples/android-app-fixed` is the same app with the answers corrected. `examples/output` holds the reports of the first project in every format; `npm run example` writes them again and fails if the README no longer shows what a real run prints.

## Usage

```
node bin/data-safety-check.js examples/android-app
```

```
data-safety-check: examples/android-app
answers: examples/android-app/data-safety.json, 5 data types declared
manifests: 3
  examples/android-app/app/src/main/AndroidManifest.xml: 3 permissions, 1 removal
  examples/android-app/app/src/paid/AndroidManifest.xml: 1 permission
  examples/android-app/feedback-lib/src/main/AndroidManifest.xml: 1 permission
build files: 1 read, 1 version catalog
permissions in the app: 4
  ACCESS_FINE_LOCATION: Precise location (direct)
  CAMERA: Photos or Videos (review)
  INTERNET: no data type in the table
  READ_CONTACTS: Contacts (direct)
SDKs from the table: 1
  Google Analytics for Firebase (com.google.firebase:firebase-analytics) at examples/android-app/app/build.gradle.kts:26
findings: 1 error, 4 warning, 1 review

ERROR    no-purpose  examples/android-app/data-safety.json:9
         Email address is declared as collected and has no purpose
         fix: Give the data type at least one purpose: Google asks for the purposes of every data type that is collected or shared

WARNING  sdk-undeclared  examples/android-app/app/build.gradle.kts:26
         Google Analytics for Firebase (com.google.firebase:firebase-analytics) is a dependency and collects by default "Masked IP address", which Google's page puts under Approximate location (Location); examples/android-app/data-safety.json does not list it
         fix: Add Approximate location to examples/android-app/data-safety.json with its purposes, or remove the SDK; the vendor's page is https://support.google.com/analytics/answer/11582702

WARNING  sdk-undeclared  examples/android-app/app/build.gradle.kts:26
         Google Analytics for Firebase (com.google.firebase:firebase-analytics) is a dependency and collects by default "In-app purchases and subscriptions", which Google's page puts under Purchase history (Financial info); examples/android-app/data-safety.json does not list it
         fix: Add Purchase history to examples/android-app/data-safety.json with its purposes, or remove the SDK; the vendor's page is https://support.google.com/analytics/answer/11582702

WARNING  declared-not-collected  examples/android-app/app/src/paid/AndroidManifest.xml:5
         android.permission.READ_CONTACTS is in the manifest, and examples/android-app/data-safety.json says Contacts is neither collected nor shared (line 28)
         fix: Check that no data of this type leaves the device through the app, a library or a webview; if some does, set collected or shared to true and give the purposes

WARNING  unknown-purpose  examples/android-app/data-safety.json:19
         "Analytic" is not a purpose that Google's Data safety page lists
         fix: Write the purpose exactly as Google writes it, for example "App functionality"; docs/data-safety-answers.md lists them all

REVIEW   permission-review  examples/android-app/app/src/main/AndroidManifest.xml:7
         android.permission.CAMERA can mean Photos or Videos, depending on what the app does with the data, and examples/android-app/data-safety.json lists none of them
         fix: Decide what the app does with it: if it collects or shares Photos or Videos, add it to examples/android-app/data-safety.json with its purposes; if the data stays on the device, nothing is needed

note: left out 1 kind of folder (build); use --include-generated to read them
note: 1 permission with no entry in the mapping table (see docs/permissions-and-sdks.md)
note: examples/android-app/feedback-lib/src/main/AndroidManifest.xml:4: android.permission.RECORD_AUDIO is removed with tools:node="remove" and is not counted

GATE: FAIL - 1 error
```

The exit code is `1`: a data type with no purpose is an error, and errors fail the run by default. The warnings are differences between the answers and what the project points at, and the review line is a question for a person: the camera can mean photos or videos, or neither if the pictures never leave the phone. The permission to record audio is not counted, because the main manifest removes it from the feedback library's. The finding for an SDK is at its line in the Gradle file, and for a permission at its line in the manifest.

The fixed app passes, also with `--fail-on warning`:

```
node bin/data-safety-check.js examples/android-app-fixed --fail-on warning
```

```
data-safety-check: examples/android-app-fixed
answers: examples/android-app-fixed/data-safety.json, 8 data types declared
manifests: 3
  examples/android-app-fixed/app/src/main/AndroidManifest.xml: 3 permissions, 1 removal
  examples/android-app-fixed/app/src/paid/AndroidManifest.xml: 1 permission
  examples/android-app-fixed/feedback-lib/src/main/AndroidManifest.xml: 1 permission
build files: 1 read, 1 version catalog
permissions in the app: 4
  ACCESS_FINE_LOCATION: Precise location (direct)
  CAMERA: Photos or Videos (review)
  INTERNET: no data type in the table
  READ_CONTACTS: Contacts (direct)
SDKs from the table: 1
  Google Analytics for Firebase (com.google.firebase:firebase-analytics) at examples/android-app-fixed/app/build.gradle.kts:26
findings: 0 error, 0 warning, 0 review

no findings

note: left out 1 kind of folder (build); use --include-generated to read them
note: 1 permission with no entry in the mapping table (see docs/permissions-and-sdks.md)
note: examples/android-app-fixed/feedback-lib/src/main/AndroidManifest.xml:4: android.permission.RECORD_AUDIO is removed with tools:node="remove" and is not counted

GATE: PASS (--fail-on warning)
```

```
data-safety-check <folder> [options]
```

```
--answers <file>     the Data safety answers file (default: data-safety.json in the folder)
--include-generated  also read build, .gradle, .git, .idea, .cxx, node_modules
                     (left out by default)
--format <name>      text, markdown, json or csv (default: text)
--fail-on <level>    exit with 1 when a finding is at this level or above: error or warning
                     (default: error)
--help               show the usage
--version            show the version
```

Give the folder of the app, or of one app inside a larger repository. Paths in the report are relative to the folder you run the command in, with forward slashes on every system; a project outside it is shown with its absolute path.

By default these folders are not read, at any depth, and a note says which were left out: `build`, `.gradle`, `.git`, `.idea`, `.cxx` and `node_modules`. The merged manifests that a build writes would be counted twice. `--include-generated` reads them too. Symbolic links are not followed.

## Checks

| Id | Severity | What it reports |
| --- | --- | --- |
| `parse-error` | error | An `AndroidManifest.xml` that is not well-formed XML, or has a DOCTYPE; the file and the line are shown, and the other manifests are still checked |
| `answers-missing` | error | The answers file does not exist, or is not a regular file |
| `answers-invalid` | error | The answers file is not JSON, or is not an object with a `dataTypes` array; the line is shown |
| `no-purpose` | error | A data type with `collected` or `shared` true and no purpose |
| `permission-undeclared` | warning | A permission that Google's page ties directly to a data type, and the answers do not list that data type |
| `sdk-undeclared` | warning | A well-known SDK is a dependency, and the answers do not list a data type that its vendor's page says it collects |
| `declared-not-collected` | warning | The answers say a data type is neither collected nor shared, and a permission or an SDK points at it |
| `unknown-data-type` | warning | A data type name that Google does not list |
| `unknown-purpose` | warning | A purpose name that Google does not list |
| `duplicate-type` | warning | The same data type declared twice |
| `malformed-entry` | warning | An entry or a key of the answers file that is not in the documented format |
| `permission-review` | review | A permission that may point at a data type, depending on what the app does (the camera, the microphone, the body sensors, storage and media, the account list) and the answers list none of them |

[docs/method.md](docs/method.md) gives each check, its exact rule and why it matters, how the files are read and how removals work.

## Permissions and SDKs

The permissions the tool maps, and what each points at:

| Level | Permissions |
| --- | --- |
| direct | `ACCESS_FINE_LOCATION` (Precise location), `ACCESS_COARSE_LOCATION` (Approximate location), `READ_CONTACTS` and `READ_CALL_LOG` (Contacts), `READ_CALENDAR` (Calendar events), `READ_SMS` and `RECEIVE_SMS` (SMS or MMS) |
| review | `CAMERA` (Photos or Videos), `RECORD_AUDIO` (Voice or sound recordings), `BODY_SENSORS` and `BODY_SENSORS_BACKGROUND` (Health info or Fitness info), `ACTIVITY_RECOGNITION` (Fitness info), `GET_ACCOUNTS` (User IDs or Email address), `READ_PHONE_NUMBERS` (Phone number), `READ_MEDIA_IMAGES` (Photos), `READ_MEDIA_VIDEO` (Videos), `READ_MEDIA_AUDIO` (Music files or Other audio files), `READ_EXTERNAL_STORAGE` (Files and docs), `QUERY_ALL_PACKAGES` (Installed apps) |

The SDKs of the table: Google Analytics for Firebase, Firebase Crashlytics, Firebase Authentication, the Google Mobile Ads SDK and the Maps SDK for Android. Each row comes from the SDK vendor's own data disclosure page, which is named in [docs/permissions-and-sdks.md](docs/permissions-and-sdks.md) together with the data each SDK collects. The table is small on purpose and labelled as indicative: an SDK that is not in it is not reported. The tool can tell that an SDK is there and what its vendor says it collects; whether your app configures it to collect less, or what it shares, is for you to say.

## Formats

- `text`: for a terminal: the answers file, the manifests, the permissions and SDKs found, the counts, then the findings, errors first, each with its check id, file and line, message and fix.
- `markdown`: the same for a pull request comment or the job summary. Pipes, line breaks and angle brackets from the input are escaped, so a name cannot break a table.
- `json`: the whole report: the answers file, the manifests with their facts, every permission with its level and data types, every SDK found, every finding with id, severity, file, line, subject, message and fix, the notes and the gate.
- `csv`: one row per finding, quoted as RFC 4180 says. A cell that starts with `=`, `+`, `-` or `@` gets a leading `'`, so a spreadsheet does not run it as a formula.

To put the report in the job summary of a GitHub Actions run:

```yaml
permissions:
  contents: read
steps:
  - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
  - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
    with:
      node-version: 22
  - name: Data safety report
    run: npx --yes github:INNERLUXES/data-safety-check . --format markdown >> "$GITHUB_STEP_SUMMARY"
  - name: Data safety gate
    run: npx --yes github:INNERLUXES/data-safety-check . --fail-on error
```

It needs no Android SDK, no Gradle and no secrets; a Linux runner is enough.

## Exit codes

`0` no finding at the `--fail-on` level, `1` at least one such finding (by default: an error), `2` a usage or input error (a missing folder, a missing option, an unknown format).

A missing or unusable answers file is not exit code `2`: it is a finding (`answers-missing`, `answers-invalid`), so the run still reports the permissions and SDKs it found and the gate fails. Review findings never fail the gate.

## Limits

The tool reads what is declared, not what is sent. A permission or a dependency says that data may be collected, not that it is, so every finding is a question for the people who know the app, and the mapping tables are small. Build files are text to it, not Gradle: a dependency added by a plugin, or one that only comes with another library, is not seen, and neither is a permission that a binary library adds. Whether the answers are true is yours to judge. [docs/limits.md](docs/limits.md) lists these, with the size limits.

## Background

- How Android apps are built and prepared for Google Play review, with checks like this one in the pipeline: [Android app development](https://innerluxes.dev/application/mobile/development/android).

## License

MIT
