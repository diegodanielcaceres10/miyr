import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../../../src/audits/ci/workflow.mjs';
import { WORKFLOW, project } from '../../../test-support/project.mjs';

const ci = (files) => run({ cwd: project(files) });

test('fails when there is no workflows directory', () => {
  assert.equal(ci({}).status, 'fail');
});

test('passes with inline run commands and push/pull_request triggers', () => {
  assert.equal(ci({ '.github/workflows/ci.yml': WORKFLOW }).status, 'pass');
});

test('passes with block scalar commands and a block-style trigger', () => {
  const content = `name: CI
on:
  pull_request:
    branches: [main]
jobs:
  ci:
    steps:
      - name: Validate
        run: |
          npm ci
          npx ng lint
          npx ng test --watch=false
          npx ng build
`;
  assert.equal(ci({ '.github/workflows/ci.yaml': content }).status, 'pass');
});

test('recognizes pnpm and yarn commands and a scalar trigger', () => {
  const content = 'on: push\njobs:\n  ci:\n    steps:\n      - run: pnpm lint\n      - run: yarn test\n      - run: pnpm run build\n';
  assert.equal(ci({ '.github/workflows/ci.yml': content }).status, 'pass');
});

test('fails and lists the missing steps', () => {
  const content = 'on: [push]\njobs:\n  ci:\n    steps:\n      - run: npm run lint\n';
  const result = ci({ '.github/workflows/ci.yml': content });
  assert.equal(result.status, 'fail');
  assert.match(result.message, /test/);
  assert.match(result.message, /build/);
  assert.doesNotMatch(result.message, /lint/);
});

test('fails when the workflow is not triggered by push or pull_request', () => {
  const content = WORKFLOW.replace('on: [push, pull_request]', 'on: workflow_dispatch');
  const result = ci({ '.github/workflows/ci.yml': content });
  assert.equal(result.status, 'fail');
});

test('does not treat a step name or a comment as a command', () => {
  const content = `on: push
jobs:
  ci:
    steps:
      - name: Run lint
        run: echo hello
      # - run: npm run lint
      - run: npm test
      - run: npm run build
`;
  const result = ci({ '.github/workflows/ci.yml': content });
  assert.equal(result.status, 'fail');
  assert.match(result.message, /lint/);
});

test('accepts the steps split across several workflow files', () => {
  const a = 'on: push\njobs:\n  lint:\n    steps:\n      - run: npm run lint\n';
  const b = 'on: pull_request\njobs:\n  verify:\n    steps:\n      - run: npm test\n      - run: npm run build\n';
  const result = ci({ '.github/workflows/lint.yml': a, '.github/workflows/verify.yml': b });
  assert.equal(result.status, 'pass');
  assert.equal(result.evidence.workflows.length, 2);
});

test('ignores workflows that are not triggered by push or pull_request', () => {
  const manual = 'on: workflow_dispatch\njobs:\n  x:\n    steps:\n      - run: npm run lint\n      - run: npm test\n      - run: npm run build\n';
  assert.equal(ci({ '.github/workflows/manual.yml': manual }).status, 'fail');
});

test('does not count a commented-out trigger inside the on block', () => {
  const content = `on:
  # push:
  workflow_dispatch:
jobs:
  ci:
    steps:
      - run: npm run lint
      - run: npm test
      - run: npm run build
`;
  assert.equal(ci({ '.github/workflows/ci.yml': content }).status, 'fail');
});

test('does not count a commented-out command inside a block scalar', () => {
  const content = `on: push
jobs:
  ci:
    steps:
      - run: |
          # npm run lint
          npm test
          npm run build
`;
  const result = ci({ '.github/workflows/ci.yml': content });
  assert.equal(result.status, 'fail');
  assert.match(result.message, /lint/);
});
