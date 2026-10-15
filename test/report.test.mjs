import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatText, groupByArea, summarize } from '../src/report.mjs';

const pass = { id: 'config/one', title: 'Uno', status: 'pass', message: 'todo bien' };
const fail = { id: 'config/two', title: 'Dos', status: 'fail', message: 'algo mal', fix: 'arréglalo' };
const error = { id: 'typing/three', title: 'Tres', status: 'error', message: 'roto' };
const weakened = { id: 'typing/four', title: 'Cuatro', status: 'fail', message: 'débil', evidence: { weakened: ['x: false (tsconfig.json)'] } };
const docs = { id: 'docs/five', title: 'Cinco', status: 'pass', message: 'ok' };
const ci = { id: 'ci/six', title: 'Seis', status: 'fail', message: 'sin CI' };

const one = (results) => ({ projects: [{ name: 'web', path: 'web', profile: 'angular', results }] });
const stripAnsi = (text) => text.replace(/\u001b\[[0-9;]*m/g, '');

test('summarize counts results by status', () => {
  assert.deepEqual(summarize([pass, pass, fail, error]), { pass: 2, fail: 1, error: 1 });
  assert.deepEqual(summarize([]), { pass: 0, fail: 0, error: 0 });
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
