import fs from 'node:fs';
import path from 'node:path';
import { readText } from '../../lib/files.mjs';

export const id = 'ci/workflow';
export const title = 'Workflow de CI con lint, test y build';
export const profile = 'node';

const PM = String.raw`(?:npm|pnpm|yarn|bun)`;
const STEPS = {
  lint: new RegExp(String.raw`\b${PM}\s+(?:run\s+)?lint\b|\bng\s+lint\b`),
  test: new RegExp(String.raw`\b${PM}\s+(?:run\s+)?test\b|\bng\s+test\b`),
  build: new RegExp(String.raw`\b${PM}\s+(?:run\s+)?build\b|\bng\s+build\b`),
};

const indentOf = (line) => line.length - line.trimStart().length;

// Workflows are scanned line by line to avoid adding a YAML dependency.
function withoutComments(text) {
  return text.split(/\r?\n/).filter((line) => !/^\s*#/.test(line));
}

/** Text of the top-level `on:` block (inline value plus indented lines). */
function triggers(lines) {
  const start = lines.findIndex((l) => /^['"]?on['"]?:/.test(l));
  if (start < 0) return '';
  const block = [lines[start].replace(/^['"]?on['"]?:/, '')];
  for (const line of lines.slice(start + 1)) {
    if (line.trim() !== '' && indentOf(line) === 0) break;
    block.push(line);
  }
  return block.join('\n');
}

/** Commands from `run:` steps, both inline and block scalars (`run: |`). */
function runCommands(lines) {
  const commands = [];
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(\s*)(-\s+)?run:\s*(.*)$/);
    if (!match) continue;
    const keyIndent = match[1].length + (match[2] ? match[2].length : 0);
    const value = match[3].trim();
    if (/^[|>][+-]?\d*$/.test(value)) {
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].trim() !== '' && indentOf(lines[j]) <= keyIndent) break;
        commands.push(lines[j]);
      }
    } else {
      commands.push(value);
    }
  }
  return commands;
}

// GitHub only reads workflows from the repository root, so that is the only place checked.
export function run({ cwd, root = cwd }) {
  const dir = path.join(root, '.github', 'workflows');
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /\.ya?ml$/i.test(f)) : [];
  if (files.length === 0) {
    return {
      id, title, status: 'fail', severity: 'high',
      message: 'No hay workflows en .github/workflows de la raíz del repo.',
      fix: 'Crea un workflow que se ejecute en push o pull_request y corra lint, test y build.',
    };
  }

  const found = new Set();
  const used = [];
  for (const file of files) {
    const lines = withoutComments(readText(path.join(dir, file)));
    if (!/\b(push|pull_request)\b/.test(triggers(lines))) continue;
    used.push(file);
    const commands = runCommands(lines);
    for (const [step, pattern] of Object.entries(STEPS)) {
      if (commands.some((command) => pattern.test(command))) found.add(step);
    }
  }

  if (used.length === 0) {
    return {
      id, title, status: 'fail', severity: 'high',
      message: 'Ningún workflow se dispara con push o pull_request.',
      fix: 'Añade push o pull_request a la sección "on" del workflow.',
    };
  }

  const missing = Object.keys(STEPS).filter((step) => !found.has(step));
  if (missing.length > 0) {
    return {
      id, title, status: 'fail', severity: 'high', evidence: { workflows: used, missing },
      message: `El CI no ejecuta: ${missing.join(', ')}.`,
      fix: 'Añade un paso "run" para cada uno en un workflow disparado por push o pull_request.',
    };
  }

  return { id, title, status: 'pass', severity: 'high', evidence: { workflows: used }, message: 'CI con lint, test y build.' };
}
