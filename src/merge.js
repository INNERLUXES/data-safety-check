// Which manifests belong to which module and source set, and which permissions are left after the removals.
// Paths are the ones shown in a report: relative to the project folder, with forward slashes.

const TEST_SET = /^(?:test|androidTest|testFixtures)(?:[A-Z]\w*)?$/;

// { module, set, kind } for the path of a manifest. A manifest at src/<set>/AndroidManifest.xml belongs to the
// module in the folder above src; any other place (the old layout, a manifest at the top of a module) is the
// main source set of the folder it is in. kind is 'main' for src/main, 'test' for the source sets of local and
// instrumented tests (test, androidTest, testFixtures and their variants such as testDebug), which are not part
// of the app, and 'variant' for a flavour or a build type.
export function classifyManifest(rel) {
  const parts = rel.split('/');
  const n = parts.length;
  let module;
  let set;
  if (n >= 3 && parts[n - 3] === 'src') {
    set = parts[n - 2];
    module = parts.slice(0, n - 3).join('/');
  } else {
    set = 'main';
    module = parts.slice(0, n - 1).join('/');
  }
  const kind = set === 'main' ? 'main' : TEST_SET.test(set) ? 'test' : 'variant';
  return { module, set, kind };
}

// declared and removed: lists of { name, file, line, module, kind }. A removal (tools:node="remove") drops the
// declaration of the same name in the same file. A removal in a main manifest also drops the declarations in
// the manifests of other modules, which the manifest merger would take from a library. A removal in a flavour
// or build type manifest touches nothing else, because the other variants still have the permission, and a
// removal in the main manifest does not touch the flavour manifests of its own module, which add the permission
// explicitly. Returns { kept, dropped }.
export function resolvePermissions(declared, removed) {
  const kept = [];
  const dropped = [];
  for (const d of declared) {
    const gone = removed.some((r) => r.name === d.name && (r.file === d.file || (r.kind === 'main' && r.module !== d.module)));
    (gone ? dropped : kept).push(d);
  }
  return { kept, dropped };
}
