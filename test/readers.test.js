import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseXml, decodeEntities, parseJson, parseAnswers, parseManifest, parseCatalog, maskComments, findCoordinates, isTestConfig, classifyManifest, resolvePermissions } from '../src/index.js';
import { manifest, answers, perm } from './helpers.js';

// ---- XML

test('xml: elements, attributes with a namespace prefix and the line of every element', () => {
  const root = parseXml('<a x:b="1"\n  c=\'2\'>\n  <b/>\n  <c>text &amp; more</c>\n</a>');
  assert.equal(root.name, 'a');
  assert.equal(root.attrs['x:b'], '1');
  assert.equal(root.attrs.c, '2');
  assert.deepEqual(root.children.map((c) => [c.name, c.line]), [['b', 3], ['c', 4]]);
  assert.equal(root.children[1].text, 'text & more');
});

test('xml: a DOCTYPE or an ENTITY declaration is refused before anything in it is read', () => {
  const bomb = '<?xml version="1.0"?>\n<!DOCTYPE manifest [<!ENTITY a "aaaa"><!ENTITY b "&a;&a;&a;&a;">]>\n<manifest>&b;</manifest>';
  assert.throws(() => parseXml(bomb, 'manifest'), /manifest: line 2: a DOCTYPE declaration is refused/);
  assert.throws(() => parseXml('<!ENTITY x "y"><a/>'), /an ENTITY declaration is refused/);
  assert.throws(() => decodeEntities('&custom;'), /not one of lt, gt, amp, quot, apos/);
  assert.equal(decodeEntities('&lt;&#65;&#x42;&gt;'), '<AB>');
});

test('xml: malformed input is refused with a line, and depth and size limits hold', () => {
  assert.throws(() => parseXml('<a>\n<b></a>'), /line 2: <\/a> does not close <b>/);
  assert.throws(() => parseXml('<a/><b/>'), /a second root element/);
  assert.throws(() => parseXml('<a x="1" x="2"/>'), /appears twice/);
  assert.throws(() => parseXml('<a>'.repeat(70) + '</a>'.repeat(70)), /nested more than 64 deep/);
  assert.throws(() => parseXml('<a><b/><b/></a>', 'x', { limits: { maxDepth: 64, maxElements: 2 } }), /more than 2 elements/);
  assert.throws(() => parseXml(''), /no root element/);
});

// ---- JSON

test('json: keeps the line of every value and reads every JSON type', () => {
  const root = parseJson('{\n  "a": [1, true, null],\n  "b": "x\\u0041\\n"\n}');
  assert.equal(root.t, 'object');
  assert.deepEqual(root.props.map((p) => [p.key, p.line]), [['a', 2], ['b', 3]]);
  assert.deepEqual(root.props[0].value.items.map((i) => i.t), ['number', 'boolean', 'null']);
  assert.equal(root.props[1].value.value, 'xA\n');
});

test('json: refuses what JSON does not allow, with the line', () => {
  assert.throws(() => parseJson('{"a": 1,}', 'answers'), /answers: line 1: a key in quotes is expected/);
  assert.throws(() => parseJson('[1, 2,]'), /an unexpected character "\]"/);
  assert.throws(() => parseJson("{'a': 1}"), /a key in quotes is expected/);
  assert.throws(() => parseJson('{"a": 1}\n// comment'), /text after the end of the value/);
  assert.throws(() => parseJson('{\n"a": 1,\n"a": 2}'), /line 3: the key "a" appears twice/);
  assert.throws(() => parseJson('"a\nb"'), /control character inside a string/);
  assert.throws(() => parseJson('[' .repeat(70) + ']'.repeat(70)), /nested more than 64 deep/);
  assert.throws(() => parseJson('[1,2,3]', 'x', { limits: { maxDepth: 64, maxNodes: 2 } }), /more than 2 values/);
  assert.throws(() => parseJson(''), /a value is missing/);
});

test('json: a key named __proto__ is data, kept in a list, and changes nothing', () => {
  const root = parseJson('{"__proto__": {"polluted": true}, "constructor": 1}');
  assert.deepEqual(root.props.map((p) => p.key), ['__proto__', 'constructor']);
  assert.equal({}.polluted, undefined);
});

// ---- answers file

test('answers: reads entries with their lines, flags and purposes', () => {
  const model = parseAnswers(answers([['Precise location', true, false, ['App functionality', 'Analytics']], ['Contacts', false, false, null]]));
  assert.equal(model.entries.length, 2);
  const [first, second] = model.entries;
  assert.equal(first.type.value, 'Precise location');
  assert.equal(first.collected, true);
  assert.deepEqual(first.purposes.map((p) => p.value), ['App functionality', 'Analytics']);
  assert.equal(second.hasPurposes, false);
  assert.deepEqual(model.issues, []);
  assert.ok(second.line > first.line);
});

test('answers: a file that is not an object with a dataTypes array is refused', () => {
  assert.throws(() => parseAnswers('[]'), /top value must be an object/);
  assert.throws(() => parseAnswers('{}'), /no "dataTypes" array/);
  assert.throws(() => parseAnswers('{"dataTypes": {}}'), /"dataTypes" must be an array/);
  assert.throws(() => parseAnswers('{"dataTypes": [}'), /line 1/);
});

test('answers: a wrong entry becomes an issue and the read goes on', () => {
  const model = parseAnswers('{"dataTypes": [1, {"type": 5}, {"type": "Name", "collected": "yes", "purposes": "x", "extra": 1}, {"type": "Name", "collected": true, "shared": false, "purposes": [3, "Analytics"]}], "other": 1}');
  const messages = model.issues.map((i) => i.message).join('\n');
  assert.match(messages, /entry 1 of "dataTypes" is not an object/);
  assert.match(messages, /entry 2 has no "type" that is a string/);
  assert.match(messages, /entry 3 has no "collected" that is true or false/);
  assert.match(messages, /entry 3 has "purposes" that is not an array/);
  assert.match(messages, /entry 3 has the key "extra"/);
  assert.match(messages, /entry 4 has a purpose that is not a string/);
  assert.match(messages, /the key "other" is not one of/);
  assert.equal(model.entries.length, 3);
  assert.deepEqual(model.entries[2].purposes.map((p) => p.value), ['Analytics']);
});

// ---- AndroidManifest.xml

test('manifest: reads uses-permission and uses-permission-sdk-23 with their lines', () => {
  const text = manifest([perm('CAMERA'), perm('ACCESS_FINE_LOCATION')]).replace('<application', '<uses-permission-sdk-23 android:name="android.permission.READ_CONTACTS" />\n    <application');
  const { permissions, issues } = parseManifest(text);
  assert.deepEqual(permissions.map((p) => [p.name, p.line, p.removed]), [[perm('CAMERA'), 4, false], [perm('ACCESS_FINE_LOCATION'), 5, false], [perm('READ_CONTACTS'), 6, false]]);
  assert.deepEqual(issues, []);
});

test('manifest: tools:node="remove" marks a removal, other values do not', () => {
  const { permissions } = parseManifest(manifest([[perm('CAMERA'), 'tools:node="remove"'], [perm('RECORD_AUDIO'), 'tools:node="merge"'], [perm('READ_SMS'), 'tools:node="removeAll"']]));
  assert.deepEqual(permissions.map((p) => p.removed), [true, false, false]);
});

test('manifest: the prefixes come from the xmlns declarations of the root', () => {
  const text = '<manifest xmlns:a="http://schemas.android.com/apk/res/android" xmlns:t="http://schemas.android.com/tools">\n<uses-permission a:name="android.permission.CAMERA" t:node="remove"/>\n<uses-permission android:name="android.permission.READ_SMS"/>\n</manifest>';
  const { permissions, issues } = parseManifest(text);
  assert.deepEqual(permissions.map((p) => [p.name, p.removed]), [['android.permission.CAMERA', true]]);
  assert.equal(issues.length, 1);
  assert.match(issues[0].message, /has no a:name/);
});

test('manifest: a root that is not manifest, a missing name and nested elements', () => {
  assert.throws(() => parseManifest('<resources/>'), /the root element is <resources>, not <manifest>/);
  const { permissions, issues } = parseManifest('<manifest xmlns:android="http://schemas.android.com/apk/res/android"><uses-permission/><application><uses-permission android:name="android.permission.CAMERA"/></application></manifest>');
  assert.deepEqual(permissions, []);
  assert.equal(issues[0].line, 1);
});

// ---- source sets and removals

test('merge: the module and the source set come from the path, and test source sets are told apart', () => {
  assert.deepEqual(classifyManifest('app/src/main/AndroidManifest.xml'), { module: 'app', set: 'main', kind: 'main' });
  assert.deepEqual(classifyManifest('app/src/paid/AndroidManifest.xml'), { module: 'app', set: 'paid', kind: 'variant' });
  assert.deepEqual(classifyManifest('app/src/debug/AndroidManifest.xml'), { module: 'app', set: 'debug', kind: 'variant' });
  assert.equal(classifyManifest('app/src/androidTest/AndroidManifest.xml').kind, 'test');
  assert.equal(classifyManifest('app/src/testDebug/AndroidManifest.xml').kind, 'test');
  assert.equal(classifyManifest('app/src/testing/AndroidManifest.xml').kind, 'variant');
  assert.deepEqual(classifyManifest('AndroidManifest.xml'), { module: '', set: 'main', kind: 'main' });
  assert.deepEqual(classifyManifest('legacy/AndroidManifest.xml'), { module: 'legacy', set: 'main', kind: 'main' });
});

test('merge: a removal drops the declaration in its own file and, from a main manifest, those of other modules only', () => {
  const d = (file, module, kind, name = 'p') => ({ name, file, line: 1, module, kind });
  const same = resolvePermissions([d('a/main', 'a', 'main')], [d('a/main', 'a', 'main')]);
  assert.equal(same.kept.length, 0);
  const library = resolvePermissions([d('lib/main', 'lib', 'main')], [d('a/main', 'a', 'main')]);
  assert.equal(library.dropped.length, 1);
  const flavour = resolvePermissions([d('a/main', 'a', 'main')], [d('a/free', 'a', 'variant')]);
  assert.equal(flavour.kept.length, 1);
  const own = resolvePermissions([d('a/paid', 'a', 'variant')], [d('a/main', 'a', 'main')]);
  assert.equal(own.kept.length, 1);
  const other = resolvePermissions([d('a/main', 'a', 'main', 'q')], [d('a/main', 'a', 'main')]);
  assert.equal(other.kept.length, 1);
});

// ---- Gradle and the version catalog

test('gradle: comments are blanked without moving a line, strings are left alone', () => {
  const text = 'a // "x:y"\n/* "c:d"\n */ b "https://example.test/x" // end\n';
  const masked = maskComments(text);
  assert.equal(masked.length, text.length);
  assert.equal(masked.split('\n').length, text.split('\n').length);
  assert.ok(!masked.includes('x:y') && !masked.includes('c:d'));
  assert.ok(masked.includes('"https://example.test/x"'));
});

test('gradle: finds coordinates written as strings (Kotlin and Groovy) and as maps, with their lines', () => {
  const text = [
    'dependencies {',
    '    implementation("com.google.firebase:firebase-analytics:22.0.0")',
    "    implementation 'com.google.firebase:firebase-auth'",
    "    api group: 'com.google.android.gms', name: 'play-services-maps', version: '19.0.0'",
    '    implementation(group = "com.google.firebase", name = "firebase-crashlytics")',
    '}'
  ].join('\n');
  const found = findCoordinates(text).map((c) => `${c.group}:${c.artifact}@${c.line}`);
  assert.deepEqual(found, [
    'com.google.firebase:firebase-analytics@2',
    'com.google.firebase:firebase-auth@3',
    'com.google.android.gms:play-services-maps@4',
    'com.google.firebase:firebase-crashlytics@5'
  ]);
});

test('gradle: a coordinate in a comment, and in a test configuration, is not a dependency of the app', () => {
  const text = [
    '// implementation("com.google.firebase:firebase-analytics:1")',
    '/* implementation("com.google.firebase:firebase-auth:1") */',
    'testImplementation("com.google.firebase:firebase-crashlytics:1")',
    'androidTestImplementation("com.google.android.gms:play-services-maps:1")',
    'debugImplementation("com.google.android.gms:play-services-ads:1")'
  ].join('\n');
  assert.deepEqual(findCoordinates(text).map((c) => c.artifact), ['play-services-ads']);
  assert.equal(isTestConfig('testImplementation'), true);
  assert.equal(isTestConfig('androidTestImplementation'), true);
  assert.equal(isTestConfig('testing'), false);
  assert.equal(isTestConfig('implementation'), false);
});

test('catalog: reads the string, module and group/name forms of [libraries] and nothing else', () => {
  const text = [
    '[versions]',
    'fb = "1.0"',
    '[libraries]',
    '# a comment',
    'firebase-analytics = { module = "com.google.firebase:firebase-analytics", version.ref = "fb" }',
    'maps = "com.google.android.gms:play-services-maps:19.0.0"',
    'auth_ktx = { group = "com.google.firebase", name = "firebase-auth-ktx", version = "1" } # trailing',
    'broken = { version = "1" }',
    '[bundles]',
    'all = ["maps"]'
  ].join('\n');
  const libs = parseCatalog(text);
  assert.deepEqual(libs.map((l) => [l.accessor, `${l.group}:${l.artifact}`, l.line]), [
    ['firebase.analytics', 'com.google.firebase:firebase-analytics', 5],
    ['maps', 'com.google.android.gms:play-services-maps', 6],
    ['auth.ktx', 'com.google.firebase:firebase-auth-ktx', 7]
  ]);
});

test('gradle: libs.x.y references are looked up in the catalog, and versions and plugins are not libraries', () => {
  const catalog = parseCatalog('[libraries]\nfirebase-analytics = "com.google.firebase:firebase-analytics:1"\n');
  const text = 'implementation(libs.firebase.analytics)\nimplementation(libs.firebase.analytics.get())\nval v = libs.versions.firebase.get()\nid(libs.plugins.x.get().pluginId)\nimplementation(libs.other)\ntestImplementation(libs.firebase.analytics)\nfoo.libs.firebase.analytics\n';
  const found = findCoordinates(text, catalog);
  assert.deepEqual(found.map((c) => [c.artifact, c.line, c.via]), [['firebase-analytics', 1, 'catalog'], ['firebase-analytics', 2, 'catalog']]);
});
