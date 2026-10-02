// Reads the Data safety answers file (data-safety.json, described in docs/data-safety-answers.md) into a model:
//   { entries: [{ index, line, type, collected, shared, purposes }], issues: [{ line, subject, message }] }
// type is { value, line } or null; purposes is a list of { value, line }. A file that is not JSON, or whose top
// value is not an object with a "dataTypes" array, is refused with an error that names the line; everything
// else that is wrong with an entry becomes an issue and the read goes on. Names are kept as written: whether a
// type or a purpose is one Google lists is decided by the checks, not here.

import { parseJson, propOf } from './json.js';

const ENTRY_KEYS = ['type', 'collected', 'shared', 'purposes'];
const TOP_KEYS = ['dataTypes', '$schema'];

export function parseAnswers(text, label = 'answers') {
  const root = parseJson(text, label);
  if (root.t !== 'object') throw new Error(`${label}: line ${root.line}: the top value must be an object with a "dataTypes" array`);
  const list = propOf(root, 'dataTypes');
  if (!list) throw new Error(`${label}: line ${root.line}: the top object has no "dataTypes" array`);
  if (list.value.t !== 'array') throw new Error(`${label}: line ${list.line}: "dataTypes" must be an array`);

  const issues = [];
  const entries = [];
  for (const key of root.props) {
    if (!TOP_KEYS.includes(key.key)) issues.push({ line: key.line, subject: key.key, message: `the key "${key.key}" is not one of ${TOP_KEYS.join(', ')}; it is ignored` });
  }
  list.value.items.forEach((node, k) => {
    const index = k + 1;
    if (node.t !== 'object') {
      issues.push({ line: node.line, subject: `entry ${index}`, message: `entry ${index} of "dataTypes" is not an object` });
      return;
    }
    const entry = { index, line: node.line, type: null, collected: false, shared: false, purposes: [], hasPurposes: false };
    for (const p of node.props) {
      if (!ENTRY_KEYS.includes(p.key)) issues.push({ line: p.line, subject: p.key, message: `entry ${index} has the key "${p.key}", which is not one of ${ENTRY_KEYS.join(', ')}; it is ignored` });
    }
    const type = propOf(node, 'type');
    if (!type || type.value.t !== 'string') {
      issues.push({ line: type ? type.line : node.line, subject: `entry ${index}`, message: `entry ${index} has no "type" that is a string` });
    } else {
      entry.type = { value: type.value.value, line: type.line };
    }
    for (const flag of ['collected', 'shared']) {
      const p = propOf(node, flag);
      if (!p || p.value.t !== 'boolean') {
        issues.push({ line: p ? p.line : node.line, subject: entry.type ? entry.type.value : `entry ${index}`, message: `entry ${index} has no "${flag}" that is true or false; it is read as false` });
      } else {
        entry[flag] = p.value.value;
      }
    }
    const purposes = propOf(node, 'purposes');
    if (purposes) {
      if (purposes.value.t !== 'array') {
        issues.push({ line: purposes.line, subject: entry.type ? entry.type.value : `entry ${index}`, message: `entry ${index} has "purposes" that is not an array of strings` });
      } else {
        entry.hasPurposes = true;
        for (const item of purposes.value.items) {
          if (item.t !== 'string') {
            issues.push({ line: item.line, subject: entry.type ? entry.type.value : `entry ${index}`, message: `entry ${index} has a purpose that is not a string` });
          } else {
            entry.purposes.push({ value: item.value, line: item.line });
          }
        }
      }
    }
    entries.push(entry);
  });
  return { entries, issues, line: list.line };
}
