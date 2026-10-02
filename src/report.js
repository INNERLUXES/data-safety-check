// Report formats: text for a terminal, Markdown for a pull request or job summary, JSON for other tools, CSV
// for a spreadsheet.

import { PERMISSION_PREFIX } from './data.js';

function plural(count, one, many = `${one}s`) {
  return `${count.toLocaleString('en-US')} ${count === 1 ? one : many}`;
}

function countsLine(c) {
  return `${c.error} error, ${c.warning} warning, ${c.review} review`;
}

function where(f) {
  return `${f.file}:${f.line}`;
}

function shortName(name) {
  return name.startsWith(PERMISSION_PREFIX) ? name.slice(PERMISSION_PREFIX.length) : name;
}

// The facts about one manifest, on one line.
export function manifestLine(m) {
  if (!m.readable) return 'could not be read';
  const parts = [plural(m.permissions, 'permission')];
  if (m.removals) parts.push(plural(m.removals, 'removal'));
  return parts.join(', ');
}

export function permissionLine(p) {
  const mapped = p.dataTypes.length ? `${p.dataTypes.join(' or ')} (${p.level})` : 'no data type in the table';
  return `${shortName(p.name)}: ${mapped}`;
}

export function sdkLine(s) {
  return `${s.name} (${s.coordinate})`;
}

function gateLine(r) {
  return r.gate.pass ? `GATE: PASS (--fail-on ${r.gate.failOn})` : `GATE: FAIL - ${r.gate.reason}`;
}

function answersLine(r) {
  return r.answers.readable ? `${r.answers.file}, ${plural(r.answers.dataTypes, 'data type')} declared` : `${r.answers.file}, not usable`;
}

export function toText(r) {
  const lines = [`data-safety-check: ${r.folder}`, `answers: ${answersLine(r)}`, `manifests: ${r.manifests.length}`];
  for (const m of r.manifests) lines.push(`  ${m.file}: ${manifestLine(m)}`);
  lines.push(`build files: ${r.scanned.builds} read, ${plural(r.scanned.catalogs, 'version catalog')}`);
  lines.push(`permissions in the app: ${r.permissions.length}`);
  for (const p of r.permissions) lines.push(`  ${permissionLine(p)}`);
  lines.push(`SDKs from the table: ${r.sdks.length}`);
  for (const s of r.sdks) lines.push(`  ${sdkLine(s)} at ${s.file}:${s.line}`);
  lines.push(`findings: ${countsLine(r.counts)}`);
  if (!r.findings.length) lines.push('', 'no findings');
  for (const f of r.findings) {
    lines.push('', `${f.severity.toUpperCase().padEnd(7)}  ${f.id}  ${where(f)}`, `         ${f.message}`, `         fix: ${f.fix}`);
  }
  if (r.notes.length) lines.push('');
  for (const note of r.notes) lines.push(`note: ${note}`);
  lines.push('', gateLine(r));
  return lines.join('\n') + '\n';
}

// A Markdown table cell: backslashes and pipes escaped, line breaks flattened, and <, > and & written as
// entities, so text from an input file cannot break the table or be read as HTML.
export function mdCell(t) {
  return String(t)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n|\r/g, ' ');
}

export function toMarkdown(r) {
  const lines = [`## data-safety-check: ${countsLine(r.counts)}`, '', `Folder: \`${mdCell(r.folder).replace(/`/g, "'")}\`. Answers: ${mdCell(answersLine(r))}.`];
  if (r.manifests.length) {
    lines.push('', '| Manifest | Permissions |', '| --- | --- |');
    for (const m of r.manifests) lines.push(`| ${mdCell(m.file)} | ${mdCell(manifestLine(m))} |`);
  }
  if (r.permissions.length) {
    lines.push('', '| Permission | Data type | Level |', '| --- | --- | --- |');
    for (const p of r.permissions) lines.push(`| ${mdCell(shortName(p.name))} | ${mdCell(p.dataTypes.join(' or ') || '-')} | ${p.level ?? '-'} |`);
  }
  if (r.sdks.length) {
    lines.push('', '| SDK | Coordinate | Where |', '| --- | --- | --- |');
    for (const s of r.sdks) lines.push(`| ${mdCell(s.name)} | ${mdCell(s.coordinate)} | ${mdCell(`${s.file}:${s.line}`)} |`);
  }
  if (!r.findings.length) lines.push('', 'No findings.');
  else {
    lines.push('', '| Severity | Check | Where | Message | Fix |', '| --- | --- | --- | --- | --- |');
    for (const f of r.findings) lines.push(`| ${f.severity} | ${mdCell(f.id)} | ${mdCell(where(f))} | ${mdCell(f.message)} | ${mdCell(f.fix)} |`);
  }
  if (r.notes.length) lines.push('');
  for (const note of r.notes) lines.push(`- ${mdCell(note)}`);
  lines.push('', r.gate.pass ? `**Gate passed** (--fail-on ${r.gate.failOn}).` : `**Gate failed:** ${mdCell(r.gate.reason)}.`);
  return lines.join('\n') + '\n';
}

export function toJson(r) {
  return JSON.stringify(r, null, 2) + '\n';
}

// RFC 4180 quoting, and a leading quote on cells a spreadsheet would read as a formula.
export function csvCell(value) {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// One row per finding.
export function toCsv(r) {
  const rows = [['severity', 'id', 'file', 'line', 'subject', 'message', 'fix']];
  for (const f of r.findings) rows.push([f.severity, f.id, f.file, String(f.line), f.subject, f.message, f.fix]);
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
