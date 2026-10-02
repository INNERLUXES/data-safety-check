// Command line: data-safety-check <folder> [options]

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { checkProject, FINDINGS, LIMITS } from './check.js';
import { ANSWERS_FILE } from './data.js';
import { toText, toMarkdown, toJson, toCsv } from './report.js';
import { SKIP_DIRS } from './scan.js';

export const VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

const FORMATS = { text: toText, markdown: toMarkdown, json: toJson, csv: toCsv };
const THRESHOLDS = ['error', 'warning'];

export const USAGE = `Usage: data-safety-check <folder> [options]

Checks the Data safety answers kept in an Android app repository against the app: the permissions of every
AndroidManifest.xml and the well-known SDKs of the Gradle files are mapped to the data types of Google Play's
Data safety form, and compared with the data types the answers file declares. It reads files only; it never
runs Gradle or a build, and opens no connection.

Options:
  --answers <file>     the Data safety answers file (default: ${ANSWERS_FILE} in the folder)
  --include-generated  also read ${SKIP_DIRS.join(', ')}
                       (left out by default)
  --format <name>      text, markdown, json or csv (default: text)
  --fail-on <level>    exit with 1 when a finding is at this level or above: error or warning
                       (default: error)
  --help               show this text
  --version            show the version

Checks: ${FINDINGS.map((f) => f.id).join(', ')}

Exit codes: 0 no finding at the --fail-on level, 1 such a finding, 2 usage or input error.
`;

export function parseArgs(argv) {
  const o = { folder: null, answers: null, includeGenerated: false, format: 'text', failOn: 'error', help: false, version: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) throw new Error(`${a} needs a value`);
      i += 1;
      return v;
    };
    if (a === '--help' || a === '-h') o.help = true;
    else if (a === '--version' || a === '-v') o.version = true;
    else if (a === '--include-generated') o.includeGenerated = true;
    else if (a === '--answers') o.answers = next();
    else if (a === '--format') o.format = next();
    else if (a === '--fail-on') o.failOn = next();
    else if (a === '-') throw new Error('reading from standard input is not supported; give the folder of the project');
    else if (a.startsWith('-')) throw new Error(`unknown argument ${a}`);
    else if (o.folder !== null) throw new Error(`give one folder, not ${a} as well`);
    else o.folder = a;
  }
  if (!o.help && !o.version) {
    if (o.folder === null) throw new Error('give the folder of the project');
    for (const value of [o.folder, o.answers]) {
      if (value !== null && /^[a-z][a-z0-9+.-]*:\/\//i.test(value)) throw new Error('give a local path; the tool never fetches a URL');
    }
    if (!Object.hasOwn(FORMATS, o.format)) throw new Error(`unknown format ${o.format} (text, markdown, json or csv)`);
    if (!THRESHOLDS.includes(o.failOn)) throw new Error(`--fail-on takes error or warning, not ${o.failOn}`);
  }
  return o;
}

function clean(text) {
  return String(text).replace(/[\u0000-\u001f\u007f-\u009f\u200e\u200f\u2028\u2029\u202a-\u202e\u2066-\u2069]/g, ' ');
}

// Exit code: 0 no finding at the --fail-on level, 1 such a finding, 2 usage or input error.
export async function main(argv, io = { out: (t) => process.stdout.write(t), err: (t) => process.stderr.write(t) }, limits = LIMITS, base = process.cwd()) {
  let o;
  try {
    o = parseArgs(argv);
  } catch (error) {
    io.err(`data-safety-check: ${clean(error.message)}\n\n${USAGE}`);
    return 2;
  }
  if (o.help) {
    io.out(USAGE);
    return 0;
  }
  if (o.version) {
    io.out(`${VERSION}\n`);
    return 0;
  }
  let report;
  try {
    report = await checkProject(o.folder, { answers: o.answers === null ? null : resolve(base, o.answers), includeGenerated: o.includeGenerated, failOn: o.failOn, version: VERSION, limits, base });
  } catch (error) {
    io.err(`data-safety-check: ${clean(error.message)}\n`);
    return 2;
  }
  io.out(FORMATS[o.format](report));
  return report.gate.pass ? 0 : 1;
}
