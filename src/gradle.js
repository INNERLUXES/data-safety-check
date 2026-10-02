// Finds dependency coordinates in a build.gradle or build.gradle.kts file, as text. Nothing is run and no
// script is evaluated. Comments are blanked first (a line of // and a block of /* */, outside strings), so a
// coordinate in a comment is not a dependency and line numbers do not move. Three forms are found:
//   "group:artifact:version" or 'group:artifact', as a string
//   group: 'group', name: 'artifact'   (also with =), the map form of Groovy
//   libs.some.alias                    a library of gradle/libs.versions.toml, looked up in the catalog
// Dependencies of the test configurations (test..., androidTest..., testFixtures...) are not part of the app
// and are left out. Each result is { group, artifact, line, config, via }.

const TEST_CONFIG = /^(?:test|androidTest|testFixtures|kaptTest|kaptAndroidTest|kspTest|kspAndroidTest|annotationProcessorTest|annotationProcessorAndroidTest)(?:[A-Z]\w*)?$/;

export function maskComments(text) {
  const s = String(text);
  let out = '';
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === '/' && s[i + 1] === '/') {
      while (i < s.length && s[i] !== '\n') {
        out += ' ';
        i += 1;
      }
    } else if (c === '/' && s[i + 1] === '*') {
      const end = s.indexOf('*/', i + 2);
      const stop = end < 0 ? s.length : end + 2;
      for (; i < stop; i += 1) out += s[i] === '\n' ? '\n' : ' ';
    } else if (c === '"' || c === "'") {
      const triple = s.startsWith(c.repeat(3), i);
      const close = triple ? c.repeat(3) : c;
      out += close;
      i += close.length;
      while (i < s.length) {
        if (s[i] === '\\') {
          out += s.slice(i, i + 2);
          i += 2;
        } else if (s.startsWith(close, i)) {
          out += close;
          i += close.length;
          break;
        } else if (!triple && s[i] === '\n') {
          break;
        } else {
          out += s[i];
          i += 1;
        }
      }
    } else {
      out += c;
      i += 1;
    }
  }
  return out;
}

export function isTestConfig(name) {
  return TEST_CONFIG.test(name);
}

export function findCoordinates(text, catalog = []) {
  const s = maskComments(text);
  const starts = [0];
  for (let i = 0; i < s.length; i += 1) if (s[i] === '\n') starts.push(i + 1);
  const lineAt = (pos) => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= pos) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };
  const configAt = (pos) => {
    const from = starts[lineAt(pos) - 1];
    const m = /^[ \t]*([A-Za-z_]\w*)/.exec(s.slice(from, pos));
    return m ? m[1] : null;
  };
  const found = [];
  const add = (group, artifact, pos, via) => {
    const config = configAt(pos);
    if (config && isTestConfig(config)) return;
    found.push({ group, artifact, line: lineAt(pos), config, via });
  };
  for (const m of s.matchAll(/(["'])([A-Za-z0-9_.-]+):([A-Za-z0-9_.-]+)(?::[^"'\s]*)?\1/g)) add(m[2], m[3], m.index, 'string');
  for (const m of s.matchAll(/\bgroup\s*[:=]\s*(["'])([A-Za-z0-9_.-]+)\1\s*,\s*name\s*[:=]\s*(["'])([A-Za-z0-9_.-]+)\3/g)) add(m[2], m[4], m.index, 'map');
  const byAccessor = new Map(catalog.map((l) => [l.accessor, l]));
  for (const m of s.matchAll(/(?<![\w.])libs\.([A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)*)/g)) {
    const parts = m[1].split('.');
    if (parts[0] === 'versions' || parts[0] === 'plugins' || parts[0] === 'bundles') continue;
    for (let n = parts.length; n >= 1; n -= 1) {
      const lib = byAccessor.get(parts.slice(0, n).join('.'));
      if (lib) {
        add(lib.group, lib.artifact, m.index, 'catalog');
        break;
      }
    }
  }
  return found.sort((a, b) => a.line - b.line || (a.artifact < b.artifact ? -1 : a.artifact > b.artifact ? 1 : 0));
}
