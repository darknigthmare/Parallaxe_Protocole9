/** Resolve downloads from public build identity, never from a reused version filename. */
export const RELEASE_REPOSITORY = 'https://github.com/darknigthmare/Parallaxe_Protocole9';
export type ReleaseBuild = { version: string; commit: string; target: 'vercel' | 'portable' };
export type ReleaseLink = { href: string; label: string; external: boolean; sha256?: string };
export type ReleaseDownloads = { build: ReleaseBuild | null; sources: ReleaseLink | null; packages: ReleaseLink };
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const hex = (value: unknown, length: number): value is string => typeof value === 'string' && value.length === length && /^[a-f0-9]+$/i.test(value);
export function parseReleaseBuild(value: unknown): ReleaseBuild | null {
  if (!record(value) || value.schema !== 'parallaxe-build-v1' || value.game !== 'parallaxe-protocole-9'
    || typeof value.version !== 'string' || value.version.length > 40 || !/^\d+\.\d+\.\d+(?:[-+][a-zA-Z0-9.-]+)?$/.test(value.version)
    || !hex(value.commit, 40) || (value.target !== 'vercel' && value.target !== 'portable')) return null;
  return { version: value.version, commit: value.commit.toLowerCase(), target: value.target };
}
export function resolveReleaseDownloads(identity: unknown, embedded: unknown = null): ReleaseDownloads {
  const build = parseReleaseBuild(identity);
  const packages: ReleaseLink = {
    href: `${RELEASE_REPOSITORY}/actions/workflows/ci.yml${build ? '?query=' + encodeURIComponent('sha:' + build.commit) : ''}`,
    label: build ? 'Paquets PC/LAN de cette révision (GitHub)' : 'Livraisons disponibles sur GitHub', external: true,
  };
  if (!build) return { build: null, sources: null, packages };
  const sources: ReleaseLink = { href: `${RELEASE_REPOSITORY}/archive/${build.commit}.zip`, label: 'Sources de cette révision (GitHub)', external: true };
  if (build.target === 'portable' && record(embedded) && embedded.schema === 'parallaxe-embedded-sources-v1'
    && embedded.commit === build.commit && embedded.version === build.version && embedded.dirty === false && record(embedded.sources)) {
    const item = embedded.sources;
    if (item.file === `PARALLAXE_Sources_v${build.version}.zip` && hex(item.sha256, 64)
      && Number.isSafeInteger(item.bytes) && (item.bytes as number) > 0 && Number.isSafeInteger(item.files) && (item.files as number) > 0) {
      return { build, packages, sources: { href: '/downloads/' + encodeURIComponent(item.file as string), label: 'Sources embarquées (.zip)', external: false, sha256: item.sha256.toLowerCase() } };
    }
  }
  return { build, sources, packages };
}
async function readPublicJson(request: typeof fetch, path: string, signal: AbortSignal): Promise<unknown> {
  signal.throwIfAborted();
  const response = await request(path, { signal, credentials: 'omit', cache: 'no-store', redirect: 'error' });
  if (!response.ok || !response.headers.get('content-type')?.toLowerCase().includes('application/json') || !response.body) throw new Error('Métadonnées indisponibles');
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let length = 0;
  try {
    for (;;) {
      const chunk = await reader.read(); signal.throwIfAborted();
      if (chunk.done) break;
      length += chunk.value.byteLength;
      if (length > 8192) throw new Error('Métadonnées trop volumineuses');
      chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
export async function loadReleaseDownloads(signal: AbortSignal, request: typeof fetch = fetch): Promise<ReleaseDownloads> {
  let identity: unknown;
  try { identity = await readPublicJson(request, '/build-info.json', signal); }
  catch { signal.throwIfAborted(); return resolveReleaseDownloads(null); }
  const build = parseReleaseBuild(identity); let embedded: unknown = null;
  if (build?.target === 'portable') {
    try { embedded = await readPublicJson(request, `/downloads/PARALLAXE_v${encodeURIComponent(build.version)}_manifest.json`, signal); }
    catch { signal.throwIfAborted(); }
  }
  signal.throwIfAborted();
  return resolveReleaseDownloads(identity, embedded);
}
