// Shared test helpers: project folders, manifests, Gradle files and answers written inline into a temporary
// folder that is removed after the test.

import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { checkProject, main } from '../src/index.js';

export async function withFiles(files, fn) {
  const dir = await mkdtemp(resolve(tmpdir(), 'data-safety-check-'));
  try {
    for (const [rel, content] of Object.entries(files)) {
      await mkdir(dirname(resolve(dir, rel)), { recursive: true });
      await writeFile(resolve(dir, rel), content);
    }
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// An AndroidManifest.xml with the given permissions. Each item is a name, or [name, extra attributes].
export function manifest(permissions = [], { element = 'uses-permission' } = {}) {
  const lines = permissions.map((p) => {
    const [name, extra = ''] = Array.isArray(p) ? p : [p];
    return `    <${element} android:name="${name}"${extra ? ` ${extra}` : ''} />`;
  });
  return `<?xml version="1.0" encoding="utf-8"?>\n<manifest xmlns:android="http://schemas.android.com/apk/res/android"\n    xmlns:tools="http://schemas.android.com/tools">\n${lines.join('\n')}\n    <application android:label="Test" />\n</manifest>\n`;
}

export const perm = (name) => `android.permission.${name}`;

// An answers file. Each entry is [type, collected, shared, purposes]; purposes null leaves the key out.
export function answers(entries = []) {
  return JSON.stringify({
    dataTypes: entries.map(([type, collected, shared, purposes]) => {
      const e = { type, collected, shared };
      if (purposes !== null && purposes !== undefined) e.purposes = purposes;
      return e;
    })
  }, null, 2) + '\n';
}

export const GRADLE_ANALYTICS = 'dependencies {\n    implementation("com.google.firebase:firebase-analytics:22.0.0")\n}\n';

// Writes the files and checks the folder, with paths shown relative to it.
export async function check(files, options = {}, folder = '.') {
  return withFiles(files, (dir) => checkProject(resolve(dir, folder), { base: dir, ...options }));
}

// Writes the files and runs the command line on the folder (plus args), keeping what it writes.
export async function run(files, args = [], limits) {
  return withFiles(files, async (dir) => {
    let out = '';
    let err = '';
    const code = await main([dir, ...args], { out: (t) => { out += t; }, err: (t) => { err += t; } }, limits, dir);
    return { code, out, err };
  });
}

// Runs the command line with exactly these arguments.
export async function cli(argv) {
  let out = '';
  let err = '';
  const code = await main(argv, { out: (t) => { out += t; }, err: (t) => { err += t; } });
  return { code, out, err };
}

export const ids = (report) => report.findings.map((f) => f.id);
export const find = (report, id) => report.findings.filter((f) => f.id === id);
