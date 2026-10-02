import { test } from 'node:test';
import assert from 'node:assert/strict';
import { csvCell, findCoordinates, mdCell, parseArgs, safeText, VERSION, USAGE, toText, toMarkdown, toJson, toCsv } from '../src/index.js';
import { GRADLE_ANALYTICS, answers, check, cli, manifest, perm, run } from './helpers.js';

const MAIN = 'app/src/main/AndroidManifest.xml';
const RISKY = {
  [MAIN]: manifest([perm('ACCESS_FINE_LOCATION'), perm('CAMERA'), perm('INTERNET')]),
  'app/build.gradle.kts': GRADLE_ANALYTICS,
  'data-safety.json': answers([['Name', true, false, []], ['Precise location', true, false, ['App functionality']]])
};
const CLEAN = {
  [MAIN]: manifest([perm('ACCESS_FINE_LOCATION')]),
  'data-safety.json': answers([['Precise location', true, false, ['App functionality']]])
};

test('text report: header, answers, manifests, permissions, SDKs, counts, findings with fix, notes and the gate line', async () => {
  const text = toText(await check(RISKY));
  assert.equal(text.split('\n')[0], 'data-safety-check: .');
  assert.ok(text.includes('answers: data-safety.json, 2 data types declared\n'));
  assert.ok(text.includes('manifests: 1\n  app/src/main/AndroidManifest.xml: 3 permissions\n'));
  assert.ok(text.includes('permissions in the app: 3\n  ACCESS_FINE_LOCATION: Precise location (direct)\n  CAMERA: Photos or Videos (review)\n  INTERNET: no data type in the table\n'));
  assert.ok(text.includes('SDKs from the table: 1\n  Google Analytics for Firebase (com.google.firebase:firebase-analytics) at app/build.gradle.kts:2\n'));
  assert.ok(text.includes('findings: 1 error, 4 warning, 1 review\n'));
  assert.ok(text.includes('ERROR    no-purpose  data-safety.json:3\n         Name is declared as collected and has no purpose'));
  assert.ok(text.includes('\n         fix: Give the data type at least one purpose'));
  assert.ok(text.endsWith('\nGATE: FAIL - 1 error\n'));
});

test('text report: a clean project says there are no findings and the gate passes', async () => {
  const text = toText(await check(CLEAN));
  assert.ok(text.includes('\nno findings\n'));
  assert.ok(text.endsWith('GATE: PASS (--fail-on error)\n'));
});

test('markdown report: tables for manifests, permissions, SDKs and findings, and a gate line', async () => {
  const md = toMarkdown(await check(RISKY));
  assert.ok(md.startsWith('## data-safety-check: 1 error, 4 warning, 1 review\n'));
  assert.ok(md.includes('| Manifest | Permissions |'));
  assert.ok(md.includes('| Permission | Data type | Level |\n| --- | --- | --- |\n| ACCESS_FINE_LOCATION | Precise location | direct |'));
  assert.ok(md.includes('| SDK | Coordinate | Where |'));
  assert.ok(md.includes('| Severity | Check | Where | Message | Fix |'));
  assert.ok(md.includes('| error | no-purpose | data-safety.json:3 |'));
  assert.ok(md.endsWith('**Gate failed:** 1 error.\n'));
});

test('markdown report: pipes, angle brackets and backslashes from the input cannot break a table', () => {
  assert.equal(mdCell('a|b <c> & d\\e\nf'), 'a\\|b &lt;c&gt; &amp; d\\\\e f');
});

test('json report: parses, and holds the answers, manifests, permissions, SDKs, findings and the gate', async () => {
  const report = JSON.parse(toJson(await check(RISKY)));
  assert.equal(report.tool, 'data-safety-check');
  assert.equal(report.answers.file, 'data-safety.json');
  assert.equal(report.answers.readable, true);
  assert.equal(report.manifests[0].file, MAIN);
  assert.deepEqual(report.permissions.map((p) => [p.name, p.level, p.dataTypes]), [
    [perm('ACCESS_FINE_LOCATION'), 'direct', ['Precise location']],
    [perm('CAMERA'), 'review', ['Photos', 'Videos']],
    [perm('INTERNET'), null, []]
  ]);
  assert.equal(report.sdks[0].id, 'firebase-analytics');
  assert.deepEqual(Object.keys(report.findings[0]), ['id', 'severity', 'file', 'line', 'subject', 'message', 'fix']);
  assert.deepEqual(report.counts, { error: 1, warning: 4, review: 1 });
  assert.equal(report.gate.pass, false);
  assert.equal(report.gate.failOn, 'error');
});

test('csv report: one row per finding, RFC 4180 quoting, CRLF line ends', async () => {
  const csv = toCsv(await check(RISKY));
  const lines = csv.split('\r\n');
  assert.equal(lines[0], 'severity,id,file,line,subject,message,fix');
  assert.equal(lines.length, 8);
  assert.ok(lines[1].startsWith('error,no-purpose,data-safety.json,3,Name,'));
  assert.ok(csv.endsWith('\r\n'));
  assert.equal(csvCell('a,"b"\nc'), '"a,""b""\nc"');
});

test('csv report: a cell a spreadsheet would read as a formula gets a leading quote', () => {
  assert.equal(csvCell('=1+1'), "'=1+1");
  assert.equal(csvCell('+SUM(A1)'), "'+SUM(A1)");
  assert.equal(csvCell('-2'), "'-2");
  assert.equal(csvCell('@x'), "'@x");
  assert.equal(csvCell(null), '');
  assert.equal(csvCell('plain'), 'plain');
});

test('text from the input is cleaned: control and direction characters never reach a report', async () => {
  const hostile = `${perm('ACCESS_FINE_LOCATION')}\u001b[31m\u202e\u2028x`;
  const report = await check({ [MAIN]: manifest([hostile]), 'data-safety.json': answers([['Name\u001b[2J', true, false, ['App functionality']]]) });
  const everything = toText(report) + toMarkdown(report) + toJson(report) + toCsv(report).replaceAll('\r\n', '\n');
  assert.doesNotMatch(everything, /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u202a-\u202e\u2028\u2029\u2066-\u2069]/);
  assert.ok(report.findings.some((f) => f.id === 'unknown-data-type'));
  assert.equal(safeText('a\u0007b'), 'a b');
  assert.equal(safeText('x'.repeat(400)).length, 300);
});

test('a hostile key, name or type is data: nothing in the tool changes because of it', async () => {
  const text = '{"dataTypes": [{"type": "__proto__", "collected": true, "shared": false, "purposes": ["constructor"]}], "__proto__": {"x": 1}}';
  const report = await check({ [MAIN]: manifest(['__proto__', 'constructor', perm('READ_SMS')]), 'data-safety.json': text });
  assert.ok(report.findings.some((f) => f.id === 'unknown-data-type' && f.subject === '__proto__'));
  assert.ok(report.findings.some((f) => f.id === 'unknown-purpose' && f.subject === 'constructor'));
  assert.equal({}.x, undefined);
});

test('no line of the Gradle file and no string from the manifest is copied into a report', async () => {
  const secret = 'example-value-not-a-real-secret';
  const report = await check({
    [MAIN]: manifest([perm('READ_SMS')]).replace('<application', `<!-- ${secret} -->\n    <application android:label="${secret}"`),
    'app/build.gradle.kts': `val token = "${secret}"\n${GRADLE_ANALYTICS}`,
    'data-safety.json': answers([])
  });
  assert.ok(report.findings.length > 0);
  assert.ok(!(toText(report) + toJson(report) + toMarkdown(report) + toCsv(report)).includes(secret));
});

test('a very long line of a Gradle file is read quickly', () => {
  const started = Date.now();
  const line = `${'implementation("a:b") '.repeat(20000)}\n${'"'.repeat(100000)}\n${'/*'.repeat(50000)}`;
  findCoordinates(line);
  assert.ok(Date.now() - started < 3000);
});

test('parseArgs: the folder, the options and their values', () => {
  const o = parseArgs(['proj', '--answers', 'a.json', '--format', 'json', '--fail-on', 'warning', '--include-generated']);
  assert.deepEqual(o, { folder: 'proj', answers: 'a.json', includeGenerated: true, format: 'json', failOn: 'warning', help: false, version: false });
  assert.deepEqual(parseArgs(['--help']).help, true);
  assert.deepEqual(parseArgs(['-v']).version, true);
});

test('parseArgs: a missing folder, a second folder, an unknown option or format, a URL and standard input are refused', () => {
  assert.throws(() => parseArgs([]), /give the folder of the project/);
  assert.throws(() => parseArgs(['a', 'b']), /give one folder, not b as well/);
  assert.throws(() => parseArgs(['a', '--nope']), /unknown argument --nope/);
  assert.throws(() => parseArgs(['a', '--format', 'xml']), /unknown format xml/);
  assert.throws(() => parseArgs(['a', '--fail-on', 'review']), /takes error or warning/);
  assert.throws(() => parseArgs(['a', '--format']), /--format needs a value/);
  assert.throws(() => parseArgs(['a', '--answers', '--format', 'json']), /--answers needs a value/);
  assert.throws(() => parseArgs(['https://example.test/app']), /never fetches a URL/);
  assert.throws(() => parseArgs(['a', '--answers', 'http://example.test/x.json']), /never fetches a URL/);
  assert.throws(() => parseArgs(['-']), /standard input is not supported/);
});

test('exit code 0: no finding at the --fail-on level; 1: such a finding; 2: a usage or input error', async () => {
  assert.equal((await run(CLEAN)).code, 0);
  const failing = await run(RISKY);
  assert.equal(failing.code, 1);
  assert.ok(failing.out.includes('GATE: FAIL - 1 error'));
  const warnOnly = { [MAIN]: manifest([perm('READ_SMS')]), 'data-safety.json': answers([]) };
  assert.equal((await run(warnOnly)).code, 0);
  assert.equal((await run(warnOnly, ['--fail-on', 'warning'])).code, 1);
  const usage = await cli([]);
  assert.equal(usage.code, 2);
  assert.ok(usage.err.includes('give the folder of the project'));
  const missing = await cli(['/no/such/folder/for/the/check']);
  assert.equal(missing.code, 2);
  assert.ok(missing.err.includes('no such folder'));
});

test('--answers, --format and --include-generated reach the check', async () => {
  const files = { ...CLEAN, 'docs/other.json': answers([]), 'app/build/AndroidManifest.xml': manifest([perm('READ_CALENDAR')]) };
  const other = await run(files, ['--answers', 'docs/other.json', '--format', 'csv']);
  assert.equal(other.code, 0);
  assert.ok(other.out.includes('permission-undeclared'));
  const generated = await run(files, ['--include-generated', '--format', 'json']);
  assert.ok(JSON.parse(generated.out).permissions.some((p) => p.name === perm('READ_CALENDAR')));
});

test('--help and --version print and exit 0, and the usage lists every check', async () => {
  const help = await cli(['--help']);
  assert.equal(help.code, 0);
  assert.equal(help.out, USAGE);
  for (const id of ['parse-error', 'answers-missing', 'answers-invalid', 'no-purpose', 'permission-undeclared', 'sdk-undeclared', 'declared-not-collected', 'unknown-data-type', 'unknown-purpose', 'duplicate-type', 'malformed-entry', 'permission-review']) assert.ok(USAGE.includes(id), id);
  const version = await cli(['--version']);
  assert.equal(version.out, `${VERSION}\n`);
  assert.match(VERSION, /^\d+\.\d+\.\d+$/);
});
