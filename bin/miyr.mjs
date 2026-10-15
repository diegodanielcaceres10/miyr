#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { profiles, runAudit } from '../src/audits/index.mjs';
import { findRepoRoot } from '../src/lib/context.mjs';
import { MANIFEST_FILE, loadManifest } from '../src/lib/manifest.mjs';
import { formatText } from '../src/report.mjs';

const USAGE = `Uso:
  miyr audit <perfil> [--cwd <ruta>] [--json]   Audita una carpeta con el perfil indicado
  miyr audit [--project <nombre>] [--json]      Audita los proyectos declarados en ${MANIFEST_FILE}
Perfiles: ${Object.keys(profiles).join(', ')}`;

const fail = (message, withUsage = false) => {
  console.error(withUsage ? `${message}\n\n${USAGE}` : message);
  process.exit(2);
};

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name) => {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return undefined;
  const value = args[i + 1];
  if (value === undefined || value.startsWith('--')) fail(`Falta el valor de --${name}`, true);
  return value;
};
const isDirectory = (dir) => fs.existsSync(dir) && fs.statSync(dir).isDirectory();
const posixRelative = (from, to) => path.relative(from, to).split(path.sep).join('/') || '.';

const [command, first] = args;
if (command !== 'audit') fail('Comando desconocido o ausente.', true);
const profile = first && !first.startsWith('--') ? first : null;

const start = path.resolve(option('cwd') ?? process.cwd());
if (!isDirectory(start)) fail(`No existe la carpeta: ${start}`);
const root = findRepoRoot(start) ?? start;

let targets;
if (profile) {
  // Explicit mode: the folder and the profile come from the command line.
  if (!Object.hasOwn(profiles, profile)) fail(`Perfil desconocido: ${profile}`, true);
  if (option('project')) fail('--project solo se usa con el manifiesto (sin indicar perfil).', true);
  targets = [{ name: path.basename(start), path: posixRelative(root, start), dir: start, profile }];
} else {
  // Manifest mode: the repository root declares where each project lives.
  const { projects, error } = loadManifest(root, Object.keys(profiles));
  if (error) fail(error);
  const wanted = option('project');
  targets = wanted ? projects.filter((p) => p.name === wanted) : projects;
  if (targets.length === 0) fail(`Proyecto desconocido: ${wanted}. Disponibles: ${projects.map((p) => p.name).join(', ')}`);
}

const report = {
  root,
  projects: targets.map((t) => ({
    name: t.name,
    path: t.path,
    profile: t.profile,
    results: runAudit(t.profile, { cwd: t.dir, root }),
  })),
};

console.log(flag('json') ? JSON.stringify(report, null, 2) : formatText(report));
process.exitCode = report.projects.every((p) => p.results.every((r) => r.status === 'pass')) ? 0 : 1;
