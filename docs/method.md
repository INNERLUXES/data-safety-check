# Method

The tool answers one question: does the Data safety answers file of this project say what the project's manifests and dependencies point at? It reads the `AndroidManifest.xml` files as data, the Gradle files as text, and the answers file as JSON, compares them, and turns each difference into a finding with a severity, a file and a line. It never runs Gradle or a build, and it never fetches anything.

Everything it knows about data types and purposes comes from Google's Data safety help page, the permission names from the Android reference page for `Manifest.permission`, and the SDK rows from the vendors' data disclosure pages. They are saved under [research/sources](../research/sources) and listed in [permissions-and-sdks.md](permissions-and-sdks.md). A test compares the tables in `src/data.js` with those saved pages, so the tool and its sources cannot drift apart without a failing test.

## What Google's page says, and what follows from it

Three statements of Google's page decide how the tool is built.

- The form covers what the app collects or shares, and "collect" includes data that the libraries and SDKs of the app transmit off the device. So the tool looks at the permissions of the manifests and at the SDKs among the dependencies.
- An app does not declare data it does not actually collect or share, even when it holds a permission for it, and data that is only processed on the device is out of scope. So a permission can only point at a data type. The tool cannot know whether the data leaves the device, and therefore never reports an error because of a permission or an SDK. The strongest finding such a mapping gives is a warning, and a mapping that depends on what the app does is only a review finding.
- Every data type that is collected or shared has purposes. So a declared data type without a purpose is the one error that comes from the answers file alone.

## How the files are read

**The folder.** The folder given on the command line is walked in name order. The walk skips `build`, `.gradle`, `.git`, `.idea`, `.cxx` and `node_modules`, at any depth, unless `--include-generated` is given; the names are compared exactly, letter case included. Symbolic links are not followed. A file is a manifest when its name is exactly `AndroidManifest.xml`, a build file when it is exactly `build.gradle` or `build.gradle.kts`, and a version catalog when it is `libs.versions.toml` in a folder named `gradle`. The lists are sorted by the path below the folder, written with forward slashes, so the order is the same on Linux, macOS and Windows.

**The manifests.** The XML reader is the one described in [secure-defaults.md](secure-defaults.md). From each manifest the tool keeps the `<uses-permission>` and `<uses-permission-sdk-23>` elements that are direct children of `<manifest>`, with the value of `android:name` and the line of the element. The prefixes of the `android` and `tools` namespaces are read from the `xmlns` declarations of the root (they are `android` and `tools` when the root does not declare them). Everything else in the file is ignored. A root that is not `<manifest>`, XML that is not well-formed, a DOCTYPE, nesting over 64 levels and more than 200,000 elements are refused, and the file becomes a `parse-error` finding with its line.

**Source sets.** A manifest at `<module>/src/<set>/AndroidManifest.xml` belongs to that module and source set. `main` is the main source set; the source sets of local and instrumented tests (`test`, `androidTest`, `testFixtures`, and their variants such as `testDebug`) are not part of the app, and their manifests are left out with a note. Any other name is a flavour or a build type. A manifest anywhere else belongs to the main source set of the folder it is in.

**Removals.** A permission element with `tools:node="remove"` tells the manifest merger to drop that permission. The tool reads it as follows, and this is its own choice: a removal drops the declaration in the same file. A removal in a main manifest also drops the declarations of the same permission in manifests of other modules, which is how an app removes a permission that one of its libraries adds. A removal in a flavour or build type manifest drops nothing else, because the other variants still have the permission; and a removal in a main manifest does not drop a declaration in a flavour manifest of its own module, which adds it on purpose. Google's page says the form describes the sum of all versions of the app distributed on Google Play, which is why a permission that any variant has still counts. A permission that was dropped is named in a note. Other values of `tools:node` and `tools:selector` are not read.

**The build files.** A Gradle file is read as text and never run. Comments (`//` to the end of the line and `/* */`) are blanked first, outside strings, so a coordinate in a comment is not a dependency and line numbers do not move. Three forms are found: a string `"group:artifact:version"` (or without a version), the map form `group: 'g', name: 'a'` (also with `=`), and a reference `libs.some.alias` that is looked up in the `[libraries]` table of the version catalog. A dependency written on a line that starts with a test configuration (`testImplementation`, `androidTestImplementation`, `testFixtures...` and the like) is left out. A coordinate is matched with the SDK table by exact `group:artifact`.

**The answers file.** Strict JSON, with the line of every value, described in [data-safety-answers.md](data-safety-answers.md).

## The checks

| Id | Severity | Rule and why it matters |
| --- | --- | --- |
| `parse-error` | error | An `AndroidManifest.xml` that is not a well-formed XML manifest, or is over the size limit. Nothing in it can be checked. The file and the line of the fault are shown, the other manifests are still checked |
| `answers-missing` | error | The answers file does not exist (or is a folder, or is the default file as a symbolic link). Without it nothing can be compared, and a project that keeps no answers has nothing to keep in step with the code |
| `answers-invalid` | error | The answers file is not JSON, or is not an object with a `dataTypes` array. The line of the fault is shown |
| `no-purpose` | error | An entry has `collected` or `shared` true and an empty or missing `purposes`. Google asks for the purposes of every data type that is collected or shared |
| `permission-undeclared` | warning | A permission of level `direct` points at a data type that no entry of the answers names. It is a warning because the data may stay on the device, which Google's page says need not be declared |
| `sdk-undeclared` | warning | An SDK of the table is a dependency, and its vendor lists data that Google's page puts under a data type that no entry names. One finding per SDK and data type, at the line of the dependency |
| `declared-not-collected` | warning | The answers name the data type of a `direct` permission or of an SDK, with `collected` and `shared` both false. The answer may be right, but it is the one that is easiest to be wrong about: the data may leave the device through the app, a library or a webview |
| `unknown-data-type` | warning | A `type` that is not one of the 38 names Google lists, compared exactly |
| `unknown-purpose` | warning | A purpose that is not one of the 7 names Google lists, compared exactly |
| `duplicate-type` | warning | The same data type in two entries. The second one is reported |
| `malformed-entry` | warning | An entry that is not an object, lacks `type`, lacks `collected` or `shared` (read as false), has a purposes value that is not an array of strings, or a key that is not documented |
| `permission-review` | review | A permission of level `review` can mean one of several data types, or may not produce data at all, and no entry names any of them. Naming one of them, collected or not, answers it |

Severities: an **error** is something wrong with the answers file as such: missing, unreadable, or incomplete in a way Google's form does not allow. A **warning** is a difference between the answers and what the manifests or dependencies point at, or a name Google does not list. A **review** is a question for a person. Review findings never fail the gate.

## What the gate does

`--fail-on error` (the default) fails the run when there is at least one error. `--fail-on warning` fails it on a warning too. The exit code is `0` when no finding reaches that level and `1` otherwise. A usage or input error (no folder, a folder that does not exist, an unknown option) is `2`. A missing answers file is not `2`: it is the `answers-missing` finding, so the report still shows the permissions and SDKs that were found, and the gate fails. The report always says which gate ran and why it failed.

## Order of findings

Errors first, then warnings, then review; inside a severity by the order of the checks above, then by file, line and subject. The same folder always gives the same report.
