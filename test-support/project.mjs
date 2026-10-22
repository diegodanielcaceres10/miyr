import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** Creates a throwaway project directory from a { 'relative/path': content } map. */
export function project(files = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'miyr-'));
  for (const [name, content] of Object.entries(files)) {
    const file = path.join(dir, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content));
  }
  return dir;
}

export const EDITORCONFIG = `root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
`;

export const README = `# App

## Instalación

## Ejecución

## Build

## Pruebas
`;

export const WORKFLOW = `name: CI
on: [push, pull_request]
jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run build
`;

export const MIT = `MIT License

Copyright (c) 2026

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction.
`;

/** A CI workflow scoped to `folder`: triggered by changes in it and running its steps there. */
export const workflowFor = (folder) => `name: CI ${folder}
on:
  push:
    paths:
      - '${folder}/**'
jobs:
  ci:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: ${folder}
    steps:
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run build
`;

/** A package-lock.json (v3) that resolves the given package versions. */
export function lockfile(versions = { '@angular/core': '22.2.1', '@angular/router': '22.2.1' }) {
  const packages = { '': { name: 'app', version: '0.0.0' } };
  for (const [name, version] of Object.entries(versions)) packages[`node_modules/${name}`] = { version };
  return { name: 'app', version: '0.0.0', lockfileVersion: 3, packages };
}

function defaultFiles() {
  return {
    '.git/HEAD': 'ref: refs/heads/main\n',
    'package.json': {
      name: 'app',
      version: '0.0.0',
      private: true,
      license: 'MIT',
      engines: { node: '>=20' },
      packageManager: 'npm@10.9.0',
      dependencies: { '@angular/core': '^22.0.0', '@angular/router': '^22.0.0' },
      scripts: { start: 'ng serve', build: 'ng build', test: 'ng test', lint: 'ng lint' },
    },
    '.nvmrc': '22\n',
    'package-lock.json': lockfile(),
    '.gitignore': 'node_modules\ndist\n.angular\n',
    '.editorconfig': EDITORCONFIG,
    'README.md': README,
    LICENSE: MIT,
    '.github/workflows/ci.yml': WORKFLOW,
    'tsconfig.json': { compilerOptions: { strict: true } },
    '.miyr.json': { projects: [{ path: '.', profile: 'angular' }] },
  };
}

function withOverrides(files, overrides) {
  for (const [name, content] of Object.entries(overrides)) {
    if (content === null) delete files[name];
    else files[name] = content;
  }
  return files;
}

/** A repository whose root is also the project and which satisfies every angular check; null removes an entry. */
export function completeProject(overrides = {}) {
  return project(withOverrides(defaultFiles(), overrides));
}

// Files that belong to the project folder; everything else lives at the repository root.
const PROJECT_LEVEL = ['package.json', '.nvmrc', 'package-lock.json', 'tsconfig.json'];

/** Project-level files of a node project (no tsconfig) placed under `dir`. */
export function nodeProjectFiles(dir) {
  const files = defaultFiles();
  return Object.fromEntries(
    PROJECT_LEVEL.filter((name) => name !== 'tsconfig.json').map((name) => [`${dir}/${name}`, files[name]]),
  );
}

// What a monorepo keeps at its root instead of inside each project.
export const SHARED_AT_ROOT = { ci: '.', license: '.', readme: '.', editorconfig: '.', gitignore: '.' };

/** A repository whose Angular project lives in `web/`. Override paths are relative to the repository root. */
export function completeRepo(overrides = {}) {
  const files = {};
  for (const [name, content] of Object.entries(defaultFiles())) {
    files[PROJECT_LEVEL.includes(name) ? `web/${name}` : name] = content;
  }
  files['.github/workflows/ci.yml'] = workflowFor('web');
  files['.miyr.json'] = { shared: SHARED_AT_ROOT, projects: [{ name: 'web', path: 'web', profile: 'angular', workflows: ['ci.yml'] }] };
  return project(withOverrides(files, overrides));
}

/** A repository whose web/ folder holds everything, with its own manifest; the root only has .git. */
export function completeWebRepo(overrides = {}) {
  const files = { '.git/HEAD': 'ref: refs/heads/main\n' };
  for (const [name, content] of Object.entries(defaultFiles())) {
    if (name !== '.git/HEAD') files[`web/${name}`] = content;
  }
  return project(withOverrides(files, overrides));
}
