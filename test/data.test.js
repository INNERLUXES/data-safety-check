import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { CATEGORIES, DATA_TYPES, PERMISSIONS, PERMISSION_PREFIX, PURPOSES, SDKS, SOURCES, categoryOf, isDataType, isPurpose, permissionByName, sdkByCoordinate } from '../src/index.js';

const source = async (name) => readFile(new URL(`../research/sources/${name}.txt`, import.meta.url), 'utf8');
// Text compared without line breaks, runs of white space or the typographic apostrophe.
const flat = (t) => t.replace(/\u2019/g, "'").replace(/\s+/g, ' ').toLowerCase();

// The "### kind NAME" blocks of a saved page: [{ name, text }].
function blocks(text, kind) {
  const out = [];
  let current = null;
  for (const line of text.split('\n')) {
    const m = new RegExp(`^### ${kind} (.+)$`).exec(line);
    if (m) {
      current = { name: m[1], text: '' };
      out.push(current);
    } else if (line.startsWith('#')) {
      current = null;
    } else if (current) {
      current.text += `${line}\n`;
    }
  }
  return out;
}

test('data: the categories and data types are those of the saved Data safety page, in the same order', async () => {
  const page = await source('data-safety-section');
  assert.deepEqual(blocks(page, 'category').map((b) => b.name), CATEGORIES.map((c) => c.name));
  assert.deepEqual(blocks(page, 'data type').map((b) => b.name), DATA_TYPES);
  assert.equal(DATA_TYPES.length, 38);
  // each data type sits under its own category on the page
  let category = '';
  for (const line of page.split('\n')) {
    const c = /^### category (.+)$/.exec(line);
    const t = /^### data type (.+)$/.exec(line);
    if (c) category = c[1];
    if (t) assert.equal(categoryOf(t[1]), category, t[1]);
  }
});

test('data: the purposes are those of the saved Data safety page', async () => {
  assert.deepEqual(blocks(await source('data-safety-section'), 'purpose').map((b) => b.name), PURPOSES);
  assert.equal(PURPOSES.length, 7);
});

test('data: every permission of the table is on the saved Android reference page with its constant value', async () => {
  const page = blocks(await source('manifest-permission'), 'permission');
  assert.deepEqual(page.map((b) => b.name).sort(), PERMISSIONS.map((p) => p.permission).sort());
  for (const p of PERMISSIONS) {
    const block = page.find((b) => b.name === p.permission);
    assert.ok(block.text.includes(`"${PERMISSION_PREFIX}${p.permission}"`), p.permission);
    assert.ok(flat(block.text).includes(flat(p.android)), `${p.permission}: "${p.android}" is not in the Android text`);
  }
});

test('data: every mapping points at data types Google lists, and its phrase is in Google\'s description of them', async () => {
  const descriptions = new Map(blocks(await source('data-safety-section'), 'data type').map((b) => [b.name, flat(b.text)]));
  for (const p of PERMISSIONS) {
    assert.ok(['direct', 'review'].includes(p.level), p.permission);
    assert.ok(p.types.length >= 1);
    for (const t of p.types) assert.ok(isDataType(t), `${p.permission}: ${t}`);
    assert.ok(p.types.some((t) => descriptions.get(t).includes(flat(p.page))), `${p.permission}: "${p.page}" is not in the description of ${p.types.join(' or ')}`);
  }
});

test('data: a permission mapped as direct is one the Android text says reads the data, or that Google names', () => {
  const direct = PERMISSIONS.filter((p) => p.level === 'direct').map((p) => p.permission).sort();
  assert.deepEqual(direct, ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION', 'READ_CALENDAR', 'READ_CALL_LOG', 'READ_CONTACTS', 'READ_SMS', 'RECEIVE_SMS']);
  const camera = permissionByName('android.permission.CAMERA');
  assert.equal(camera.level, 'review');
});

test('data: every SDK of the table has its coordinates and its vendor labels in the saved vendor page', async () => {
  const descriptions = new Map(blocks(await source('data-safety-section'), 'data type').map((b) => [b.name, flat(b.text)]));
  assert.ok(SDKS.length >= 4);
  for (const sdk of SDKS) {
    const listed = flat(await source(sdk.listedIn));
    const vendorPage = flat(await source(sdk.source));
    for (const c of sdk.coordinates) assert.ok(listed.includes(c.toLowerCase()), `${sdk.id}: ${c} is not in ${sdk.listedIn}`);
    for (const t of sdk.types) {
      assert.ok(isDataType(t.type), `${sdk.id}: ${t.type}`);
      assert.ok(['automatic', 'usage'].includes(t.when));
      for (const label of t.vendor) assert.ok(vendorPage.includes(flat(label)), `${sdk.id}: "${label}" is not on the vendor page`);
      assert.ok(descriptions.get(t.type).includes(flat(t.page)), `${sdk.id}: "${t.page}" is not in the description of ${t.type}`);
    }
  }
});

test('data: every source page named in the data is saved, with its address on the first line', async () => {
  const files = await readdir(new URL('../research/sources/', import.meta.url));
  assert.equal(files.length, SOURCES.length);
  for (const s of SOURCES) {
    assert.ok(files.includes(`${s.file}.txt`), `${s.file}.txt is not saved`);
    assert.ok((await source(s.file)).startsWith(`Source: ${s.url}\n`), s.file);
  }
});

test('data: the saved pages hold no date or year', async () => {
  for (const file of await readdir(new URL('../research/sources/', import.meta.url))) {
    assert.doesNotMatch(await source(file.replace(/\.txt$/, '')), /\b(?:19|20)\d\d\b/, file);
  }
});

test('data: names are looked up exactly, and never by a prototype name', () => {
  assert.equal(isDataType('Precise location'), true);
  assert.equal(isDataType('precise location'), false);
  assert.equal(isDataType('__proto__'), false);
  assert.equal(isDataType('constructor'), false);
  assert.equal(isPurpose('Analytics'), true);
  assert.equal(isPurpose('analytics'), false);
  assert.equal(permissionByName('android.permission.CAMERA').permission, 'CAMERA');
  assert.equal(permissionByName('android.permission.camera'), null);
  assert.equal(permissionByName('CAMERA'), null);
  assert.equal(permissionByName('__proto__'), null);
  assert.equal(sdkByCoordinate('com.google.firebase:firebase-analytics').id, 'firebase-analytics');
  assert.equal(sdkByCoordinate('com.google.firebase:Firebase-Analytics'), null);
  assert.equal(sdkByCoordinate('constructor'), null);
});
