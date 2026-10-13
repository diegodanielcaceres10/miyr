import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseJsonc } from '../../src/lib/tsconfig.mjs';

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

test('parseJsonc strips a UTF-8 BOM', () => {
  assert.deepEqual(parseJsonc('\uFEFF{ "a": 1 }'), { a: 1 });
});

test('parseJsonc throws on invalid JSON', () => {
  assert.throws(() => parseJsonc('{ "a": }'));
});
