import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { profiles } from '../src/audits/index.mjs';
import { EDITORCONFIG, MIT, README, completeProject, completeRepo, nodeProjectFiles, project } from '../test-support/project.mjs';

const bin = path.resolve('bin/miyr.mjs');
const cliWith = (options, ...args) => spawnSync(process.execPath, [bin, ...args], { encoding: 'utf8', ...options });
const cli = (...args) => cliWith({}, ...args);

const asProfile = (profile) => ({ projects: [{ path: '.', profile }] });
const TWO = {
  projects: [
    { name: 'web', path: 'web', profile: 'angular' },
    { name: 'landing', path: 'landing', profile: 'node' },
  ],
};
const withManifest = (manifest, extra = {}) =>
  completeRepo({ '.miyr.json': manifest, ...nodeProjectFiles('landing'), ...extra });
// A repo whose manifest sits INSIDE web/, which is where a run on that folder looks for it.
const repoWithWebManifest = (overrides = {}) => completeRepo({ 'web/.miyr.json': asProfile('angular'), ...overrides });
const MANY = withManifest(TWO);

// --- the profile of every project comes from the manifest

test('audits the project declared in the manifest and exits 0 when every check passes', () => {
  assert.equal(cli('audit', completeProject()).status, 0);
  assert.equal(cli('audit', completeRepo()).status, 0);
});

test('exits 1 when a check fails', () => {
  assert.equal(cli('audit', completeProject({ 'tsconfig.json': { compilerOptions: {} } })).status, 1);
});

test('each project is audited with the profile its manifest entry declares', () => {
  assert.equal(cli('audit', completeProject({ '.miyr.json': asProfile('node'), 'tsconfig.json': null })).status, 0);
  const coreOnly = { 'package.json': null, 'package-lock.json': null, '.nvmrc': null, '.gitignore': null, 'tsconfig.json': null };
  assert.equal(cli('audit', completeProject({ '.miyr.json': asProfile('core'), ...coreOnly })).status, 0);
  assert.equal(cli('audit', project({ '.git/HEAD': 'x', '.miyr.json': asProfile('core') })).status, 1);
});

test('the profile can no longer be passed on the command line, and the message says so', () => {
  const root = completeRepo();
  for (const args of [['angular'], ['angular', root], ['core', '--cwd', root]]) {
    const result = cli('audit', ...args);
    assert.equal(result.status, 2, args.join(' '));
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /"(angular|core)" es un perfil/);
    assert.match(result.stderr, /\.miyr\.json/);
  }
});

test('a folder named like a profile is still accepted as a folder', () => {
  const parent = project({
    'angular/.git/HEAD': 'x',
    'angular/.miyr.json': asProfile('core'),
    'angular/.editorconfig': EDITORCONFIG,
    'angular/README.md': README,
    'angular/LICENSE': MIT,
  });
  assert.equal(cliWith({ cwd: parent }, 'audit', 'angular').status, 0);
});

// --- usage errors

test('exits 2 when the command is missing or unknown', () => {
  assert.equal(cli().status, 2);
  assert.equal(cli('check').status, 2);
});

test('exits 2 when the folder does not exist or an option has no value', () => {
  assert.equal(cli('audit', '--cwd', path.join(completeProject(), 'nope')).status, 2);
  assert.equal(cli('audit', '--cwd').status, 2);
});

test('a word that is not a folder gets a clear message', () => {
  const result = cli('audit', 'nonexistent-folder');
  assert.equal(result.status, 2);
  assert.match(result.stderr, /"nonexistent-folder" no es una carpeta existente/);
});

test('unknown options are rejected instead of silently ignored', () => {
  const result = cli('audit', completeProject(), '--verbos');
  assert.equal(result.status, 2);
  assert.match(result.stderr, /--verbos/);
});

test('extra arguments are rejected', () => {
  const result = cli('audit', completeProject(), 'sobra');
  assert.equal(result.status, 2);
  assert.match(result.stderr, /sobra/);
});

test('the folder cannot be given twice', () => {
  const root = completeProject();
  const result = cli('audit', root, '--cwd', root);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /una sola vez/);
});

test('the folder can be given as an argument or with --cwd, with the same result', () => {
  const root = completeRepo();
  const viaArgument = JSON.parse(cli('audit', '--json', root).stdout);
  const viaOption = JSON.parse(cli('audit', '--json', '--cwd', root).stdout);
  assert.deepEqual(viaArgument, viaOption);
  assert.equal(viaArgument.projects[0].name, 'web');
});

test('a trailing separator on the folder makes no difference', () => {
  const web = path.join(repoWithWebManifest(), 'web') + path.sep;
  assert.equal(cli('audit', web).status, 0);
});

// --- the manifest is required, and searched exactly in the folder given

test('refuses to analyze a folder without .miyr.json', () => {
  const root = completeRepo({ '.miyr.json': null });
  const result = cli('audit', root);
  assert.equal(result.status, 2);
  assert.equal(result.stdout, '', 'nothing may be analyzed or printed');
  assert.match(result.stderr, /No se encontró \.miyr\.json/);
  assert.ok(result.stderr.includes(root), 'the message names the folder that was searched');
});

test('the missing manifest message is brief, has no example and does not call the folder the repo root', () => {
  const { stderr } = cli('audit', completeRepo({ '.miyr.json': null }));
  assert.doesNotMatch(stderr, /"projects"/);
  assert.doesNotMatch(stderr, /raíz del repo/);
});

test('the manifest is searched exactly in the folder given, never above it', () => {
  const root = completeRepo(); // the manifest exists only at the repository root
  const web = path.join(root, 'web');
  const result = cli('audit', web);
  assert.equal(result.status, 2);
  assert.equal(result.stdout, '');
  assert.ok(result.stderr.includes(web));
});

test('running without a folder looks in the current folder only', () => {
  const root = completeRepo();
  const result = cliWith({ cwd: path.join(root, 'web') }, 'audit');
  assert.equal(result.status, 2);
  assert.equal(result.stdout, '');
});

test('the manifest of the folder given is the one that counts, not the one at the repo root', () => {
  const root = completeRepo({ 'web/.miyr.json': asProfile('core') });
  const report = JSON.parse(cli('audit', '--json', path.join(root, 'web')).stdout);
  assert.equal(report.projects[0].profile, 'core');
});

test('a manifest in a subfolder of the repo resolves its paths from that subfolder', () => {
  const root = completeRepo({
    'apps/.miyr.json': { projects: [{ name: 'site', path: 'site', profile: 'node' }] },
    ...nodeProjectFiles('apps/site'),
  });
  const result = cli('audit', '--json', path.join(root, 'apps'));
  assert.equal(result.status, 0, result.stdout);
  assert.deepEqual(JSON.parse(result.stdout).projects.map((p) => [p.name, p.profile]), [['site', 'node']]);
});

test('a manifest written with comments and trailing commas is accepted', () => {
  const text = '{\n  // projects\n  "projects": [\n    { "name": "web", "path": "web", "profile": "angular" },\n  ],\n}';
  assert.equal(cli('audit', completeRepo({ '.miyr.json': text })).status, 0);
});

test('an invalid manifest exits 2 and explains why', () => {
  const unknownProfile = cli('audit', withManifest({ projects: [{ path: 'web', profile: 'cobol' }] }));
  assert.equal(unknownProfile.status, 2);
  assert.match(unknownProfile.stderr, /cobol/);
  assert.equal(cli('audit', withManifest({ projects: [{ path: '../x', profile: 'node' }] })).status, 2);
  assert.equal(cli('audit', completeRepo({ '.miyr.json': '{ "projects": [ ' })).status, 2);
});

// --- project folder without package.json

test('a node or angular project folder without package.json gives one clear failure', () => {
  const root = completeRepo({ 'web/package.json': null });
  const result = cli('audit', '--json', root);
  const [web] = JSON.parse(result.stdout).projects;
  assert.equal(result.status, 1);
  assert.equal(web.results.length, 1);
  assert.equal(web.results[0].id, 'config/project');
  assert.match(web.results[0].message, /package\.json/);
});

// --- choosing what to audit: miyr audit [folder] [--project <name> | --all | --choose]

test('a manifest with one project audits it without asking', () => {
  const result = cli('audit', completeRepo());
  assert.equal(result.status, 0, result.stdout);
  assert.match(result.stdout, /== web \(angular/);
});

test('a manifest with several projects lists them and audits nothing when there is no terminal', () => {
  const result = cli('audit', MANY);
  assert.equal(result.status, 2);
  assert.equal(result.stdout, '', 'nothing may be analyzed');
  assert.match(result.stderr, /2 proyectos/);
  assert.match(result.stderr, /web\s+angular\s+web/);
  assert.match(result.stderr, /landing\s+node\s+landing/);
  assert.match(result.stderr, /--project/);
  assert.match(result.stderr, /--all/);
});

test('the options echo the folder that was given', () => {
  assert.ok(cli('audit', MANY).stderr.includes(`--project web ${MANY}`));
  assert.ok(cli('audit', '--cwd', MANY).stderr.includes(`--project web ${MANY}`));
});

test('with --json the list of options never reaches stdout', () => {
  const result = cli('audit', '--json', MANY);
  assert.equal(result.status, 2);
  assert.equal(result.stdout, '');
});

test('--project audits only that project, with the folder as an argument or with --cwd', () => {
  for (const args of [['--project', 'landing', MANY], [MANY, '--project', 'landing'], ['--project', 'landing', '--cwd', MANY]]) {
    const report = JSON.parse(cli('audit', '--json', ...args).stdout);
    assert.deepEqual(report.projects.map((p) => p.name), ['landing'], args.join(' '));
  }
});

test('--project with an unknown name exits 2 and lists the available ones', () => {
  const result = cli('audit', '--project', 'nope', MANY);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /web/);
  assert.match(result.stderr, /landing/);
});

test('--all audits every project and exits 1 when any fails', () => {
  const report = JSON.parse(cli('audit', '--all', '--json', MANY).stdout);
  assert.deepEqual(report.projects.map((p) => p.name), ['web', 'landing']);
  const broken = withManifest(TWO, { 'landing/package-lock.json': null });
  assert.equal(cli('audit', '--all', broken).status, 1);
});

test('--project and --all cannot be combined', () => {
  assert.equal(cli('audit', '--project', 'web', '--all', MANY).status, 2);
});

test('--choose asks which project to audit and continues with the answer', () => {
  const result = cliWith({ input: '2\n' }, 'audit', '--choose', '--json', MANY);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout).projects.map((p) => p.name), ['landing']);
  assert.match(result.stderr, /2\) landing/);
});

test('--choose keeps stdout clean until a project is chosen, and cancelling audits nothing', () => {
  for (const input of ['\n', 'q\n', '\n2\n', 'q\n2\n', '']) {
    const result = cliWith({ input }, 'audit', '--choose', MANY);
    assert.equal(result.status, 2, JSON.stringify(input));
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /No se eligió ningún proyecto/);
  }
});

test('--choose with a single project does not ask', () => {
  assert.equal(cliWith({ input: '' }, 'audit', '--choose', completeRepo()).status, 0);
});

test('--choose cannot be combined with --project or --all', () => {
  assert.equal(cli('audit', '--choose', '--project', 'web', MANY).status, 2);
  assert.equal(cli('audit', '--choose', '--all', MANY).status, 2);
});

// --- output format

const failingRepo = () => completeRepo({ LICENSE: null, 'web/.nvmrc': null });
const audit = (...extra) => cli('audit', failingRepo(), ...extra);

test('--json prints the root and one entry per project with its results', () => {
  const root = completeRepo();
  const report = JSON.parse(cli('audit', '--json', root).stdout);
  assert.equal(report.root, root);
  assert.equal(report.projects.length, 1);
  const [only] = report.projects;
  assert.deepEqual([only.name, only.path, only.profile], ['web', 'web', 'angular']);
  assert.equal(only.results.length, profiles.angular.length);
  assert.ok(only.results.every((r) => r.status === 'pass'));
});

test('text output has a header and a summary line that can be copied', () => {
  const { stdout } = cli('audit', completeRepo());
  assert.match(stdout, /== web \(angular, ruta: web\) ==/);
  assert.match(stdout, /Resumen: \d+ OK, 0 FAIL, 0 ERR/);
});

test('text output is grouped by area, with documentation apart from configuration', () => {
  const { stdout } = audit();
  for (const label of ['Configuración', 'Tipado', 'CI/CD', 'Documentación']) assert.match(stdout, new RegExp(`^${label}`, 'm'));
  assert.ok(stdout.indexOf('docs/readme') > stdout.indexOf('Documentación'), 'docs/readme must be listed under Documentación');
});

test('text output shows the id of every check so it can be referenced', () => {
  const { stdout } = audit();
  assert.match(stdout, /\(config\/node-version\)/);
  assert.match(stdout, /\(docs\/license\)/);
});

test('passing checks are compact unless --verbose is used, and failures are always explained', () => {
  assert.doesNotMatch(audit().stdout, /Scripts presentes/);
  assert.match(audit('--verbose').stdout, /Scripts presentes/);
  assert.match(audit().stdout, /Falta: \.nvmrc/);
});

test('output has no colors when it is not a terminal, --color forces them and --no-color wins', () => {
  assert.doesNotMatch(audit().stdout, /\u001b/);
  assert.match(audit('--color').stdout, /\u001b\[3[123]m/);
  assert.doesNotMatch(audit('--color', '--no-color').stdout, /\u001b/);
  assert.doesNotMatch(audit('--json', '--color').stdout, /\u001b/);
});

test('colors do not change the text', () => {
  const strip = (text) => text.replace(/\u001b\[[0-9;]*m/g, '');
  const root = failingRepo();
  assert.equal(strip(cli('audit', root, '--color').stdout), cli('audit', root).stdout);
});
