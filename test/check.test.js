import { test } from 'node:test';
import assert from 'node:assert/strict';
import { symlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { checkProject, scanFolder, readBounded } from '../src/index.js';
import { GRADLE_ANALYTICS, answers, check, find, ids, manifest, perm, withFiles } from './helpers.js';

const MAIN = 'app/src/main/AndroidManifest.xml';
const FULL = answers([['Precise location', true, false, ['App functionality']]]);

test('a project whose answers cover its permissions has no findings', async () => {
  const report = await check({ [MAIN]: manifest([perm('ACCESS_FINE_LOCATION'), perm('INTERNET')]), 'data-safety.json': FULL });
  assert.deepEqual(report.findings, []);
  assert.equal(report.gate.pass, true);
  assert.equal(report.answers.dataTypes, 1);
  assert.deepEqual(report.permissions.map((p) => p.name), [perm('ACCESS_FINE_LOCATION'), perm('INTERNET')]);
});

test('answers-missing: no answers file is an error, and the rest of the project is still read', async () => {
  const report = await check({ [MAIN]: manifest([perm('ACCESS_FINE_LOCATION')]) });
  assert.deepEqual(ids(report), ['answers-missing']);
  assert.equal(report.findings[0].severity, 'error');
  assert.equal(report.findings[0].file, 'data-safety.json');
  assert.equal(report.permissions.length, 1);
  assert.equal(report.gate.pass, false);
  assert.ok(report.notes.some((n) => n.includes('were not compared')));
});

test('answers-missing: --answers names another file, and a folder in its place is refused', async () => {
  const files = { [MAIN]: manifest([perm('ACCESS_FINE_LOCATION')]), 'docs/answers.json': FULL };
  const named = await withFiles(files, (dir) => checkProject(dir, { base: dir, answers: resolve(dir, 'docs/answers.json') }));
  assert.deepEqual(named.findings, []);
  const folder = await withFiles(files, (dir) => checkProject(dir, { base: dir, answers: resolve(dir, 'docs') }));
  assert.deepEqual(ids(folder), ['answers-missing']);
  assert.match(folder.findings[0].message, /a folder, not a file|not a regular file/);
});

test('answers-missing: a default answers file that is a symbolic link is not followed', async (t) => {
  await withFiles({ [MAIN]: manifest([]), 'real.json': FULL }, async (dir) => {
    try {
      await symlink(resolve(dir, 'real.json'), resolve(dir, 'data-safety.json'));
    } catch {
      t.skip('symbolic links cannot be made here');
      return;
    }
    const report = await checkProject(dir, { base: dir });
    assert.deepEqual(ids(report), ['answers-missing']);
    assert.match(report.findings[0].message, /symbolic link/);
  });
});

test('answers-invalid: text that is not JSON is an error with the line, and so is a wrong top value', async () => {
  const broken = await check({ [MAIN]: manifest([]), 'data-safety.json': '{\n  "dataTypes": [\n    {"type": "Name",}\n  ]\n}' });
  assert.deepEqual(ids(broken), ['answers-invalid']);
  assert.equal(broken.findings[0].line, 3);
  assert.equal(broken.answers.readable, false);
  const wrong = await check({ [MAIN]: manifest([]), 'data-safety.json': '{"data": []}' });
  assert.deepEqual(ids(wrong), ['answers-invalid']);
  assert.match(wrong.findings[0].message, /no "dataTypes" array/);
});

test('no-purpose: collected or shared data without a purpose is an error, data that is neither is not', async () => {
  const report = await check({
    [MAIN]: manifest([]),
    'data-safety.json': answers([['Name', true, false, []], ['Email address', false, true, null], ['Address', false, false, []], ['Phone number', true, true, ['Analytics']]])
  });
  assert.deepEqual(find(report, 'no-purpose').map((f) => [f.subject, f.line]), [['Name', 3], ['Email address', 9]]);
  assert.match(find(report, 'no-purpose')[1].message, /declared as shared and has no purpose/);
  assert.equal(report.findings.length, 2);
});

test('unknown-data-type and unknown-purpose: names are compared exactly with the ones Google lists', async () => {
  const report = await check({
    [MAIN]: manifest([]),
    'data-safety.json': answers([['precise location', true, false, ['App functionality']], ['Name', true, false, ['analytics', 'Analytics']]])
  });
  assert.deepEqual(find(report, 'unknown-data-type').map((f) => f.subject), ['precise location']);
  assert.deepEqual(find(report, 'unknown-purpose').map((f) => f.subject), ['analytics']);
  assert.equal(find(report, 'unknown-purpose')[0].severity, 'warning');
});

test('duplicate-type and malformed-entry: a type declared twice, a missing flag and a key that is not documented', async () => {
  const text = '{"dataTypes": [{"type": "Name", "collected": true, "shared": false, "purposes": ["Analytics"]}, {"type": "Name", "collected": true, "shared": false, "purposes": ["Analytics"]}, {"type": "Email address", "purposes": ["Analytics"], "note": 1}]}';
  const report = await check({ [MAIN]: manifest([]), 'data-safety.json': text });
  assert.equal(find(report, 'duplicate-type').length, 1);
  assert.match(find(report, 'duplicate-type')[0].message, /Name is declared twice \(first at line 1\)/);
  assert.equal(find(report, 'malformed-entry').length, 3);
});

test('permission-undeclared: a permission that Google ties to a data type, and the answers leave out, is a warning at its manifest line', async () => {
  const report = await check({ [MAIN]: manifest([perm('INTERNET'), perm('ACCESS_COARSE_LOCATION')]), 'data-safety.json': answers([]) });
  assert.deepEqual(ids(report), ['permission-undeclared']);
  const f = report.findings[0];
  assert.equal(f.severity, 'warning');
  assert.equal(f.file, MAIN);
  assert.equal(f.line, 5);
  assert.equal(f.subject, perm('ACCESS_COARSE_LOCATION'));
  assert.match(f.message, /points at Approximate location/);
  assert.equal(report.gate.pass, true);
});

test('permission-review: a capability permission is a review finding, never an error, and never fails the gate', async () => {
  const files = { [MAIN]: manifest([perm('CAMERA'), perm('RECORD_AUDIO')]), 'data-safety.json': answers([]) };
  const report = await check(files, { failOn: 'warning' });
  assert.deepEqual(ids(report), ['permission-review', 'permission-review']);
  assert.deepEqual(report.findings.map((f) => f.severity), ['review', 'review']);
  assert.match(report.findings[0].message, /CAMERA can mean Photos or Videos/);
  assert.deepEqual(report.counts, { error: 0, warning: 0, review: 2 });
  assert.equal(report.gate.pass, true);
});

test('permission-review: any one of the mapped data types answers it, collected or not', async () => {
  const none = answers([['Videos', false, false, null]]);
  const some = answers([['Photos', true, false, ['App functionality']]]);
  for (const text of [none, some]) {
    const report = await check({ [MAIN]: manifest([perm('CAMERA')]), 'data-safety.json': text });
    assert.deepEqual(report.findings, []);
  }
});

test('declared-not-collected: a direct permission with its data type declared neither collected nor shared is a warning', async () => {
  const report = await check({ [MAIN]: manifest([perm('READ_CONTACTS'), perm('CAMERA')]), 'data-safety.json': answers([['Contacts', false, false, null], ['Photos', false, false, null]]) });
  assert.deepEqual(ids(report), ['declared-not-collected']);
  assert.equal(report.findings[0].subject, perm('READ_CONTACTS'));
  assert.match(report.findings[0].message, /Contacts is neither collected nor shared \(line 4\)/);
});

test('tools:node="remove" drops the permission: a removed permission is not compared with the answers', async () => {
  const report = await check({
    [MAIN]: manifest([[perm('ACCESS_FINE_LOCATION'), 'tools:node="remove"'], perm('INTERNET')]),
    'lib/src/main/AndroidManifest.xml': manifest([perm('ACCESS_FINE_LOCATION')]),
    'data-safety.json': answers([])
  });
  assert.deepEqual(report.findings, []);
  assert.deepEqual(report.permissions.map((p) => p.name), [perm('INTERNET')]);
  assert.deepEqual(report.removed.map((r) => [r.name, r.file, r.line]), [[perm('ACCESS_FINE_LOCATION'), MAIN, 4]]);
  assert.ok(report.notes.some((n) => n.startsWith('lib/src/main/AndroidManifest.xml:4: android.permission.ACCESS_FINE_LOCATION is removed')));
});

test('a removal in a flavour manifest does not hide the permission of the main manifest', async () => {
  const report = await check({
    [MAIN]: manifest([perm('ACCESS_FINE_LOCATION')]),
    'app/src/free/AndroidManifest.xml': manifest([[perm('ACCESS_FINE_LOCATION'), 'tools:node="remove"']]),
    'data-safety.json': answers([])
  });
  assert.deepEqual(ids(report), ['permission-undeclared']);
});

test('manifests of test source sets are left out, flavours and build types are read', async () => {
  const report = await check({
    [MAIN]: manifest([]),
    'app/src/androidTest/AndroidManifest.xml': manifest([perm('READ_CONTACTS')]),
    'app/src/debug/AndroidManifest.xml': manifest([perm('READ_CALENDAR')]),
    'data-safety.json': answers([])
  });
  assert.deepEqual(report.manifests.map((m) => [m.file, m.kind]), [['app/src/debug/AndroidManifest.xml', 'variant'], [MAIN, 'main']]);
  assert.deepEqual(report.findings.map((f) => f.subject), [perm('READ_CALENDAR')]);
  assert.ok(report.notes.some((n) => n.includes('1 manifest of test source sets left out')));
});

test('one finding per permission, at the first declaration in path order, however many manifests declare it', async () => {
  const report = await check({
    [MAIN]: manifest([perm('READ_SMS')]),
    'app/src/paid/AndroidManifest.xml': manifest([perm('READ_SMS')]),
    'data-safety.json': answers([])
  });
  assert.equal(report.findings.length, 1);
  assert.equal(report.findings[0].file, MAIN);
  assert.equal(report.permissions[0].files, 2);
});

test('permission names are compared exactly, letter case included, and uses-permission-sdk-23 counts', async () => {
  const lower = await check({ [MAIN]: manifest([perm('camera'), 'ACCESS_FINE_LOCATION']), 'data-safety.json': answers([]) });
  assert.deepEqual(lower.findings, []);
  assert.ok(lower.notes.some((n) => n.startsWith('2 permissions with no entry')));
  const sdk23 = await check({ [MAIN]: manifest([perm('READ_SMS')], { element: 'uses-permission-sdk-23' }), 'data-safety.json': answers([]) });
  assert.deepEqual(ids(sdk23), ['permission-undeclared']);
});

test('parse-error: an unreadable manifest is an error with its line, and the others are still checked', async () => {
  const report = await check({
    [MAIN]: manifest([perm('READ_SMS')]),
    'lib/src/main/AndroidManifest.xml': '<manifest>\n<uses-permission\n</manifest>',
    'other/AndroidManifest.xml': '<!DOCTYPE manifest [<!ENTITY a "b">]><manifest/>',
    'data-safety.json': answers([])
  });
  assert.deepEqual(ids(report), ['parse-error', 'parse-error', 'permission-undeclared']);
  assert.equal(report.findings[0].file, 'lib/src/main/AndroidManifest.xml');
  assert.equal(report.findings[0].line, 3);
  assert.match(report.findings[1].message, /DOCTYPE declaration is refused/);
  assert.equal(report.manifests.filter((m) => !m.readable).length, 2);
});

test('parse-error: a manifest over the size limit is refused, not read', async () => {
  const report = await check({ [MAIN]: manifest([perm('READ_SMS')]), 'data-safety.json': answers([]) }, { limits: { maxFileBytes: 100, maxFiles: 1000, maxDepth: 64 } });
  assert.ok(ids(report).includes('parse-error'));
  assert.match(find(report, 'parse-error')[0].message, /over the 0 MB limit|bytes is over/);
});

test('sdk-undeclared: a well-known SDK points at the data types of its vendor page, one finding per data type', async () => {
  const report = await check({ 'app/build.gradle.kts': GRADLE_ANALYTICS, [MAIN]: manifest([]), 'data-safety.json': answers([['App interactions', true, false, ['Analytics']]]) });
  assert.deepEqual(find(report, 'sdk-undeclared').map((f) => f.subject), [
    'Google Analytics for Firebase - Approximate location',
    'Google Analytics for Firebase - Device or other IDs',
    'Google Analytics for Firebase - Purchase history'
  ]);
});

test('sdk-undeclared: nothing is reported when every data type of the SDK is declared as collected', async () => {
  const entries = ['Device or other IDs', 'Approximate location', 'Purchase history', 'App interactions'].map((t) => [t, true, false, ['Analytics']]);
  const report = await check({ 'app/build.gradle.kts': GRADLE_ANALYTICS, [MAIN]: manifest([]), 'data-safety.json': answers(entries) });
  assert.deepEqual(report.findings, []);
});

test('declared-not-collected: an SDK whose data type the answers call not collected is a warning at the Gradle line', async () => {
  const entries = ['Device or other IDs', 'Approximate location', 'Purchase history'].map((t) => [t, true, false, ['Analytics']]).concat([['App interactions', false, false, null]]);
  const report = await check({ 'app/build.gradle.kts': GRADLE_ANALYTICS, [MAIN]: manifest([]), 'data-safety.json': answers(entries) });
  assert.deepEqual(ids(report), ['declared-not-collected']);
  assert.equal(report.findings[0].file, 'app/build.gradle.kts');
});

test('SDKs are found from a version catalog, from the map form, and not from a test configuration or a comment', async () => {
  const gradle = [
    '// implementation("com.google.android.gms:play-services-ads:1")',
    'dependencies {',
    '    implementation(libs.maps)',
    "    implementation group: 'com.google.firebase', name: 'firebase-crashlytics', version: '1'",
    '    testImplementation("com.google.firebase:firebase-auth:1")',
    '}'
  ].join('\n');
  const report = await check({
    'app/build.gradle': gradle,
    'gradle/libs.versions.toml': '[libraries]\nmaps = "com.google.android.gms:play-services-maps:19.0.0"\n',
    'data-safety.json': answers([])
  });
  assert.deepEqual(report.sdks.map((s) => s.id), ['firebase-crashlytics', 'maps-sdk-android']);
  assert.equal(report.scanned.catalogs, 1);
  assert.equal(find(report, 'sdk-undeclared').length, 4);
});

test('build and generated folders are left out with a note, and read with includeGenerated', async () => {
  const files = { [MAIN]: manifest([]), 'app/build/outputs/AndroidManifest.xml': manifest([perm('READ_SMS')]), 'data-safety.json': answers([]) };
  const left = await check(files);
  assert.deepEqual(left.findings, []);
  assert.ok(left.notes.some((n) => n.includes('left out 1 kind of folder (build); use --include-generated')));
  const read = await check(files, { includeGenerated: true });
  assert.deepEqual(ids(read), ['permission-undeclared']);
});

test('notes say what could not be done: no manifest and no build file', async () => {
  const report = await check({ 'data-safety.json': answers([]) });
  assert.deepEqual(report.findings, []);
  assert.ok(report.notes.includes('no AndroidManifest.xml was found in the folder'));
  assert.ok(report.notes.includes('no build.gradle or build.gradle.kts was found, so no SDK was looked for'));
});

test('findings are sorted errors first, then warnings, then review, and the same every time', async () => {
  const files = {
    [MAIN]: manifest([perm('CAMERA'), perm('READ_SMS')]),
    'app/build.gradle': GRADLE_ANALYTICS,
    'data-safety.json': answers([['Name', true, false, []]])
  };
  const a = await check(files);
  const b = await check(files);
  assert.deepEqual(a, b);
  const severities = a.findings.map((f) => f.severity);
  assert.deepEqual(severities, [...severities].sort((x, y) => ['error', 'warning', 'review'].indexOf(x) - ['error', 'warning', 'review'].indexOf(y)));
  assert.deepEqual(a.counts, { error: 1, warning: 5, review: 1 });
});

test('--fail-on warning fails on a warning and not on a review; the default fails on an error only', async () => {
  const files = { [MAIN]: manifest([perm('READ_SMS')]), 'data-safety.json': answers([]) };
  assert.equal((await check(files)).gate.pass, true);
  const strict = await check(files, { failOn: 'warning' });
  assert.equal(strict.gate.pass, false);
  assert.equal(strict.gate.reason, '1 warning');
});

test('paths in a report are relative, with forward slashes, and a project outside the base shows its absolute path', async () => {
  const report = await check({ 'a/b/c/src/main/AndroidManifest.xml': manifest([perm('READ_SMS')]), 'data-safety.json': answers([]) });
  assert.equal(report.findings[0].file, 'a/b/c/src/main/AndroidManifest.xml');
  assert.ok(!report.findings[0].file.includes('\\'));
  const outside = await withFiles({ [MAIN]: manifest([]), 'data-safety.json': answers([]) }, (dir) => checkProject(dir, { base: resolve(dir, 'app') }));
  assert.ok(outside.folder.startsWith('..') || outside.folder.includes('/') || outside.folder.includes(':'));
});

test('checkProject refuses a missing folder and a file given as the folder', async () => {
  await assert.rejects(() => checkProject('/no/such/folder/for/the/check'), /no such folder/);
  await withFiles({ 'x.txt': 'x' }, async (dir) => {
    await assert.rejects(() => checkProject(resolve(dir, 'x.txt')), /a file, not a folder/);
  });
});

test('scanFolder lists files in path order, does not follow links and stops at its limits', async () => {
  await withFiles({ 'b/src/main/AndroidManifest.xml': '<manifest/>', 'a/src/main/AndroidManifest.xml': '<manifest/>', 'a/build.gradle': '', 'gradle/libs.versions.toml': '', 'other/libs.versions.toml': '', 'x/y/z/AndroidManifest.xml': '<manifest/>' }, async (dir) => {
    const found = await scanFolder(dir);
    const rel = (list) => list.map((p) => p.slice(dir.length + 1).split('\\').join('/'));
    assert.deepEqual(rel(found.manifests), ['a/src/main/AndroidManifest.xml', 'b/src/main/AndroidManifest.xml', 'x/y/z/AndroidManifest.xml']);
    assert.deepEqual(rel(found.builds), ['a/build.gradle']);
    assert.deepEqual(rel(found.catalogs), ['gradle/libs.versions.toml']);
    const few = await scanFolder(dir, { limits: { maxFileBytes: 10, maxFiles: 2, maxDepth: 64 } });
    assert.equal(few.truncated, true);
    const shallow = await scanFolder(dir, { limits: { maxFileBytes: 10, maxFiles: 1000, maxDepth: 1 } });
    assert.ok(shallow.tooDeep > 0);
  });
});

test('readBounded refuses a folder, a missing file and a file over the limit', async () => {
  await withFiles({ 'f.txt': 'hello', 'd/x': '' }, async (dir) => {
    assert.equal((await readBounded(resolve(dir, 'f.txt'))).toString(), 'hello');
    await assert.rejects(() => readBounded(resolve(dir, 'd')), (e) => e.reason === 'a folder, not a file' || /not a regular file|cannot be read/.test(e.reason));
    await assert.rejects(() => readBounded(resolve(dir, 'none')), (e) => e.reason === 'no such file');
    await writeFile(resolve(dir, 'big'), 'x'.repeat(50));
    await assert.rejects(() => readBounded(resolve(dir, 'big'), { maxFileBytes: 10 }), /over the/);
  });
});
