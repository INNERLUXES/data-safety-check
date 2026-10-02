# Limits

## What the tool can know

- **It sees what is declared, not what is sent.** A manifest says the app may ask for a permission, and a dependency says a library is in the app. Neither says that data leaves the device, which is what makes it "collected" or "shared" on Google's form. A finding is a question to answer, not a verdict. Google's page says as much: an app that holds a permission and does not collect the data does not declare it.
- **The answers are claims.** The tool checks that the names are the ones Google lists and that the entries are complete. It cannot tell whether `collected: false` is true, or whether the purposes are the right ones.
- **The mapping tables are small and indicative.** [permissions-and-sdks.md](permissions-and-sdks.md) lists them. A permission or an SDK that is not in the table is not reported, and the absence of a finding is not a statement that nothing needs declaring. Among others, the advertising ID permission, the Play services location library and most third-party analytics, crash, ads and sign-in SDKs are not in the tables.
- **The vendors' pages change.** Each SDK row is the vendor's page for its latest version at the time it was saved. An older version of the SDK may collect something else, and a newer one may add data; the tool does not know the version a project uses. The tables are those of the saved pages: data that a vendor adds later is not reported until the table is updated.
- **Google's list changes.** A data type or purpose that Google adds later is reported as unknown (`unknown-data-type`, `unknown-purpose`) until the tool is updated.

## What the manifests cover

- **One project, one answer.** All the manifests found in the folder together are compared with one answers file, as Google has one form per app. A repository that holds several apps should be checked once per app, each with its own folder and answers file.
- **Merged manifests are not built.** The tool does not run the manifest merger. It reads the files as they are in the repository, and reads `tools:node="remove"` by the rule in [method.md](method.md), which is its own simplification: it does not know which flavours and build types are combined, or which module depends on which. `tools:selector`, `tools:node="removeAll"` and `replace` are not read. Permissions that a library's manifest adds are only seen when the library is a module of the folder; a binary library's manifest is not read.
- **Placeholders.** A permission name that is a placeholder (for example `${applicationId}.permission.X`) is kept as written and is not in the table.
- **Where else permissions come from.** Permissions requested only at run time need a declaration in the manifest, so the manifest is complete for the permissions this tool maps; data accessed without a permission (a file the user picks, the clipboard, an identifier) is not seen.
- **Test source sets.** The manifests of `test`, `androidTest`, `testFixtures` and their variants are left out by name. A flavour whose name starts with one of those words and a capital letter would be left out too.

## What the build files cover

- **Text, not Gradle.** The build files are never evaluated. A dependency added by a plugin, a convention plugin in `buildSrc` or a build logic module, a dependency written with a computed name, a string template that itself contains quotes, or a catalog that is declared in `settings.gradle` under another name than `libs` is not seen. The only catalog read is `gradle/libs.versions.toml`, and the only reference form is `libs.` followed by the alias.
- **Catalog syntax.** In `[libraries]` the three one-line forms are read: a string, a table with `module`, and a table with `group` and `name`. A `[libraries.alias]` table and dotted keys are not read. A library that the catalog defines and no build file uses is not a dependency of the app and is not reported.
- **Transitive dependencies.** Only the dependencies written in the build files are seen, not those they pull in. An SDK that comes with another one (the Firebase installations library with Crashlytics, for one) is not looked for on its own.
- **Configurations.** A dependency on a line that starts with a test configuration is left out. A dependency in a configuration of a different kind (an annotation processor, a debug-only library) is counted.

## What the tool does not check

- The rest of the form: optional or required, encryption in transit, the deletion mechanism, the badges, the privacy policy and the app content declarations.
- Whether the answers file matches what was submitted in Play Console. The file is whatever the repository says.
- Google Play's policies on permissions and APIs that access sensitive information, which are separate from the Data safety form.
- Apple's App Store privacy details. A sibling tool, [privacy-manifest-check](https://github.com/INNERLUXES/privacy-manifest-check), reads the privacy manifests of iOS apps.

## Size

- A manifest, build file, catalog or answers file over 10 MB is not read: a manifest or the answers file becomes a finding, a build file a note.
- A manifest or an answers file with nesting deeper than 64 levels, or with more than 200,000 elements or values, is refused.
- The walk stops after 200,000 directory entries and goes no deeper than 64 folders; a note says so when it happens.
- Text shown in a report is cut to a fixed length: 300 characters for a name, a subject or a path, 1,200 for a message or a fix, 600 for a note.

Every limit is reported, as a finding, a note or a stopped run, so a cut is never silent.
