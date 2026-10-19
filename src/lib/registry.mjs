export const DEFAULT_REGISTRY = 'https://registry.npmjs.org';

async function latestOf(base, name, timeoutMs) {
  try {
    const response = await fetch(`${base}/-/package/${name}/dist-tags`, { signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) return { error: `el registro respondió ${response.status}` };
    const tags = await response.json();
    // Only a plain x.y.z counts as stable; prereleases live under other tags.
    if (typeof tags?.latest !== 'string' || !/^\d+\.\d+\.\d+$/.test(tags.latest)) {
      return { error: 'respuesta inesperada del registro (no trae una versión "latest" estable)' };
    }
    return { version: tags.latest };
  } catch (err) {
    if (err.name === 'TimeoutError') return { error: `el registro no respondió en ${timeoutMs / 1000} s` };
    return { error: `no se pudo conectar con el registro (${err.cause?.code ?? err.message})` };
  }
}

/**
 * Latest stable version of each package, from the npm registry. Only the public package name is sent.
 * The registry can be changed with MIYR_REGISTRY_URL. Returns { [name]: { version } | { error } }.
 */
export async function fetchLatest(names, { baseUrl = process.env.MIYR_REGISTRY_URL ?? DEFAULT_REGISTRY, timeoutMs = 5000 } = {}) {
  const base = baseUrl.replace(/\/+$/, '');
  const entries = await Promise.all(names.map(async (name) => [name, await latestOf(base, name, timeoutMs)]));
  return Object.fromEntries(entries);
}
