import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';

const temporary = await mkdtemp(join(tmpdir(), 'p9-downloads-'));
await writeFile(join(temporary, 'downloads.mjs'), stripTypeScriptTypes(await readFile(new URL('../src/game/release-downloads.ts', import.meta.url), 'utf8')));
const { parseReleaseBuild, resolveReleaseDownloads, loadReleaseDownloads } = await import(pathToFileURL(join(temporary, 'downloads.mjs')));
test.after(() => rm(temporary, { recursive: true, force: true }));
const identity = (target = 'portable') => ({ schema: 'parallaxe-build-v1', game: 'parallaxe-protocole-9', version: '0.4.1', target, commit: 'a'.repeat(40) });
const manifest = () => ({ schema: 'parallaxe-embedded-sources-v1', version: '0.4.1', commit: 'a'.repeat(40), dirty: false, sources: { file: 'PARALLAXE_Sources_v0.4.1.zip', sha256: 'b'.repeat(64), bytes: 4190000, files: 367 } });
const signal = () => new AbortController().signal;

test('unknown builds never offer a historic same-version ZIP as current', () => {
  for (const value of [null, {}, [], identity('preview'), { ...identity(), commit: null }, { ...identity(), game: 'other' }]) {
    const result = resolveReleaseDownloads(value, manifest());
    assert.equal(result.build, null); assert.equal(result.sources, null); assert.match(result.packages.href, /actions\/workflows\/ci.yml$/);
  }
});
test('known web builds link to exact Git source and commit-filtered CI, not local archives', () => {
  const result = resolveReleaseDownloads(identity('vercel'), manifest());
  assert.equal(result.sources.href, `https://github.com/darknigthmare/Parallaxe_Protocole9/archive/${'a'.repeat(40)}.zip`);
  assert.equal(new URL(result.packages.href).searchParams.get('query'), 'sha:' + 'a'.repeat(40));
  assert.equal(result.sources.external, true);
});
test('only matching clean portable provenance enables the embedded source ZIP', () => {
  const result = resolveReleaseDownloads(identity(), manifest());
  assert.equal(result.sources.href, '/downloads/PARALLAXE_Sources_v0.4.1.zip');
  assert.equal(result.sources.external, false); assert.equal(result.sources.sha256, 'b'.repeat(64));
});
test('mismatched revision, schema, version and dirty manifest fall back to exact Git source', () => {
  for (const patch of [{ commit: 'c'.repeat(40) }, { schema: 'legacy' }, { version: '0.4.0' }, { dirty: true }, { dirty: 'false' }]) {
    const result = resolveReleaseDownloads(identity(), { ...manifest(), ...patch });
    assert.equal(result.sources.external, true); assert.ok(result.sources.href.includes('a'.repeat(40)));
  }
});
test('unsafe filenames, URLs and invalid hashes cannot become download links', () => {
  for (const patch of [{ file: '../private.zip' }, { file: 'javascript:alert(1)' }, { file: '//example.invalid/file.zip' }, { file: 'PARALLAXE_Sources_v0.4.1.zip?token=secret' }, { sha256: 'b'.repeat(64) + '\n' }, { bytes: -1 }, { files: 0 }]) {
    const result = resolveReleaseDownloads(identity(), { ...manifest(), sources: { ...manifest().sources, ...patch } });
    assert.equal(result.sources.external, true); assert.equal(result.sources.sha256, undefined);
  }
});
test('public build parsing rejects invalid identifiers and emits only its allowlisted fields', () => {
  for (const patch of [{ commit: 'a'.repeat(40) + '\n' }, { version: '../0.4.1' }, { version: 'x'.repeat(80) }, { version: ['0.4.1'] }]) assert.equal(parseReleaseBuild({ ...identity(), ...patch }), null);
  assert.deepEqual(Object.keys(parseReleaseBuild({ ...identity(), private: 'not-public' })).sort(), ['commit', 'target', 'version']);
});
test('web loader uses one bounded same-origin request with no credentials or redirects', async () => {
  const calls = [];
  const result = await loadReleaseDownloads(signal(), async (url, options) => {
    calls.push(url); assert.equal(options.credentials, 'omit'); assert.equal(options.cache, 'no-store'); assert.equal(options.redirect, 'error');
    return Response.json(identity('vercel'));
  });
  assert.deepEqual(calls, ['/build-info.json']); assert.equal(result.build.target, 'vercel');
});
test('portable loader checks its version-specific embedded manifest', async () => {
  const calls = [];
  const result = await loadReleaseDownloads(signal(), async url => { calls.push(url); return Response.json(calls.length === 1 ? identity() : manifest()); });
  assert.deepEqual(calls, ['/build-info.json', '/downloads/PARALLAXE_v0.4.1_manifest.json']); assert.equal(result.sources.external, false);
});
test('404, HTML fallbacks and invalid JSON produce no stale local download', async () => {
  for (const response of [new Response('', { status: 404 }), new Response('<title>Login</title>', { headers: { 'content-type': 'text/html' } }), new Response('{', { headers: { 'content-type': 'application/json' } })]) {
    const result = await loadReleaseDownloads(signal(), async () => response);
    assert.equal(result.build, null); assert.equal(result.sources, null);
  }
});
test('missing embedded metadata retains an exact external source fallback, never a guessed local ZIP', async () => {
  let calls = 0;
  const result = await loadReleaseDownloads(signal(), async () => ++calls === 1 ? Response.json(identity()) : new Response('not found', { status: 404 }));
  assert.equal(result.sources.external, true); assert.equal(result.build.commit, 'a'.repeat(40));
});
test('the streaming reader cancels metadata above its UTF-8 budget', async () => {
  let cancelled = false;
  const body = new ReadableStream({ pull(controller) { controller.enqueue(new TextEncoder().encode('é'.repeat(5000))); }, cancel() { cancelled = true; } });
  const result = await loadReleaseDownloads(signal(), async () => new Response(body, { headers: { 'content-type': 'application/json' } }));
  assert.equal(result.build, null); assert.equal(cancelled, true);
});
test('aborted and late requests cannot turn into accepted release metadata', async () => {
  const controller = new AbortController(); controller.abort(); let calls = 0;
  await assert.rejects(() => loadReleaseDownloads(controller.signal, async () => { calls++; return Response.json(identity()); }), { name: 'AbortError' }); assert.equal(calls, 0);
  const late = new AbortController();
  await assert.rejects(() => loadReleaseDownloads(late.signal, async () => { late.abort(); return Response.json(identity()); }), { name: 'AbortError' });
});
