import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { chooseProject } from '../src/prompt.mjs';

const PROJECTS = [
  { name: 'web', path: 'web', profile: 'angular' },
  { name: 'dashboard', path: 'apps/dashboard', profile: 'node' },
];

// Feeds `answers` as if typed, then closes the input like a terminal at end of file.
async function ask(answers, projects = PROJECTS) {
  const input = new PassThrough();
  const output = new PassThrough();
  let text = '';
  output.on('data', (chunk) => (text += chunk));
  const pending = chooseProject(projects, { input, output });
  input.end(answers);
  return { chosen: await pending, text };
}

test('returns the project whose number was typed', async () => {
  assert.equal((await ask('2\n')).chosen, PROJECTS[1]);
  assert.equal((await ask('1\n')).chosen, PROJECTS[0]);
});

test('lists every project with its number, profile and folder', async () => {
  const { text } = await ask('1\n');
  assert.match(text, /2 proyectos/);
  assert.match(text, /1\) web {8}angular {2}web/);
  assert.match(text, /2\) dashboard {2}node {5}apps\/dashboard/);
});

test('an empty answer or q cancels, even if a valid answer follows', async () => {
  for (const answers of ['\n1\n', 'q\n1\n', 'Q\n1\n']) {
    const { chosen, text } = await ask(answers);
    assert.equal(chosen, null, JSON.stringify(answers));
    assert.doesNotMatch(text, /Opción no válida/);
  }
});

test('closing the input without an answer cancels instead of hanging', async () => {
  assert.equal((await ask('')).chosen, null);
});

test('an invalid answer is reported and asked again', async () => {
  const { chosen, text } = await ask('x\n2\n');
  assert.equal(chosen, PROJECTS[1]);
  assert.match(text, /Opción no válida/);
});

test('numbers out of range are invalid', async () => {
  for (const answer of ['0', '3', '-1', '1.5']) {
    const { chosen, text } = await ask(`${answer}\n1\n`);
    assert.equal(chosen, PROJECTS[0], answer);
    assert.match(text, /Opción no válida/, answer);
  }
});

test('gives up after three invalid answers', async () => {
  assert.equal((await ask('9\n9\n9\n1\n')).chosen, null);
});

test('surrounding spaces are ignored', async () => {
  assert.equal((await ask('  2  \n')).chosen, PROJECTS[1]);
});
