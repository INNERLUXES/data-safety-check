# Security

## Reporting a problem

Write to info@innerluxes.dev with the subject line "data-safety-check security", or use private vulnerability reporting on this repository. Please do not open a public issue for a vulnerability.

Include a small made-up manifest, Gradle file, answers file or folder layout that shows the problem, what you expected and what happened. Use made-up package names, folder names and host names (such as `com.example.orders` and `example.test`), and no real keys, internal addresses or customer files.

## Scope

In scope:

- an input that makes the tool open a network connection, run a program (Gradle, an Android tool, a shell), or evaluate anything in a build script
- an input that makes the tool read a file other than the manifests, build files, version catalogs and answers file of the folder it was given, through a symbolic link or a path written in a file
- a manifest that makes the reader expand an entity, read another file, or accept a DOCTYPE
- an answers file that makes the JSON reader accept something JSON does not allow, or follow a path
- an input that makes the tool hang, take very long, or use unbounded memory or stack, such as deep nesting, very many elements, a very long line or an unclosed comment or string in a build file, a deep or looping folder tree, or a path that is not a regular file
- a line of a build file, the value of an attribute of a manifest, or free text of the answers file that appears in a report
- text from a file name, a permission name, a data type or a purpose that breaks a Markdown table, injects a formula into a CSV report, or rewrites the terminal through control or direction characters
- a key name that changes how objects behave inside the tool
- a finding that docs/method.md says is reported, for an input the tool accepts, that the report leaves out

Out of scope: what the code of the app does with the data, the binaries of libraries, whether the answers are true, and Google's rules themselves (docs/limits.md lists what a check of the files cannot see).

Read [docs/threat-model.md](docs/threat-model.md) for the rest.
