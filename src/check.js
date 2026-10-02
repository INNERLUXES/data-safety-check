// Reads a project folder and the Data safety answers file, compares the permissions of the manifests and the
// well-known SDKs of the Gradle files with the data types the answers declare, and returns one report.
// docs/method.md gives the reason behind every finding.

import { lstat, stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { ANSWERS_FILE, MANIFEST_NAME, SDKS, SOURCES, categoryOf, isDataType, isPurpose, permissionByName, sdkByCoordinate } from './data.js';
import { parseAnswers } from './answers.js';
import { parseCatalog } from './catalog.js';
import { findCoordinates } from './gradle.js';
import { parseManifest } from './manifest.js';
import { classifyManifest, resolvePermissions } from './merge.js';
import { scanFolder, readBounded, LIMITS } from './scan.js';

export { LIMITS };
export const SEVERITIES = ['error', 'warning', 'review'];
export const RANK = { error: 0, warning: 1, review: 2 };

// Every finding, in report order within a severity.
export const FINDINGS = [
  { id: 'parse-error', severity: 'error', what: 'An AndroidManifest.xml that cannot be read as XML' },
  { id: 'answers-missing', severity: 'error', what: 'The Data safety answers file does not exist, or is not a regular file' },
  { id: 'answers-invalid', severity: 'error', what: 'The answers file is not valid JSON, or is not an object with a "dataTypes" array' },
  { id: 'no-purpose', severity: 'error', what: 'A data type declared as collected or shared has no purpose' },
  { id: 'permission-undeclared', severity: 'warning', what: 'A permission points at a data type that the answers do not list' },
  { id: 'sdk-undeclared', severity: 'warning', what: 'A well-known SDK points at a data type that the answers do not list' },
  { id: 'declared-not-collected', severity: 'warning', what: 'The answers say a data type is neither collected nor shared, and a permission or an SDK points at it' },
  { id: 'unknown-data-type', severity: 'warning', what: 'A data type name that Google does not list' },
  { id: 'unknown-purpose', severity: 'warning', what: 'A purpose name that Google does not list' },
  { id: 'duplicate-type', severity: 'warning', what: 'The same data type declared twice in the answers' },
  { id: 'malformed-entry', severity: 'warning', what: 'An entry or a key of the answers file that is not in the documented format' },
  { id: 'permission-review', severity: 'review', what: 'A permission that may point at a data type, depending on what the app does, and the answers list none of them' }
];

const ORDER = Object.fromEntries(FINDINGS.map((f, i) => [f.id, i]));
const BY_ID = Object.fromEntries(FINDINGS.map((f) => [f.id, f]));

// Text from the input: control, line separator and direction characters replaced by a space, length capped.
export function safeText(value, max = 300) {
  const s = String(value).replace(/[\u0000-\u001f\u007f-\u009f\u200e\u200f\u2028\u2029\u202a-\u202e\u2066-\u2069]/g, ' ');
  return s.length > max ? `${s.slice(0, max - 3)}...` : s;
}

export function meetsThreshold(severity, failOn) {
  return RANK[severity] <= RANK[failOn];
}

function toPosix(path) {
  return sep === '/' ? path : path.split(sep).join('/');
}

// How a path is shown: relative to base, with forward slashes, when it is inside base; otherwise absolute.
export function displayPath(path, base) {
  const rel = relative(base, path);
  if (rel === '') return '.';
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) return toPosix(path);
  return toPosix(rel);
}

function compare(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function plural(count, one, many = `${one}s`) {
  return `${count.toLocaleString('en-US')} ${count === 1 ? one : many}`;
}

function sourceUrl(file) {
  const s = SOURCES.find((x) => x.file === file);
  return s ? s.url : file;
}

function listOr(items) {
  return items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} or ${items[items.length - 1]}`;
}

// The line a read error names, and its text without the label in front.
function splitError(message) {
  const m = /^[a-z]+: (?:line (\d+): )?([\s\S]*)$/.exec(String(message));
  return m ? { line: m[1] ? Number(m[1]) : 1, text: m[2] } : { line: 1, text: String(message) };
}

// Runs the scan and the checks on a folder. options: { answers, includeGenerated, failOn, base, version,
// limits }. answers is the path of the answers file (default: data-safety.json in the folder); base is the folder
// that paths are shown relative to (default: the current folder). A folder that is missing or not a folder stops
// the run with an error.
export async function checkProject(folder, { answers = null, includeGenerated = false, failOn = 'error', base = process.cwd(), version = '1.0.0', limits = LIMITS } = {}) {
  const root = resolve(folder);
  let info;
  try {
    info = await stat(root);
  } catch (error) {
    throw new Error(`${safeText(folder)}: ${error.code === 'ENOENT' ? 'no such folder' : `cannot be read (${error.code ?? 'error'})`}`);
  }
  if (!info.isDirectory()) throw new Error(`${safeText(folder)}: a file, not a folder; give the folder of the project`);
  const baseDir = resolve(base);
  const show = (p) => safeText(displayPath(p, baseDir));
  const rel = (p) => toPosix(relative(root, p));

  const found = await scanFolder(root, { includeGenerated, limits });
  const notes = [];
  const note = (text) => notes.push(safeText(text, 600));
  const all = [];
  const add = (id, file, line, subject, message, fix) => {
    all.push({
      id,
      severity: BY_ID[id].severity,
      file,
      line: Math.max(1, Number(line) || 1),
      subject: safeText(subject),
      message: safeText(message, 1200),
      fix: safeText(fix, 1200)
    });
  };

  // Manifests: the permissions each one declares or removes.
  const manifests = [];
  const declared = [];
  const removed = [];
  let testManifests = 0;
  for (const path of found.manifests) {
    const file = show(path);
    const where = classifyManifest(rel(path));
    if (where.kind === 'test') {
      testManifests += 1;
      continue;
    }
    try {
      const model = parseManifest((await readBounded(path, limits)).toString('utf8'), 'manifest');
      for (const p of model.permissions) {
        const item = { name: safeText(p.name, 200), file, line: p.line, module: where.module, kind: where.kind };
        (p.removed ? removed : declared).push(item);
      }
      for (const issue of model.issues) note(`${file}:${issue.line}: ${issue.message}`);
      manifests.push({ file, readable: true, kind: where.kind, permissions: model.permissions.filter((p) => !p.removed).length, removals: model.permissions.filter((p) => p.removed).length });
    } catch (error) {
      const { line, text } = splitError(error.reason ? `manifest: ${error.reason}` : error.message);
      add('parse-error', file, line, MANIFEST_NAME, `${file} cannot be read: ${text}`, 'Fix the file so that it is well-formed XML without a DOCTYPE, then run the check again');
      manifests.push({ file, readable: false, kind: where.kind, permissions: 0, removals: 0 });
    }
  }
  manifests.sort((a, b) => compare(a.file, b.file));
  const cmp = (a, b) => compare(a.name, b.name) || compare(a.file, b.file) || a.line - b.line;
  declared.sort(cmp);
  removed.sort(cmp);
  const { kept, dropped } = resolvePermissions(declared, removed);

  // One entry per permission name, at its first declaration.
  const byName = new Map();
  for (const d of kept) {
    const same = byName.get(d.name);
    if (same) same.files.add(d.file);
    else byName.set(d.name, { name: d.name, file: d.file, line: d.line, files: new Set([d.file]), mapping: permissionByName(d.name) });
  }
  const permissions = [...byName.values()];

  // Build files and catalogs: the SDKs of the table.
  let catalog = [];
  for (const path of found.catalogs) {
    try {
      catalog = catalog.concat(parseCatalog((await readBounded(path, limits)).toString('utf8')));
    } catch (error) {
      note(`${show(path)}: not read (${error.reason ?? error.message})`);
    }
  }
  const sdkUse = new Map();
  for (const path of found.builds) {
    let text;
    try {
      text = (await readBounded(path, limits)).toString('utf8');
    } catch (error) {
      note(`${show(path)}: not read (${error.reason ?? error.message})`);
      continue;
    }
    const file = show(path);
    for (const c of findCoordinates(text, catalog)) {
      const coordinate = `${c.group}:${c.artifact}`;
      const sdk = sdkByCoordinate(coordinate);
      if (!sdk) continue;
      if (!sdkUse.has(sdk.id)) sdkUse.set(sdk.id, { sdk, coordinate, file, line: c.line, count: 0 });
      sdkUse.get(sdk.id).count += 1;
    }
  }
  const sdks = SDKS.filter((s) => sdkUse.has(s.id)).map((s) => sdkUse.get(s.id));

  // The answers file.
  const answersPath = answers === null ? resolve(root, ANSWERS_FILE) : resolve(answers);
  const answersShown = show(answersPath);
  let model = null;
  let answersProblem = null;
  try {
    if (answers === null) {
      const link = await lstat(answersPath);
      if (link.isSymbolicLink()) throw Object.assign(new Error('x'), { reason: 'a symbolic link, which is not followed' });
    }
    model = parseAnswers((await readBounded(answersPath, limits)).toString('utf8'), 'answers');
  } catch (error) {
    if (error.code === 'ENOENT' || error.reason === 'no such file') {
      answersProblem = 'missing';
      add('answers-missing', answersShown, 1, ANSWERS_FILE, `the Data safety answers file ${answersShown} does not exist`, `Write the answers of your Data safety form to ${ANSWERS_FILE} in the folder of the project, or name the file with --answers; docs/data-safety-answers.md describes the format`);
    } else if (error.reason) {
      answersProblem = 'invalid';
      add('answers-missing', answersShown, 1, ANSWERS_FILE, `the Data safety answers file ${answersShown} cannot be read: ${error.reason}`, 'Make it a regular JSON file inside the project');
    } else {
      answersProblem = 'invalid';
      const { line, text } = splitError(error.message);
      add('answers-invalid', answersShown, line, ANSWERS_FILE, `${answersShown} cannot be used: ${text}`, 'Fix the file so that it is JSON with a "dataTypes" array; docs/data-safety-answers.md shows the format');
    }
  }

  // Entries of the answers file against Google's names.
  const entries = model ? model.entries : [];
  if (model) {
    for (const issue of model.issues) add('malformed-entry', answersShown, issue.line, issue.subject, issue.message, 'Use the keys type, collected, shared and purposes in each entry of "dataTypes"');
    const seen = new Map();
    for (const e of entries) {
      if (!e.type) continue;
      const name = e.type.value;
      if (!isDataType(name)) {
        add('unknown-data-type', answersShown, e.type.line, name, `"${safeText(name, 120)}" is not a data type that Google's Data safety page lists`, 'Write the data type exactly as Google writes it, for example "Precise location"; docs/data-safety-answers.md lists them all');
      } else if (seen.has(name)) {
        add('duplicate-type', answersShown, e.type.line, name, `${name} is declared twice (first at line ${seen.get(name)})`, 'Merge the two entries into one with all the purposes');
      }
      if (!seen.has(name)) seen.set(name, e.type.line);
      for (const p of e.purposes) {
        if (!isPurpose(p.value)) add('unknown-purpose', answersShown, p.line, p.value, `"${safeText(p.value, 120)}" is not a purpose that Google's Data safety page lists`, 'Write the purpose exactly as Google writes it, for example "App functionality"; docs/data-safety-answers.md lists them all');
      }
      if ((e.collected || e.shared) && e.purposes.length === 0) {
        add('no-purpose', answersShown, e.line, name, `${safeText(name, 120)} is declared as ${e.collected && e.shared ? 'collected and shared' : e.collected ? 'collected' : 'shared'} and has no purpose`, 'Give the data type at least one purpose: Google asks for the purposes of every data type that is collected or shared');
      }
    }
  }

  // Permissions and SDKs against the declared data types.
  const lookup = (types) => {
    const matching = entries.filter((e) => e.type && types.includes(e.type.value));
    return { present: matching.length > 0, active: matching.some((e) => e.collected || e.shared), line: matching.length ? matching[0].type.line : 0 };
  };
  if (model) {
    for (const p of permissions) {
      if (!p.mapping) continue;
      const { types, level, page } = p.mapping;
      const r = lookup(types);
      const typeText = listOr(types);
      if (!r.present) {
        if (level === 'direct') {
          add('permission-undeclared', p.file, p.line, p.name, `${p.name} points at ${typeText}, and ${answersShown} does not list it; Google's Data safety page defines that data type with "${page}"`, `If the app collects or shares ${typeText}, add it to ${answersShown} with its purposes. Google says data that stays on the device need not be declared, so this can also be a reminder to check what the permission is used for`);
        } else {
          add('permission-review', p.file, p.line, p.name, `${p.name} can mean ${typeText}, depending on what the app does with the data, and ${answersShown} lists none of them`, `Decide what the app does with it: if it collects or shares ${typeText}, add it to ${answersShown} with its purposes; if the data stays on the device, nothing is needed`);
        }
      } else if (!r.active && level === 'direct') {
        add('declared-not-collected', p.file, p.line, p.name, `${p.name} is in the manifest, and ${answersShown} says ${typeText} is neither collected nor shared (line ${r.line})`, 'Check that no data of this type leaves the device through the app, a library or a webview; if some does, set collected or shared to true and give the purposes');
      }
    }
    for (const u of sdks) {
      for (const t of u.sdk.types) {
        const r = lookup([t.type]);
        const when = t.when === 'automatic' ? 'collects by default' : 'collects depending on how it is used';
        const vendor = t.vendor.map((v) => `"${v}"`).join(', ');
        const fixUrl = `the vendor's page is ${sourceUrl(u.sdk.source)}`;
        if (!r.present) {
          add('sdk-undeclared', u.file, u.line, `${u.sdk.name} - ${t.type}`, `${u.sdk.name} (${u.coordinate}) is a dependency and ${when} ${vendor}, which Google's page puts under ${t.type} (${categoryOf(t.type)}); ${answersShown} does not list it`, `Add ${t.type} to ${answersShown} with its purposes, or remove the SDK; ${fixUrl}`);
        } else if (!r.active) {
          add('declared-not-collected', u.file, u.line, `${u.sdk.name} - ${t.type}`, `${u.sdk.name} (${u.coordinate}) is a dependency and ${when} ${vendor}, and ${answersShown} says ${t.type} is neither collected nor shared (line ${r.line})`, `Check how the SDK is configured in the app; if it collects the data, set collected or shared to true and give the purposes; ${fixUrl}`);
        }
      }
    }
  } else {
    note('the answers file could not be used, so the permissions and SDKs were not compared with it');
  }

  if (found.skippedDirs.size) note(`left out ${plural(found.skippedDirs.size, 'kind of folder', 'kinds of folders')} (${[...found.skippedDirs].sort().join(', ')}); use --include-generated to read them`);
  if (found.links) note(`${plural(found.links, 'symbolic link')} not followed`);
  for (const u of found.unreadable) note(`${show(u.path)}: folder cannot be listed (${u.code})`);
  if (found.tooDeep) note(`${plural(found.tooDeep, 'folder')} nested more than ${limits.maxDepth} deep left out`);
  if (found.truncated) note(`stopped after ${limits.maxFiles.toLocaleString('en-US')} directory entries`);
  if (found.manifests.length === 0) note(`no ${MANIFEST_NAME} was found in the folder`);
  if (testManifests) note(`${plural(testManifests, 'manifest')} of test source sets left out: they are not part of the app`);
  if (found.builds.length === 0) note('no build.gradle or build.gradle.kts was found, so no SDK was looked for');
  const unmapped = permissions.filter((p) => !p.mapping).length;
  if (unmapped) note(`${plural(unmapped, 'permission')} with no entry in the mapping table (see docs/permissions-and-sdks.md)`);
  for (const r of dropped) note(`${r.file}:${r.line}: ${r.name} is removed with tools:node="remove" and is not counted`);

  const findings = all.sort((a, b) => RANK[a.severity] - RANK[b.severity]
    || ORDER[a.id] - ORDER[b.id]
    || compare(a.file, b.file)
    || a.line - b.line
    || compare(a.subject, b.subject));
  const counts = { error: 0, warning: 0, review: 0 };
  for (const f of findings) counts[f.severity] += 1;
  const failing = findings.filter((f) => meetsThreshold(f.severity, failOn));
  const reason = failOn === 'error'
    ? plural(counts.error, 'error')
    : [counts.error ? plural(counts.error, 'error') : '', counts.warning ? plural(counts.warning, 'warning') : ''].filter(Boolean).join(', ');
  return {
    tool: 'data-safety-check',
    version,
    folder: safeText(displayPath(root, baseDir)),
    answers: { file: answersShown, readable: Boolean(model), dataTypes: entries.length, problem: answersProblem },
    scanned: { manifests: manifests.length, builds: found.builds.length, catalogs: found.catalogs.length },
    manifests,
    permissions: permissions.map((p) => ({
      name: p.name,
      file: p.file,
      line: p.line,
      files: p.files.size,
      level: p.mapping ? p.mapping.level : null,
      dataTypes: p.mapping ? p.mapping.types : []
    })),
    removed: removed.map((r) => ({ name: r.name, file: r.file, line: r.line })),
    sdks: sdks.map((u) => ({ id: u.sdk.id, name: u.sdk.name, kind: u.sdk.kind, coordinate: u.coordinate, file: u.file, line: u.line, uses: u.count })),
    counts,
    findings,
    notes,
    gate: { failOn, pass: failing.length === 0, reason: failing.length ? reason : null }
  };
}
