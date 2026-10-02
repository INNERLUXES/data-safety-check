# Threat model

## What the tool touches

- It reads the folder named on the command line and the `AndroidManifest.xml`, `build.gradle`, `build.gradle.kts` and `libs.versions.toml` files inside it, and the answers file (by default `data-safety.json` in the folder, or the file named with `--answers`). It does not follow a path or an address written inside a file, and it does not look at the folders around the one it was given.
- It writes only to the screen (standard output and standard error).
- It opens no network connection and runs no program: not Gradle, not an Android tool, not a shell.

## What the input may hold

A project folder is often checked in a pipeline that runs on pull requests, including pull requests from people outside the team, and a review may start from a project sent by a client or a vendor. The tool treats every file as possibly hostile. A manifest can hold a DOCTYPE with entity declarations meant to expand into gigabytes of text or to read another file or a network address, very deep nesting, very many elements, or an attribute value meant to rewrite a terminal. A build file can be huge, hold a very long line or a long unclosed string or comment made to slow a pattern down, hold a coordinate inside a comment, or hold a secret that must not end up in a report. The answers file can be deeply nested, repeat a key, hold a key named `__proto__`, or hold a type name made of control characters. A folder can hold a symbolic link that points out of it or in a loop (the default answers file can be one), a device or a pipe in place of a file, a very deep tree, or file names with control characters, direction characters or text meant for a spreadsheet or a Markdown table.

## What could go wrong, and what stops it

| Risk | Control |
| --- | --- |
| A DOCTYPE defines entities that expand exponentially (a "billion laughs" file) or an external entity that reads a local file or a network address | The XML reader refuses any DOCTYPE or ENTITY declaration before it reads what is inside, and refuses every entity except the five that XML predefines. The manifest reader allows no DOCTYPE line at all |
| A huge file, deeply nested XML or JSON, or very many elements exhaust memory or time | Files over 10 MB are refused from the size of the open file before they are read; XML or JSON deeper than 64 levels, or with more than 200,000 elements or values, is refused. The XML reader keeps its own stack instead of recursing on the input; the JSON reader recurses only as deep as its limit |
| A crafted build file makes a pattern run for a very long time | The patterns are short, anchored on a quote or a name and free of nested repetition; the masking of comments is a single pass over the text; a coordinate is looked up in a `Map`. A test runs a very long line, a long run of quotes and a long unclosed comment and checks the time |
| A symbolic link leads the walk out of the folder or round in a circle | Links are not followed, files or folders; a note counts them. The default answers file is checked before it is opened, and a link there is refused |
| A device, a pipe or a folder in place of a file makes the tool hang or read without end | The type and size are taken from the open file, and anything that is not a regular file is refused |
| A tree that is very deep or has very many entries exhausts the walk | The walk goes no deeper than 64 folders and stops after 200,000 entries, and says so in a note |
| A key named `__proto__` or `constructor` changes how objects behave | JSON objects are read into lists of keys and values, XML attributes are kept in objects without a prototype, and the tables are looked up with a `Map`; tests check that no prototype changes |
| A malformed manifest is read differently from Gradle, so a permission is missed | Anything that is not well-formed XML is refused with its line and becomes a `parse-error` finding that fails the gate by default; nothing is guessed |
| A file name, a permission name or a type name rewrites the terminal through escape sequences, or reorders text with direction characters | Control characters (C0 and C1), line and paragraph separators and Unicode direction controls are replaced by a space before any text reaches a report or an error message, and the length is capped |
| A name breaks the Markdown table in the job summary, or hides text as an HTML tag | Pipes, backslashes, line breaks, `<`, `>` and `&` are escaped in every table cell |
| A CSV report runs a formula when opened in a spreadsheet | Cells that start with `=`, `+`, `-`, `@`, a tab or a carriage return get a leading `'`; every cell is quoted as RFC 4180 says |
| A secret in a build file or a manifest ends up in a report or a job summary | The tool prints names, file paths and line numbers, never a line of a build file and never the value of an attribute, except a permission name; a test checks that a secret written in a Gradle file, a comment and an attribute does not appear in the report |
| The argument names a URL, so the tool becomes a fetcher | Arguments that look like addresses are refused, for the folder and for `--answers`; the tool has no code that opens a connection |

## Out of scope

What the code of the app does with the data, the binaries of libraries, the privacy policy and the store forms, and the truth of the answers. docs/limits.md lists what a check of the files cannot see.
