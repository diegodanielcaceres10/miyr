import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { KINDS } from '../../src/lib/context.mjs';
import { MANIFEST_FILE, loadManifest, missingManifestMessage } from '../../src/lib/manifest.mjs';
import { project } from '../../test-support/project.mjs';

const PROFILES = ['core', 'node', 'angular'];
const repo = (manifest, extra = { 'web/package.json': '{}', 'landing/package.json': '{}' }) =>
  project({ ...extra, [MANIFEST_FILE]: typeof manifest === 'string' ? manifest : JSON.stringify(manifest) });
const load = (root) => loadManifest(root, PROFILES);
const writeManifest = (root, manifest) => fs.writeFileSync(path.join(root, MANIFEST_FILE), JSON.stringify(manifest));

test('loads projects with explicit names', () => {
  const root = repo({ projects: [{ name: 'app', path: 'web', profile: 'angular' }, { name: 'site', path: 'landing', profile: 'node' }] });
  const { projects, error } = load(root);
  assert.equal(error, undefined);
  assert.deepEqual(projects, [
    { name: 'app', path: 'web', dir: path.join(root, 'web'), profile: 'angular', locations: {} },
    { name: 'site', path: 'landing', dir: path.join(root, 'landing'), profile: 'node', locations: {} },
  ]);
});

test('the name defaults to the relative path', () => {
  const root = repo({ projects: [{ path: 'apps/web', profile: 'angular' }] }, { 'apps/web/package.json': '{}' });
  assert.equal(load(root).projects[0].name, 'apps/web');
});

test('a "." path points at the repository root and is named after it', () => {
  const root = repo({ projects: [{ path: '.', profile: 'core' }] });
  const [project0] = load(root).projects;
  assert.equal(project0.path, '.');
  assert.equal(project0.dir, root);
  assert.equal(project0.name, path.basename(root));
});

test('reports a missing manifest', () => {
  assert.match(load(project({})).error, /\.miyr\.json/);
});

test('reports invalid JSON', () => {
  assert.match(load(repo('{ "projects": ')).error, /inválido/);
});

test('rejects a manifest that is not an object', () => {
  assert.match(load(repo('[]')).error, /objeto/);
});

test('rejects unknown top-level keys', () => {
  const root = repo({ projects: [{ path: 'web', profile: 'angular' }], rules: {} });
  assert.match(load(root).error, /rules/);
});

test('requires a non-empty projects array', () => {
  assert.match(load(repo({})).error, /projects/);
  assert.match(load(repo({ projects: [] })).error, /projects/);
});

test('rejects unknown keys inside a project', () => {
  const root = repo({ projects: [{ path: 'web', profile: 'angular', rules: {} }] });
  assert.match(load(root).error, /rules/);
});

test('requires a path and a known profile, and lists the valid profiles', () => {
  const root = repo({ projects: [{ profile: 'angular' }, { path: 'web', profile: 'cobol' }] });
  const { error } = load(root);
  assert.match(error, /path/);
  assert.match(error, /cobol/);
  for (const name of PROFILES) assert.match(error, new RegExp(name));
});

test('rejects absolute paths and paths that leave the repository', () => {
  const absolute = path.resolve('/');
  for (const bad of [absolute, '..', '../outside', 'web/../../outside']) {
    const root = repo({ projects: [{ path: bad, profile: 'node' }] });
    assert.ok(load(root).error, bad);
  }
});

test('rejects an absolute path even when it points inside the repository', () => {
  const root = project({ 'web/package.json': '{}' });
  const manifest = { projects: [{ path: path.join(root, 'web'), profile: 'node' }] };
  writeManifest(root, manifest);
  assert.match(load(root).error, /relativo/);
});

test('rejects a path that does not exist or is not a directory', () => {
  assert.match(load(repo({ projects: [{ path: 'missing', profile: 'node' }] })).error, /missing/);
  assert.match(load(repo({ projects: [{ path: 'web/package.json', profile: 'node' }] })).error, /carpeta/);
});

test('rejects duplicated names and duplicated folders', () => {
  const sameName = repo({ projects: [{ name: 'x', path: 'web', profile: 'node' }, { name: 'x', path: 'landing', profile: 'node' }] });
  assert.match(load(sameName).error, /repetido/);
  const sameDir = repo({ projects: [{ name: 'a', path: 'web', profile: 'node' }, { name: 'b', path: './web', profile: 'node' }] });
  assert.match(load(sameDir).error, /repetid/);
});

test('rejects names with unsupported characters', () => {
  assert.match(load(repo({ projects: [{ name: 'my app', path: 'web', profile: 'node' }] })).error, /name/);
});

test('aggregates every problem in a single message', () => {
  const root = repo({ projects: [{ path: 'missing', profile: 'cobol' }, { profile: 'node' }] });
  const { error } = load(root);
  assert.match(error, /missing/);
  assert.match(error, /cobol/);
  assert.match(error, /path/);
});

test('the missing manifest message names the exact folder that was searched', () => {
  const message = missingManifestMessage('/work/nura/web');
  assert.match(message, /\.miyr\.json/);
  assert.ok(message.includes('/work/nura/web'));
  assert.match(message, /--cwd/);
});

test('the missing manifest message is short and carries no example', () => {
  const message = missingManifestMessage('/work/nura');
  assert.doesNotMatch(message, /"projects"/);
  assert.doesNotMatch(message, /\{/);
  assert.ok(message.split('\n').length <= 2);
});

test('loadManifest uses the same message when the file is missing', () => {
  const root = project({});
  assert.equal(loadManifest(root, PROFILES).error, missingManifestMessage(root));
});

test('accepts comments and trailing commas, like a hand-written tsconfig', () => {
  const text = `{
    // projects of this repo
    "projects": [
      { "name": "web", "path": "web", "profile": "angular" },
      { "name": "dashboard", "path": "landing", "profile": "node" }, /* second one */
    ],
  }`;
  const { projects, error } = load(repo(text));
  assert.equal(error, undefined);
  assert.deepEqual(projects.map((p) => p.name), ['web', 'dashboard']);
});

test('invalid JSON is still reported after the comments are ignored', () => {
  assert.match(load(repo('{ // c\n "projects": [ }')).error, /inválido/);
});

// --- shared and locations: where the files that live outside a project folder are

const WEB = { name: 'web', path: 'web', profile: 'angular' };
const LANDING = { name: 'landing', path: 'landing', profile: 'node' };

test('shared locations apply to every project, as absolute folders', () => {
  const root = repo({ shared: { ci: '.', license: '.' }, projects: [WEB, LANDING] });
  const { projects, error } = load(root);
  assert.equal(error, undefined);
  for (const p of projects) assert.deepEqual(p.locations, { ci: root, license: root });
});

test('a project can override a shared location and add its own', () => {
  const root = repo({ shared: { ci: '.', license: '.' }, projects: [{ ...WEB, locations: { license: 'web', readme: '.' } }, LANDING] });
  const [web, landing] = load(root).projects;
  assert.deepEqual(web.locations, { ci: root, license: path.join(root, 'web'), readme: root });
  assert.deepEqual(landing.locations, { ci: root, license: root });
});

test('a location may be the project folder itself or any folder above it', () => {
  const root = project({ 'apps/web/package.json': '{}', [MANIFEST_FILE]: JSON.stringify({ projects: [{ path: 'apps/web', profile: 'node', locations: { ci: 'apps/web', license: 'apps', readme: '.' } }] }) });
  assert.equal(load(root).error, undefined);
});

test('every kind can be declared', () => {
  const shared = Object.fromEntries(KINDS.map((kind) => [kind, '.']));
  const { projects, error } = load(repo({ shared, projects: [WEB] }));
  assert.equal(error, undefined);
  assert.deepEqual(Object.keys(projects[0].locations), KINDS);
});

test('unknown kinds are rejected in shared and in locations, listing the valid ones', () => {
  for (const manifest of [{ shared: { licence: '.' }, projects: [WEB] }, { projects: [{ ...WEB, locations: { licence: '.' } }] }]) {
    const { error } = load(repo(manifest));
    assert.match(error, /licence/);
    for (const kind of KINDS) assert.match(error, new RegExp(kind));
  }
});

test('shared and locations must be objects', () => {
  for (const shared of [[], null, 'root', 5]) assert.match(load(repo({ shared, projects: [WEB] })).error, /shared/, JSON.stringify(shared));
  assert.match(load(repo({ projects: [{ ...WEB, locations: [] }] })).error, /locations/);
});

test('a location must be an existing folder, relative to the manifest and inside it', () => {
  const bad = [5, '', path.resolve('/'), '..', '../outside', 'missing', 'web/package.json'];
  for (const value of bad) {
    const { error } = load(repo({ shared: { ci: value }, projects: [WEB] }));
    assert.ok(error, JSON.stringify(value));
    assert.match(error, /shared\.ci/, JSON.stringify(value));
  }
});

test('a location inside a project is reported with that project', () => {
  const { error } = load(repo({ projects: [{ ...WEB, locations: { ci: 'missing' } }] }));
  assert.match(error, /projects\[0\]\.locations\.ci/);
});

test('a location folder must contain the project', () => {
  const { error } = load(repo({ shared: { ci: 'landing' }, projects: [WEB, LANDING] }));
  assert.match(error, /ci/);
  assert.match(error, /no contiene al proyecto/);
  assert.match(error, /web/);
  assert.doesNotMatch(error, /projects\[1\]/, 'landing is inside its own folder, so only web is wrong');
});

test('problems in shared and in projects are reported together', () => {
  const { error } = load(repo({ shared: { licence: '.' }, projects: [{ path: 'missing', profile: 'cobol' }] }));
  assert.match(error, /licence/);
  assert.match(error, /missing/);
  assert.match(error, /cobol/);
});

test('the example manifest of the README is accepted', () => {
  const root = repo({ shared: { ci: '.', license: '.', gitignore: '.' }, projects: [WEB, { ...LANDING, locations: { readme: 'landing' } }] });
  assert.equal(load(root).error, undefined);
});
