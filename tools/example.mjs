// Runs the README examples, checks that they report what the README shows, and writes the reports of the
// risky example project to examples/output. CI runs it and then fails if those files changed, so the example
// output in the repository is always the real output.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { main, LIMITS } from '../src/index.js';

const root = resolve(fileURLToPath(import.meta.url), '..', '..');

// Runs the tool on a folder of the repository; paths in the report are relative to the repository.
async function run(argv) {
  let out = '';
  const code = await main(argv, { out: (t) => { out += t; }, err: (t) => process.stderr.write(t) }, LIMITS, root);
  return { code, out };
}

const problems = [];
function expect(name, result, code, expected, unwanted) {
  const missing = expected.filter((e) => !result.out.includes(e));
  const wrong = unwanted.filter((e) => result.out.includes(e));
  if (result.code !== code || missing.length || wrong.length) {
    problems.push(`${name}: unexpected report (exit code ${result.code}, expected ${code}; missing: ${missing.join(' / ') || 'none'}; should not appear: ${wrong.join(' / ') || 'none'})`);
  }
}

const risky = await run([resolve(root, 'examples/android-app')]);
process.stdout.write(risky.out);
expect('risky orders app', risky, 1, [
  'data-safety-check: examples/android-app',
  'answers: examples/android-app/data-safety.json, 5 data types declared',
  'manifests: 3',
  '  CAMERA: Photos or Videos (review)',
  '  Google Analytics for Firebase (com.google.firebase:firebase-analytics) at examples/android-app/app/build.gradle.kts:26',
  'findings: 1 error, 4 warning, 1 review',
  'ERROR    no-purpose  examples/android-app/data-safety.json:9',
  'WARNING  declared-not-collected  examples/android-app/app/src/paid/AndroidManifest.xml:5',
  'WARNING  unknown-purpose  examples/android-app/data-safety.json:19',
  'REVIEW   permission-review  examples/android-app/app/src/main/AndroidManifest.xml:7',
  'is removed with tools:node="remove" and is not counted',
  'GATE: FAIL - 1 error'
], ['GATE: PASS']);

process.stdout.write('\n');
const clean = await run([resolve(root, 'examples/android-app-fixed'), '--fail-on', 'warning']);
process.stdout.write(clean.out);
expect('fixed orders app with --fail-on warning', clean, 0, [
  'answers: examples/android-app-fixed/data-safety.json, 8 data types declared',
  'findings: 0 error, 0 warning, 0 review',
  'GATE: PASS (--fail-on warning)'
], ['ERROR', 'WARNING', 'REVIEW']);

// The build folder is read when --include-generated is given: the calendar permission written there is not in the answers.
const generated = await run([resolve(root, 'examples/android-app'), '--include-generated', '--format', 'csv']);
if (!generated.out.includes('READ_CALENDAR') || generated.out.includes('left out')) problems.push('--include-generated: the build folder was not read');

// The README shows both runs as they are printed.
const readme = (await readFile(resolve(root, 'README.md'), 'utf8')).split('\r\n').join('\n');
if (!readme.includes(risky.out)) problems.push('README: the sample output of the risky app differs from a real run');
if (!readme.includes(clean.out)) problems.push('README: the sample output of the fixed app differs from a real run');

// The same project in the other formats, kept as examples of what each one looks like.
await mkdir(resolve(root, 'examples/output'), { recursive: true });
await writeFile(resolve(root, 'examples/output/android-app.txt'), risky.out);
for (const [format, name] of [['markdown', 'android-app.md'], ['json', 'android-app.json'], ['csv', 'android-app.csv']]) {
  const r = await run([resolve(root, 'examples/android-app'), '--format', format]);
  if (r.code !== 1) problems.push(`${format}: exit code ${r.code}, expected 1`);
  await writeFile(resolve(root, 'examples/output', name), r.out);
}

if (problems.length) {
  for (const p of problems) console.error(`example: ${p}`);
  process.exit(1);
}
