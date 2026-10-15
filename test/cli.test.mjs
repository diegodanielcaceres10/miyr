import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { profiles } from '../src/audits/index.mjs';
import { completeProject, completeRepo, nodeProjectFiles, project } from '../test-support/project.mjs';

const bin = path.resolve('bin/miyr.mjs');
const cli = (...args) => spawnSync(process.execPath, [bin, ...args], { encoding: 'utf8' });

const MANIFEST = { projects: [{ name: 'web', path: 'web', profile: 'angular' }] };
const TWO = {
  projects: [
    { name: 'web', path: 'web', profile: 'angular' },
    { name: 'landing', path: 'landing', profile: 'node' },
  ],
};
const withManifest = (manifest, extra = {}) =>
  completeRepo({ '.miyr.json': manifest, ...nodeProjectFiles('landing'), ...extra });

// --- explicit mode: miyr audit <profile> --cwd <folder>

test('audit <profile> exits 0 when every check passes', () => {
  assert.equal(cli('audit', 'angular', '--cwd', completeProject()).status, 0);
});

test('audit <profile> exits 1 when a check fails', () => {
  assert.equal(cli('audit', 'angular', '--cwd', completeProject({ 'tsconfig.json': { compilerOptions: {} } })).status, 1);
  assert.equal(cli('audit', 'core', '--cwd', project({ '.git/HEAD': 'x' })).status, 1);
});

test('audit <profile> looks for repo-level files from the project folder up to the repo root', () => {
  const root = completeRepo();
  assert.equal(cli('audit', 'angular', '--cwd', path.join(root, 'web')).status, 0);
  const missing = completeRepo({ LICENSE: null });
  assert.equal(cli('audit', 'angular', '--cwd', path.join(missing, 'web')).status, 1);
});

test('audit node exits 0 without a tsconfig', () => {
  assert.equal(cli('audit', 'node', '--cwd', completeProject({ 'tsconfig.json': null })).status, 0);
});

test('exits 2 on an unknown profile and lists the available ones', () => {
  const result = cli('audit', 'unknown');
  assert.equal(result.status, 2);
  for (const name of Object.keys(profiles)) assert.match(result.stderr, new RegExp(name));
});

test('exits 2 when the command is missing, the folder does not exist or an option has no value', () => {
  assert.equal(cli().status, 2);
  assert.equal(cli('audit', 'node', '--cwd', path.join(completeProject(), 'nope')).status, 2);
  assert.equal(cli('audit', 'node', '--cwd').status, 2);
});

test('--project is only valid in manifest mode', () => {
  assert.equal(cli('audit', 'node', '--project', 'web', '--cwd', completeProject()).status, 2);
});

test('--json prints the root and one entry per project with its results', () => {
  const root = completeRepo();
  const result = cli('audit', 'angular', '--json', '--cwd', path.join(root, 'web'));
  const report = JSON.parse(result.stdout);
  assert.equal(report.root, root);
  assert.equal(report.projects.length, 1);
  const [only] = report.projects;
  assert.deepEqual([only.name, only.path, only.profile], ['web', 'web', 'angular']);
  assert.equal(only.results.length, profiles.angular.length);
  assert.ok(only.results.every((r) => r.status === 'pass'));
});

test('text output has a header and a summary line that can be copied', () => {
  const result = cli('audit', 'angular', '--cwd', path.join(completeRepo(), 'web'));
  assert.match(result.stdout, /== web \(angular, ruta: web\) ==/);
  assert.match(result.stdout, /Resumen: \d+ OK, 0 FAIL, 0 ERR/);
});

// --- manifest mode: miyr audit [--project <name>]

test('manifest mode audits every project listed in .miyr.json', () => {
  const root = withManifest(TWO);
  const result = cli('audit', '--json', '--cwd', root);
  assert.equal(result.status, 0, result.stdout);
  const report = JSON.parse(result.stdout);
  assert.deepEqual(report.projects.map((p) => [p.name, p.profile]), [['web', 'angular'], ['landing', 'node']]);
  assert.equal(report.projects[0].results.length, profiles.angular.length);
  assert.equal(report.projects[1].results.length, profiles.node.length);
});

test('manifest mode works when started from inside a project folder', () => {
  const root = withManifest(TWO);
  assert.equal(cli('audit', '--cwd', path.join(root, 'web')).status, 0);
});

test('--project audits a single project', () => {
  const root = withManifest(TWO);
  const report = JSON.parse(cli('audit', '--project', 'landing', '--json', '--cwd', root).stdout);
  assert.deepEqual(report.projects.map((p) => p.name), ['landing']);
});

test('manifest mode exits 1 when any project fails', () => {
  const root = withManifest(TWO, { 'landing/package-lock.json': null });
  const result = cli('audit', '--cwd', root);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /== landing \(node, ruta: landing\) ==/);
});

test('manifest mode exits 2 for an unknown project and lists the available ones', () => {
  const result = cli('audit', '--project', 'nope', '--cwd', withManifest(TWO));
  assert.equal(result.status, 2);
  assert.match(result.stderr, /web/);
  assert.match(result.stderr, /landing/);
});

test('manifest mode exits 2 when .miyr.json is missing', () => {
  const result = cli('audit', '--cwd', completeRepo());
  assert.equal(result.status, 2);
  assert.match(result.stderr, /\.miyr\.json/);
});

test('manifest mode exits 2 on an invalid manifest and explains why', () => {
  const unknownProfile = cli('audit', '--cwd', withManifest({ projects: [{ path: 'web', profile: 'cobol' }] }));
  assert.equal(unknownProfile.status, 2);
  assert.match(unknownProfile.stderr, /cobol/);
  const outside = cli('audit', '--cwd', withManifest({ projects: [{ path: '../x', profile: 'node' }] }));
  assert.equal(outside.status, 2);
});

test('a manifest can point a project at the repository root', () => {
  const root = completeProject({ '.miyr.json': { projects: [{ path: '.', profile: 'angular' }] } });
  assert.equal(cli('audit', '--cwd', root).status, 0);
});

// --- output format

const failingRepo = () => completeRepo({ LICENSE: null, 'web/.nvmrc': null });
const audit = (...extra) => cli('audit', 'angular', '--cwd', path.join(failingRepo(), 'web'), ...extra);

test('text output is grouped by area, with documentation apart from configuration', () => {
  const { stdout } = audit();
  for (const label of ['Configuración', 'Tipado', 'CI/CD', 'Documentación']) assert.match(stdout, new RegExp(`^${label}`, 'm'));
  assert.ok(stdout.indexOf('Configuración') < stdout.indexOf('Documentación'));
  const readme = stdout.indexOf('docs/readme');
  assert.ok(readme > stdout.indexOf('Documentación'), 'docs/readme must be listed under Documentación');
});

test('text output shows the id of every check so it can be referenced', () => {
  const { stdout } = audit();
  assert.match(stdout, /\(config\/node-version\)/);
  assert.match(stdout, /\(docs\/license\)/);
});

test('passing checks are compact unless --verbose is used', () => {
  assert.doesNotMatch(audit().stdout, /Scripts presentes/);
  assert.match(audit('--verbose').stdout, /Scripts presentes/);
});

test('failures are always explained', () => {
  const { stdout } = audit();
  assert.match(stdout, /Falta: \.nvmrc/);
  assert.match(stdout, /No se encontró un archivo LICENSE/);
});

test('output has no colors when it is not a terminal, and --color forces them', () => {
  assert.doesNotMatch(audit().stdout, /\u001b/);
  assert.match(audit('--color').stdout, /\u001b\[3[123]m/);
});

test('--no-color wins over --color', () => {
  assert.doesNotMatch(audit('--color', '--no-color').stdout, /\u001b/);
});

test('colors do not change the text', () => {
  const strip = (text) => text.replace(/\u001b\[[0-9;]*m/g, '');
  const cwd = path.join(failingRepo(), 'web');
  const plain = cli('audit', 'angular', '--cwd', cwd).stdout;
  const colored = cli('audit', 'angular', '--cwd', cwd, '--color').stdout;
  assert.equal(strip(colored), plain);
});

test('unknown options are rejected instead of silently ignored', () => {
  const result = audit('--verbos');
  assert.equal(result.status, 2);
  assert.match(result.stderr, /--verbos/);
});

test('--json is never colored', () => {
  assert.doesNotMatch(audit('--json', '--color').stdout, /\u001b/);
});
