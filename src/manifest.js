// Reads one AndroidManifest.xml and returns the permissions it declares or removes:
//   { permissions: [{ name, line, removed }], issues: [{ line, message }] }
// Only <uses-permission> and <uses-permission-sdk-23>, as direct children of <manifest>, are read. An element
// with tools:node="remove" is a removal (the Gradle manifest merger drops that permission); the prefixes of
// the android and tools namespaces are taken from the xmlns declarations on the root, and are "android" and
// "tools" when the root does not declare them. Any other value of tools:node, tools:selector and every other
// element are ignored.

import { parseXml } from './xml.js';

export const ANDROID_NS = 'http://schemas.android.com/apk/res/android';
export const TOOLS_NS = 'http://schemas.android.com/tools';
export const PERMISSION_ELEMENTS = ['uses-permission', 'uses-permission-sdk-23'];

function prefixOf(root, uri, fallback) {
  for (const [key, value] of Object.entries(root.attrs)) {
    if (key.startsWith('xmlns:') && value === uri) return key.slice('xmlns:'.length);
  }
  return fallback;
}

export function parseManifest(text, label = 'manifest') {
  const root = parseXml(text, label);
  if (root.name !== 'manifest') throw new Error(`${label}: line ${root.line}: the root element is <${root.name.slice(0, 40)}>, not <manifest>`);
  const android = prefixOf(root, ANDROID_NS, 'android');
  const tools = prefixOf(root, TOOLS_NS, 'tools');
  const permissions = [];
  const issues = [];
  for (const el of root.children) {
    if (!PERMISSION_ELEMENTS.includes(el.name)) continue;
    const name = el.attrs[`${android}:name`];
    if (name === undefined || name.trim() === '') {
      issues.push({ line: el.line, message: `<${el.name}> has no ${android}:name` });
      continue;
    }
    permissions.push({ name: name.trim(), line: el.line, removed: el.attrs[`${tools}:node`] === 'remove' });
  }
  return { permissions, issues };
}
