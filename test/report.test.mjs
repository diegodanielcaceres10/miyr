import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exitCodeFor, formatChoices, formatText, groupByArea, projectRows, summarize } from '../src/report.mjs';

const pass = { id: 'config/one', title: 'Uno', status: 'pass', message: 'todo bien' };
const fail = { id: 'config/two', title: 'Dos', status: 'fail', message: 'algo mal', fix: 'arréglalo' };
const error = { id: 'typing/three', title: 'Tres', status: 'error', message: 'roto' };
const weakened = { id: 'typing/four', title: 'Cuatro', status: 'fail', message: 'débil', evidence: { weakened: ['x: false (tsconfig.json)'] } };
const docs = { id: 'docs/five', title: 'Cinco', status: 'pass', message: 'ok' };
const ci = { id: 'ci/six', title: 'Seis', status: 'fail', message: 'sin CI' };
const skip = { id: 'config/seven', title: 'Siete', status: 'skip', message: 'no se consultó el registro', fix: 'usa --online', severity: 'high' };
const withSeverity = (result, severity) => ({ ...result, severity });

const one = (results) => ({ projects: [{ name: 'web', path: 'web', profile: 'angular', results }] });
const stripAnsi = (text) => text.replace(/\u001b\[[0-9;]*m/g, '');

test('summarize counts results by status', () => {
  assert.deepEqual(summarize([pass, pass, fail, error]), { pass: 2, fail: 1, error: 1, skip: 0 });
  assert.deepEqual(summarize([]), { pass: 0, fail: 0, error: 0, skip: 0 });
  assert.deepEqual(summarize([pass, skip, skip]), { pass: 1, fail: 0, error: 0, skip: 2 });
});

test('groupByArea follows the fixed area order, whatever the order of the results', () => {
  const groups = groupByArea([docs, ci, fail, error, pass]);
  assert.deepEqual(groups.map((g) => g.label), ['Configuración', 'Tipado', 'CI/CD', 'Documentación']);
  assert.deepEqual(groups[0].results, [fail, pass]);
});

test('groupByArea appends unknown areas at the end with a capitalized name', () => {
  const groups = groupByArea([{ id: 'security/x', title: 'X', status: 'pass', message: '' }, pass]);
  assert.deepEqual(groups.map((g) => g.label), ['Configuración', 'Security']);
});

test('formatText prints a header, one heading per area and a summary per project', () => {
  const text = formatText(one([docs, fail, error, pass]));
  assert.match(text, /== web \(angular, ruta: web\) ==/);
  for (const label of ['Configuración', 'Tipado', 'Documentación']) assert.match(text, new RegExp(`^${label}`, 'm'));
  assert.ok(text.indexOf('Configuración') < text.indexOf('Tipado'));
  assert.ok(text.indexOf('Tipado') < text.indexOf('Documentación'));
  assert.match(text, /Resumen: 2 OK, 1 FAIL, 1 ERR/);
});

test('each area heading carries its own counts and omits the zero ones', () => {
  const text = formatText(one([pass, fail, error]));
  assert.match(text, /^Configuración: 1 OK, 1 FAIL$/m);
  assert.match(text, /^Tipado: 1 ERR$/m);
});

test('every check line shows its status, title and stable id', () => {
  const text = formatText(one([pass, fail, error]));
  assert.match(text, /\[OK {2}\] Uno \(config\/one\)/);
  assert.match(text, /\[FAIL\] Dos \(config\/two\)/);
  assert.match(text, /\[ERR \] Tres \(typing\/three\)/);
});

test('passing checks are compact by default and show their message with verbose', () => {
  assert.doesNotMatch(formatText(one([pass])), /todo bien/);
  assert.match(formatText(one([pass]), { verbose: true }), /todo bien/);
});

test('failing checks always show the message, the evidence and the fix', () => {
  const text = formatText(one([fail, weakened]));
  assert.match(text, /algo mal/);
  assert.match(text, /-> arréglalo/);
  assert.match(text, /- x: false \(tsconfig\.json\)/);
});

test('colors only wrap text and never change it', () => {
  const results = [pass, fail, error, docs];
  const plain = formatText(one(results));
  const colored = formatText(one(results), { color: true });
  assert.doesNotMatch(plain, /\u001b/);
  assert.match(colored, /\u001b\[32m/);
  assert.match(colored, /\u001b\[31m/);
  assert.match(colored, /\u001b\[33m/);
  assert.equal(stripAnsi(colored), plain);
});

test('several projects are separated and keep their order', () => {
  const text = formatText({
    projects: [
      { name: 'web', path: 'web', profile: 'angular', results: [pass] },
      { name: 'landing', path: 'landing', profile: 'node', results: [fail] },
    ],
  });
  assert.ok(text.indexOf('== web') < text.indexOf('== landing'));
  assert.match(text, /Resumen: 1 OK, 0 FAIL, 0 ERR/);
  assert.match(text, /Resumen: 0 OK, 1 FAIL, 0 ERR/);
});

const PROJECTS = [
  { name: 'web', path: 'web', profile: 'angular' },
  { name: 'dashboard', path: 'apps/dashboard', profile: 'node' },
];

test('formatChoices lists every project with its profile and folder, aligned', () => {
  const text = formatChoices(PROJECTS);
  assert.match(text, /2 proyectos/);
  assert.match(text, /^ {2}web {8}angular {2}web$/m);
  assert.match(text, /^ {2}dashboard {2}node {5}apps\/dashboard$/m);
});

test('formatChoices suggests --project and --all, echoing the folder given', () => {
  const text = formatChoices(PROJECTS, { folder: '..\\nura' });
  assert.match(text, /node bin\/miyr\.mjs audit --project web \.\.\\nura/);
  assert.match(text, /node bin\/miyr\.mjs audit --all \.\.\\nura/);
});

test('formatChoices quotes a folder that contains spaces and omits it when none was given', () => {
  assert.match(formatChoices(PROJECTS, { folder: 'mi repo' }), /--project web "mi repo"/);
  const bare = formatChoices(PROJECTS);
  assert.match(bare, /audit --project web$/m);
  assert.match(bare, /audit --all$/m);
});

test('projectRows aligns name, profile and folder without indentation', () => {
  assert.deepEqual(projectRows(PROJECTS), ['web        angular  web', 'dashboard  node     apps/dashboard']);
});

test('a skipped check is shown with its message and fix, and counted apart', () => {
  const text = formatText(one([pass, skip]));
  assert.match(text, /\[SKIP\] Siete \(config\/seven\)/);
  assert.match(text, /no se consultó el registro/);
  assert.match(text, /-> usa --online/);
  assert.match(text, /^Configuración: 1 OK, 1 SKIP$/m);
});

test('the summary mentions skipped checks only when there are some', () => {
  assert.match(formatText(one([pass, skip])), /Resumen: 1 OK, 0 FAIL, 0 ERR, 1 SKIP/);
  assert.doesNotMatch(formatText(one([pass, fail])), /SKIP/);
});

test('failures and errors show their severity in Spanish, passing and skipped checks do not', () => {
  const labels = { critical: 'crítica', high: 'alta', medium: 'media', low: 'baja' };
  for (const [severity, label] of Object.entries(labels)) {
    const text = formatText(one([withSeverity(fail, severity), withSeverity(error, severity)]));
    assert.match(text, new RegExp(`\\[FAIL\\] Dos \\(config/two\\) \\[${label}\\]`), severity);
    assert.match(text, new RegExp(`\\[ERR \\] Tres \\(typing/three\\) \\[${label}\\]`), severity);
  }
  const quiet = formatText(one([withSeverity(pass, 'critical'), skip]));
  assert.doesNotMatch(quiet, /\[(crítica|alta|media|baja)\]/);
});

test('a failure without severity prints no label', () => {
  assert.doesNotMatch(formatText(one([fail])), /\[(crítica|alta|media|baja)\]/);
});

test('severity is colored by gravity and colors still never change the text', () => {
  const results = [withSeverity(fail, 'critical'), withSeverity(ci, 'low')];
  const colored = formatText(one(results), { color: true });
  assert.match(colored, /\u001b\[1;31m\[crítica\]/);
  assert.match(colored, /\u001b\[2m\[baja\]/);
  assert.equal(stripAnsi(colored), formatText(one(results)));
});

test('exitCodeFor is 0 when every check passes or is skipped, and 1 on any failure or error', () => {
  const projects = (results) => [{ results }];
  assert.equal(exitCodeFor(projects([pass, pass])), 0);
  assert.equal(exitCodeFor(projects([pass, skip])), 0);
  assert.equal(exitCodeFor(projects([skip])), 0);
  assert.equal(exitCodeFor(projects([pass, fail])), 1);
  assert.equal(exitCodeFor(projects([pass, error])), 1);
  assert.equal(exitCodeFor([...projects([pass]), ...projects([skip, fail])]), 1);
});
