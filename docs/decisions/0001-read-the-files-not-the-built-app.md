# 1. Compare the answers with the manifests and build files, as files

## Context

The tool needs to tell whether the Data safety answers of an Android app say what the app points at. There are richer ways to know what an app does: build it and read the merged manifest, analyse the compiled code or the network traffic, resolve the whole dependency graph with Gradle and look at every transitive library, or run the app on a device. Each of them needs the Android SDK and a working Gradle build, usually with network access to resolve dependencies, and a build runs the code of build scripts and plugins. The people who need the answer most often need it before a build exists: on a pull request that adds a permission or an SDK, in a pipeline on Linux, or in a review of a project sent by someone else.

The answers themselves live in a web form in Play Console, and nothing in a repository records them, so there is nothing to compare with until the answers are kept as a file.

## Decision

The tool reads the project as files. Manifests are read as XML by a small reader inside the tool that refuses DOCTYPE and entity declarations. Build files and the version catalog are read as text; comments are blanked and dependency coordinates are found by their written form. The answers are a small JSON file in the repository, read by a strict reader of its own. The data types and purposes are Google's, the permission names are Android's, and the SDK rows come from the vendors' own disclosure pages; all of them are saved from the official pages, and a test keeps the tables and the saved text equal. The tool never runs Gradle or any other program, never evaluates a script, and never fetches anything.

Every mapping is indicative. Google's page says data that is not collected or shared is not declared, so a permission or an SDK can only point at a data type. The mappings that depend on what the app does are review findings, and none of the mappings is an error.

## Consequences

The check runs in a second, on Windows, Linux or macOS, with only Node, no Android SDK, no network access and no credentials, and no input can make it run code or reach out to a host. The same files always give the same report, so it can run on every pull request and gate a release branch. The cost is that it sees what is declared, not what is sent: it can point at a permission the app does not use, and it can miss an SDK that arrives through a plugin or a transitive dependency, a permission that a binary library adds, and any data the app collects without a permission. The tool says what it left out, lists its limits in docs/limits.md, keeps the mapping tables small and labelled as indicative, and leaves the final answer to the people who know what the app does.
