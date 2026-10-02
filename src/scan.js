// Walks a project folder and lists the AndroidManifest.xml files, the Gradle build files and the version
// catalogs in it. Folder and file names are compared exactly, letter case included, on every system. Symbolic
// links are not followed, so a link cannot lead the walk out of the folder. The lists are sorted by path, so
// the same folder always gives the same list on every system.

import { readdir, open } from 'node:fs/promises';
import { basename, dirname, relative, resolve, sep } from 'node:path';
import { MANIFEST_NAME } from './data.js';

// Build output and tool folders, left out unless --include-generated is given. The merged manifests that Gradle
// writes below build would be counted twice.
export const SKIP_DIRS = ['build', '.gradle', '.git', '.idea', '.cxx', 'node_modules'];
export const BUILD_FILES = ['build.gradle', 'build.gradle.kts'];
export const CATALOG_NAME = 'libs.versions.toml';
export const LIMITS = { maxFileBytes: 10 * 1024 * 1024, maxFiles: 200_000, maxDepth: 64 };

function byName(a, b) {
  return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
}

// Returns { manifests, builds, catalogs, skippedDirs, links, unreadable, tooDeep, truncated }: absolute paths,
// and the names of the folders that were left out.
export async function scanFolder(root, { includeGenerated = false, limits = LIMITS } = {}) {
  const result = { manifests: [], builds: [], catalogs: [], skippedDirs: new Set(), links: 0, unreadable: [], tooDeep: 0, truncated: false };
  let seen = 0;
  const stack = [{ dir: resolve(root), depth: 0 }];
  while (stack.length) {
    const { dir, depth } = stack.pop();
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch (error) {
      result.unreadable.push({ path: dir, code: error.code ?? 'ERROR' });
      continue;
    }
    entries.sort(byName);
    const subdirs = [];
    for (const entry of entries) {
      if (seen >= limits.maxFiles) {
        result.truncated = true;
        break;
      }
      seen += 1;
      const full = resolve(dir, entry.name);
      if (entry.isSymbolicLink()) {
        result.links += 1;
      } else if (entry.isDirectory()) {
        if (!includeGenerated && SKIP_DIRS.includes(entry.name)) result.skippedDirs.add(entry.name);
        else if (depth + 1 > limits.maxDepth) result.tooDeep += 1;
        else subdirs.push({ dir: full, depth: depth + 1 });
      } else if (entry.isFile()) {
        if (entry.name === MANIFEST_NAME) result.manifests.push(full);
        else if (BUILD_FILES.includes(entry.name)) result.builds.push(full);
        else if (entry.name === CATALOG_NAME && basename(dirname(full)) === 'gradle') result.catalogs.push(full);
      }
    }
    // Depth first in name order: the stack takes the last pushed first, so push in reverse.
    for (let k = subdirs.length - 1; k >= 0; k -= 1) stack.push(subdirs[k]);
    if (result.truncated) break;
  }
  // The same order on every system: by the path below the folder, written with forward slashes.
  const key = (p) => (sep === '/' ? relative(resolve(root), p) : relative(resolve(root), p).split(sep).join('/'));
  const order = (a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0);
  result.manifests.sort(order);
  result.builds.sort(order);
  result.catalogs.sort(order);
  return result;
}

// An error with the path in its message and the reason alone in .reason, so a caller can show its own path.
function fileError(path, reason) {
  return Object.assign(new Error(`${path}: ${reason}`), { reason });
}

// Reads a whole file, refusing anything that is not a regular file or is over the size limit. The size is
// taken from the open file, so it cannot change between the check and the read.
export async function readBounded(path, limits = LIMITS) {
  let handle;
  try {
    handle = await open(resolve(path), 'r');
  } catch (error) {
    if (error.code === 'ENOENT') throw fileError(path, 'no such file');
    if (error.code === 'EISDIR') throw fileError(path, 'a folder, not a file');
    throw fileError(path, `cannot be read (${error.code ?? error.message})`);
  }
  try {
    const info = await handle.stat();
    if (!info.isFile()) throw fileError(path, 'not a regular file');
    if (info.size > limits.maxFileBytes) throw fileError(path, `${info.size.toLocaleString('en-US')} bytes is over the ${(limits.maxFileBytes / 1024 / 1024).toLocaleString('en-US')} MB limit`);
    const buffer = Buffer.alloc(info.size);
    let read = 0;
    while (read < info.size) {
      const { bytesRead } = await handle.read(buffer, read, info.size - read, read);
      if (bytesRead === 0) break;
      read += bytesRead;
    }
    return buffer.subarray(0, read);
  } finally {
    await handle.close();
  }
}
