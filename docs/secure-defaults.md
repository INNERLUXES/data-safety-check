# Secure defaults

The default run is the safe run. Nothing below needs a flag, and none of it can be switched off.

## How the tool behaves by default

- **No network.** The tool reads the files it is given and sends nothing anywhere. It does not look up an SDK, a vendor page or a permission, does not follow an address from any file, and does not check for updates. An argument that looks like an address is refused. It can run in a locked-down job with no outbound access at all.
- **No Gradle, no commands.** The tool never runs Gradle, `adb`, `aapt`, a shell or any other program. Build files are read as text and searched with a few patterns; nothing in them is evaluated, and no plugin, wrapper script or build logic runs. No name, path or value from the input is ever put on a command line. A project from an unknown source can be checked without running any of its code, which is not true of syncing or building it.
- **No dependencies.** Node 22 or newer and nothing else, so a privacy check does not add a supply chain of its own. There is no `node_modules` to install before it runs.
- **Safe XML.** Every manifest is read by a small reader that refuses a DOCTYPE or an ENTITY declaration before reading anything in it, and refuses every entity except `&lt;`, `&gt;`, `&amp;`, `&quot;` and `&apos;`. Nesting deeper than 64 levels and more than 200,000 elements in one file are refused too.
- **Strict JSON.** The answers file is read by a small reader that accepts only JSON: no comments, no trailing commas, no key twice in one object, nesting no deeper than 64 levels. A key named `__proto__` is read as data.
- **Strict parsing.** A manifest that is not well-formed XML (a tag that is not closed, a second root element, an attribute given twice, a stray `<` or `&`) and an answers file that is not JSON are refused with the file and the line. They are reported as `parse-error` and `answers-invalid` findings, which fail the gate by default; a report that skipped a file it did not understand is never written without saying so.
- **Reads only what is named.** The tool opens the folder given on the command line, the files of the four kinds inside it, and the answers file. It does not follow symbolic links while walking, refuses a default answers file that is a link, and does not look at the folders around the one it was given.
- **Generated folders are left out.** `build`, `.gradle`, `.git`, `.idea`, `.cxx` and `node_modules` are not walked unless `--include-generated` is given, so merged manifests written by a build are not counted twice and the report is about the project's own files.
- **Regular files only, bounded.** Each file is opened once, its type and size are taken from the open file, and anything that is not a regular file or is over 10 MB is refused before it is read. The walk is bounded in depth and in the number of entries.
- **No source in the output.** A report holds file paths, line numbers, permission names, SDK names and coordinates, the data types and purposes of the answers, and nothing else from the input. It never holds a line of a build file or the value of an attribute of a manifest, so a report can be pasted into a pull request or a job summary without carrying a secret from the code.
- **Clean output.** Text from the input has control characters, line separators and direction controls removed and its length capped before it reaches a report or an error message, so a hostile file name cannot rewrite the terminal or reorder what a reader sees. Markdown cells escape pipes, backslashes, line breaks and `<`, `>` and `&`. CSV cells are quoted as RFC 4180 says, and a cell that a spreadsheet would read as a formula gets a leading `'`.
- **No prototype tricks.** XML attributes are stored in objects without a prototype, JSON is read into lists, and the tables are looked up in a `Map`, so a key named `__proto__` or `constructor` is just data.
- **The gate is on.** Without any option, an error makes the run exit with `1`. A pipeline that adds the tool notices a missing or unusable answers file, and a data type without a purpose, from the first run.
- **Writes nothing to disk.** The report goes to the screen. Redirect it to a file or the job summary only when you need to keep it.

## Running it safely on a project you do not know

1. Run the check before anything else touches the project: before opening it in Android Studio, before a Gradle sync and before a build. Each of those runs code from the project or its dependencies; the check does not.
2. Run it as a user with read access to the project and nothing else. It needs no Android SDK, no signing keys, no store credentials and no network.
3. Give it the folder of one app. Keep the default and read the notes, which say what was left out; add `--include-generated` only to look at build output on purpose.
