import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseJsonc, stripJsonc } from '../../src/lib/jsonc.mjs';

test('parseJsonc ignores line and block comments', () => {
  const input = '{ /* block */ "a": 1, // line\n "b": 2 }';
  assert.deepEqual(parseJsonc(input), { a: 1, b: 2 });
});

test('parseJsonc accepts trailing commas in objects and arrays', () => {
  assert.deepEqual(parseJsonc('{ "a": [1, 2,], "b": { "c": 3, }, }'), { a: [1, 2], b: { c: 3 } });
});

test('parseJsonc keeps comment-like text inside strings', () => {
  const parsed = parseJsonc('{ "url": "https://example.com/*", "glob": "src/**/*.ts" }');
  assert.equal(parsed.url, 'https://example.com/*');
  assert.equal(parsed.glob, 'src/**/*.ts');
});

test('parseJsonc keeps escaped quotes inside strings', () => {
  assert.equal(parseJsonc('{ "a": "x\\"//y" }').a, 'x"//y');
});

test('parseJsonc strips a UTF-8 BOM', () => {
  assert.deepEqual(parseJsonc('\uFEFF{ "a": 1 }'), { a: 1 });
});

test('parseJsonc throws on invalid JSON', () => {
  assert.throws(() => parseJsonc('{ "a": }'));
});

test('parseJsonc accepts a manifest written by hand with a trailing comma', () => {
  const text = `{
    "projects": [
      { "name": "web", "path": "web", "profile": "angular" },
      { "name": "dashboard", "path": "dashboard", "profile": "angular" },
    ]
  }`;
  assert.equal(parseJsonc(text).projects.length, 2);
});

test('stripJsonc keeps every character in place so error positions still match the file', () => {
  const text = '{\n  // note\n  "a": [1, 2,], /* x\n y */ "b": 1,\n}';
  const out = stripJsonc(text);
  assert.equal(out.length, text.length);
  assert.deepEqual(out.split('\n').map((line) => line.length), text.split('\n').map((line) => line.length));
});

test('a comma that is not trailing is kept', () => {
  assert.deepEqual(parseJsonc('[1, /* two */ 2, 3]'), [1, 2, 3]);
});

test('commas between strings are kept', () => {
  assert.deepEqual(parseJsonc('["a", "b"]'), ['a', 'b']);
  assert.deepEqual(parseJsonc('{ "k": ["a", "b",], }'), { k: ['a', 'b'] });
});
