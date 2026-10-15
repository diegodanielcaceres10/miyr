import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatText, summarize } from '../src/report.mjs';

const pass = { id: 'a/one', title: 'Uno', status: 'pass', message: 'bien' };
const fail = { id: 'a/two', title: 'Dos', status: 'fail', message: 'mal', fix: 'arréglalo' };
const error = { id: 'a/three', title: 'Tres', status: 'error', message: 'roto' };
const weakened = { id: 'a/four', title: 'Cuatro', status: 'fail', message: 'débil', evidence: { weakened: ['x: false (tsconfig.json)'] } };

test('summarize counts results by status', () => {
  assert.deepEqual(summarize([pass, pass, fail, error]), { pass: 2, fail: 1, error: 1 });
  assert.deepEqual(summarize([]), { pass: 0, fail: 0, error: 0 });
});

test('formatText prints a header, every result and a summary per project', () => {
  const text = formatText({ projects: [{ name: 'web', path: 'web', profile: 'angular', results: [pass, fail, error, weakened] }] });
  assert.match(text, /== web \(angular, ruta: web\) ==/);
  assert.match(text, /\[OK {2}\] Uno/);
  assert.match(text, /\[FAIL\] Dos/);
  assert.match(text, /\[ERR \] Tres/);
  assert.match(text, /-> arréglalo/);
  assert.match(text, /- x: false \(tsconfig\.json\)/);
  assert.match(text, /Resumen: 1 OK, 2 FAIL, 1 ERR/);
});

test('formatText separates several projects and keeps their order', () => {
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
