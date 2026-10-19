import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchLatest } from '../../src/lib/registry.mjs';
import { startRegistry } from '../../test-support/registry.mjs';

async function withRegistry(options, fn) {
  const registry = await startRegistry(options);
  try {
    return await fn(registry);
  } finally {
    await registry.close();
  }
}

test('returns the latest stable version of every requested package', async () => {
  await withRegistry({ latest: '22.2.3' }, async (registry) => {
    const result = await fetchLatest(['@angular/core', '@angular/cli'], { baseUrl: registry.url });
    assert.deepEqual(result, { '@angular/core': { version: '22.2.3' }, '@angular/cli': { version: '22.2.3' } });
  });
});

test('asks for the dist-tags of each scoped package', async () => {
  await withRegistry({}, async (registry) => {
    await fetchLatest(['@angular/core'], { baseUrl: registry.url });
    assert.deepEqual(registry.requests, ['/-/package/@angular/core/dist-tags']);
  });
});

test('a trailing slash on the base URL makes no difference', async () => {
  await withRegistry({ latest: '1.2.3' }, async (registry) => {
    assert.deepEqual(await fetchLatest(['pkg'], { baseUrl: `${registry.url}///` }), { pkg: { version: '1.2.3' } });
    assert.deepEqual(registry.requests, ['/-/package/pkg/dist-tags'], 'the path must not start with extra slashes');
  });
});

test('makes no request when no package is asked for', async () => {
  await withRegistry({}, async (registry) => {
    assert.deepEqual(await fetchLatest([], { baseUrl: registry.url }), {});
    assert.deepEqual(registry.requests, []);
  });
});

test('reports an unsuccessful HTTP status', async () => {
  await withRegistry({ status: 404, body: '{}' }, async (registry) => {
    const { '@angular/core': entry } = await fetchLatest(['@angular/core'], { baseUrl: registry.url });
    assert.match(entry.error, /404/);
    assert.equal(entry.version, undefined);
  });
});

test('reports a response without a valid stable "latest"', async () => {
  for (const body of ['not json', '{}', '{"latest":"22.0.0-rc.1"}', '{"latest":22}', 'null']) {
    await withRegistry({ body }, async (registry) => {
      const { pkg } = await fetchLatest(['pkg'], { baseUrl: registry.url });
      assert.ok(pkg.error, body);
      assert.equal(pkg.version, undefined, body);
    });
  }
});

test('reports a registry that is not reachable', async () => {
  const registry = await startRegistry({});
  const url = registry.url;
  await registry.close();
  const { pkg } = await fetchLatest(['pkg'], { baseUrl: url, timeoutMs: 2000 });
  assert.match(pkg.error, /conectar/);
});

test('gives up on a registry that never answers', async () => {
  await withRegistry({ hang: true }, async (registry) => {
    const started = Date.now();
    const { pkg } = await fetchLatest(['pkg'], { baseUrl: registry.url, timeoutMs: 150 });
    assert.match(pkg.error, /no respondió/);
    assert.ok(Date.now() - started < 3000);
  });
});

test('one failing package does not hide the others', async () => {
  await withRegistry({ latest: '3.0.0' }, async (registry) => {
    const result = await fetchLatest(['a', 'b'], { baseUrl: registry.url });
    assert.equal(result.a.version, '3.0.0');
    assert.equal(result.b.version, '3.0.0');
  });
});

test('the registry can be overridden with MIYR_REGISTRY_URL', async () => {
  await withRegistry({ latest: '9.9.9' }, async (registry) => {
    const previous = process.env.MIYR_REGISTRY_URL;
    process.env.MIYR_REGISTRY_URL = registry.url;
    try {
      assert.deepEqual(await fetchLatest(['pkg']), { pkg: { version: '9.9.9' } });
    } finally {
      if (previous === undefined) delete process.env.MIYR_REGISTRY_URL;
      else process.env.MIYR_REGISTRY_URL = previous;
    }
  });
});
