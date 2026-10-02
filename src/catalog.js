// Reads the [libraries] table of a Gradle version catalog (gradle/libs.versions.toml) and returns the
// libraries it names:
//   [{ alias, accessor, group, artifact, line }]
// accessor is the alias as Gradle writes it in a build script after "libs.": the separators "-" and "_" become
// ".". Three forms are read, each on one line, as TOML requires of an inline table:
//   alias = "group:artifact:version"
//   alias = { module = "group:artifact", version.ref = "x" }
//   alias = { group = "group", name = "artifact", version = "1.0" }
// Other tables, a [libraries.alias] table and dotted keys are not read; docs/limits.md says so.

function stripComment(line) {
  let quote = '';
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (quote) {
      if (c === '\\' && quote === '"') i += 1;
      else if (c === quote) quote = '';
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === '#') {
      return line.slice(0, i);
    }
  }
  return line;
}

const PAIR = /^([A-Za-z0-9_.-]+):([A-Za-z0-9_.-]+)(?::.*)?$/;

export function parseCatalog(text) {
  const libraries = [];
  let section = '';
  const lines = String(text).split('\n');
  for (let k = 0; k < lines.length; k += 1) {
    const line = stripComment(lines[k]).trim();
    if (!line) continue;
    const head = /^\[([^\]]+)\]$/.exec(line);
    if (head) {
      section = head[1].trim();
      continue;
    }
    if (section !== 'libraries') continue;
    const m = /^([A-Za-z0-9_.-]+)\s*=\s*(.+)$/.exec(line);
    if (!m) continue;
    const alias = m[1];
    const rest = m[2].trim();
    let group = null;
    let artifact = null;
    const plain = /^(["'])(.*)\1$/.exec(rest);
    if (plain) {
      const pair = PAIR.exec(plain[2]);
      if (pair) [, group, artifact] = pair;
    } else if (rest.startsWith('{')) {
      const module = /\bmodule\s*=\s*(["'])(.+?)\1/.exec(rest);
      if (module) {
        const pair = PAIR.exec(module[2]);
        if (pair) [, group, artifact] = pair;
      } else {
        const g = /\bgroup\s*=\s*(["'])(.+?)\1/.exec(rest);
        const n = /(?:^|[{,\s])name\s*=\s*(["'])(.+?)\1/.exec(rest);
        if (g && n) {
          group = g[2];
          artifact = n[2];
        }
      }
    }
    if (group && artifact) libraries.push({ alias, accessor: alias.replace(/[-_]/g, '.'), group, artifact, line: k + 1 });
  }
  return libraries;
}
