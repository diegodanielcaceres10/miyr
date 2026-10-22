import fs from 'node:fs';
import path from 'node:path';
import { baseFor, declareHint } from '../../lib/context.mjs';
import { readText } from '../../lib/files.mjs';

export const id = 'ci/workflow';
export const title = 'Workflow de CI con lint, test y build';
export const profile = 'node';
export const level = 'B';

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

const posix = (p) => p.split(path.sep).join('/');
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Whether a workflow ties itself to `folder`: a "paths" filter, a "working-directory" or a command run there. */
function referencesFolder(lines, folder) {
  const clean = (value) => value.replace(/\s+#.*$/, '').trim().replace(/^['"]|['"]$/g, '').replace(/^\.\//, '');
  const covers = (value) => {
    const v = clean(value);
    return v === folder || v.startsWith(`${folder}/`);
  };
  const inCommand = new RegExp(`(?:\\bcd|--prefix|-C|--cwd|-w|--workspace)[ =]+['"]?(?:\\./)?${escapeRegex(folder)}(?:/|['"\\s;&|]|$)`);
  if (runCommands(lines).some((command) => inCommand.test(command))) return true;

  for (let i = 0; i < lines.length; i++) {
    const workingDirectory = lines[i].match(/^\s*(?:-\s+)?working-directory:\s*(.+)$/);
    if (workingDirectory && covers(workingDirectory[1])) return true;

    // Only a positive "paths" filter counts; "paths-ignore" says the opposite.
    const paths = lines[i].match(/^(\s*)paths:\s*(.*)$/);
    if (!paths) continue;
    const inline = paths[2].trim();
    if (inline.startsWith('[')) {
      if (inline.replace(/^\[|\]\s*$/g, '').split(',').some(covers)) return true;
      continue;
    }
    for (let j = i + 1; j < lines.length; j++) {
      const item = lines[j].match(/^\s*-\s+(.+)$/);
      if (!item) {
        if (lines[j].trim() === '') continue;
        break;
      }
      if (covers(item[1])) return true;
    }
  }
  return false;
}

// Workflows are read only from <base>/.github/workflows, with no climbing: that is where GitHub reads them.
// The base is the project folder unless the manifest declares another one for "ci". When the CI is shared
// (the base is above the project), the project must declare which workflows are its own ("workflows"),
// and each one must refer to the project folder, so one project cannot pass on another one's workflow.
export function run(ctx) {
  const base = baseFor(ctx, 'ci');
  const dir = path.join(base, '.github', 'workflows');
  const all = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /\.ya?ml$/i.test(f)) : [];
  const projectFolder = posix(path.relative(base, path.resolve(ctx.cwd))); // '' when the CI lives in the project folder
  const where = base === path.resolve(ctx.cwd) ? 'la carpeta del proyecto' : ctx.root ? path.relative(path.resolve(ctx.root), base) || '.' : base;
  const declared = ctx.workflows?.length > 0 ? ctx.workflows : null;

  let files;
  if (declared) {
    const actual = declared.map((name) => all.find((f) => f.toLowerCase() === name.toLowerCase()));
    const missingFiles = declared.filter((_, i) => !actual[i]);
    if (missingFiles.length > 0) {
      return {
        id, title, status: 'fail',
        message: `Workflows declarados que no existen en .github/workflows de ${where}: ${missingFiles.join(', ')}.`,
        fix: `Créalos o corrige "workflows" de este proyecto en el manifiesto. ${declareHint('ci')}`,
      };
    }
    files = actual;
  } else {
    if (all.length === 0) {
      return {
        id, title, status: 'fail',
        message: `No hay workflows en .github/workflows de ${where}.`,
        fix: `Crea un workflow que se ejecute en push o pull_request y corra lint, test y build. ${declareHint('ci')}`,
      };
    }
    if (projectFolder !== '') {
      return {
        id, title, status: 'skip',
        message: `No se puede atribuir ningún workflow de ${where} a este proyecto: el CI está fuera de su carpeta y el proyecto no declara "workflows".`,
        fix: 'Declara en este proyecto del manifiesto "workflows": ["<archivo>.yml"] con los workflows que le corresponden.',
      };
    }
    files = all;
  }

  const found = new Set();
  const used = [];
  const texts = new Map();
  for (const file of files) {
    const lines = withoutComments(readText(path.join(dir, file)));
    texts.set(file, lines);
    if (!/\b(push|pull_request)\b/.test(triggers(lines))) continue;
    used.push(file);
    const commands = runCommands(lines);
    for (const [step, pattern] of Object.entries(STEPS)) {
      if (commands.some((command) => pattern.test(command))) found.add(step);
    }
  }

  if (used.length === 0) {
    return {
      id, title, status: 'fail',
      message: 'Ningún workflow se dispara con push o pull_request.',
      fix: 'Añade push o pull_request a la sección "on" del workflow.',
    };
  }

  const missing = Object.keys(STEPS).filter((step) => !found.has(step));
  if (missing.length > 0) {
    return {
      id, title, status: 'fail', evidence: { workflows: used, missing },
      message: `El CI no ejecuta: ${missing.join(', ')}.`,
      fix: 'Añade un paso "run" para cada uno en un workflow disparado por push o pull_request.',
    };
  }

  if (declared && projectFolder !== '') {
    const unrelated = files.filter((file) => !referencesFolder(texts.get(file), projectFolder));
    if (unrelated.length > 0) {
      return {
        id, title, status: 'fail', evidence: { workflows: files },
        message: `${unrelated.join(', ')} no hace${unrelated.length > 1 ? 'n' : ''} referencia a la carpeta ${projectFolder} (ni en "paths", ni en "working-directory", ni en un "cd" o "--prefix").`,
        fix: `Añade un filtro paths con "${projectFolder}/**" o "working-directory: ${projectFolder}", o corrige "workflows" de este proyecto en el manifiesto.`,
      };
    }
  }

  return { id, title, status: 'pass', evidence: { workflows: used }, message: 'CI con lint, test y build.' };
}
