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

/** A project that satisfies every core and Angular check; \`overrides\` replaces entries, null removes them. */
export function completeProject(overrides = {}) {
  const files = {
    'package.json': { scripts: { start: 'ng serve', build: 'ng build', test: 'ng test', lint: 'ng lint' } },
    '.editorconfig': EDITORCONFIG,
    'README.md': README,
    LICENSE: 'MIT License\n\nCopyright (c) 2026\n',
    '.github/workflows/ci.yml': WORKFLOW,
    'tsconfig.json': { compilerOptions: { strict: true } },
  };
  for (const [name, content] of Object.entries(overrides)) {
    if (content === null) delete files[name];
    else files[name] = content;
  }
  return project(files);
}
