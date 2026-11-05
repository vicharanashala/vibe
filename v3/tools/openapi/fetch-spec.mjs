#!/usr/bin/env node
/**
 * Fetch the ViBe backend's OpenAPI spec and write it to packages/api/openapi.json.
 *
 * The backend embeds the spec in its Scalar page at `<base>/reference`
 * (there is no standalone JSON route). The spec also contains some `$ref`s
 * that point at schemas the backend never registers; openapi-typescript
 * refuses those, so each one is replaced with an open object schema and
 * listed on stdout. The backend itself is never modified.
 *
 * Usage: node tools/openapi/fetch-spec.mjs [baseUrl]   (default http://localhost:4001)
 */
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const base = (process.argv[2] ?? 'http://localhost:4001').replace(/\/$/, '');
const out = resolve(dirname(fileURLToPath(import.meta.url)), '../../packages/api/openapi.json');

const html = await (await fetch(`${base}/reference`)).text();

function extractSpec(source) {
  let from = source.indexOf('"paths"');
  if (from === -1) throw new Error('No OpenAPI document found in the reference page');
  // Walk back to the enclosing object that parses and actually holds `paths`.
  while (from > 0) {
    from = source.lastIndexOf('{', from - 1);
    const candidate = sliceBalancedObject(source, from);
    if (!candidate) continue;
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object' && 'paths' in parsed) return parsed;
    } catch {
      // keep walking outwards
    }
  }
  throw new Error('Could not isolate the OpenAPI JSON object');
}

function sliceBalancedObject(source, start) {
  let depth = 0;
  let inString = false;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (inString) {
      if (ch === '\\') i++;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  return null;
}

const spec = extractSpec(html);
const schemas = spec.components?.schemas ?? {};
const unresolved = new Set();

(function patch(node) {
  if (Array.isArray(node)) return node.forEach(patch);
  if (!node || typeof node !== 'object') return;
  const ref = node.$ref;
  if (typeof ref === 'string') {
    const name = ref.startsWith('#/components/schemas/') ? ref.slice(21) : null;
    if (!name || !(name in schemas)) {
      unresolved.add(ref || '(empty $ref)');
      delete node.$ref;
      node.type = 'object';
      node.additionalProperties = true;
      node.description = `Unresolved backend $ref: ${ref}`;
    }
  }
  Object.values(node).forEach(patch);
})(spec);

// The backend reuses some operationIds across routes; openapi-typescript keys
// `operations` by operationId, so duplicates must be made unique.
const seenIds = new Map();
const renamed = [];
for (const [path, item] of Object.entries(spec.paths)) {
  for (const [method, op] of Object.entries(item)) {
    if (!op || typeof op !== 'object' || !op.operationId) continue;
    const count = (seenIds.get(op.operationId) ?? 0) + 1;
    seenIds.set(op.operationId, count);
    if (count > 1) {
      renamed.push(`${op.operationId} → ${op.operationId}_${count} (${method.toUpperCase()} ${path})`);
      op.operationId = `${op.operationId}_${count}`;
    }
  }
}

writeFileSync(out, JSON.stringify(spec, null, 1) + '\n');
console.log(`Wrote ${out}: ${Object.keys(spec.paths).length} paths, ${Object.keys(schemas).length} schemas`);
if (renamed.length) {
  console.log(`Renamed ${renamed.length} duplicate operationId(s):`);
  for (const r of renamed) console.log(`  - ${r}`);
}
if (unresolved.size) {
  console.log(`Replaced ${unresolved.size} unresolved $ref(s) with open objects:`);
  for (const ref of unresolved) console.log(`  - ${ref}`);
}
