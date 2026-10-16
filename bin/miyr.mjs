#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { profiles, runAudit } from '../src/audits/index.mjs';
import { findRepoRoot } from '../src/lib/context.mjs';
import { MANIFEST_FILE, loadManifest, missingManifestMessage } from '../src/lib/manifest.mjs';
import { formatText } from '../src/report.mjs';

const USAGE = `Uso:
  miyr audit <perfil> [--cwd <ruta>]   Audita una carpeta con el perfil indicado
  miyr audit [--project <nombre>]      Audita los proyectos declarados en ${MANIFEST_FILE}
Opciones: --json  --verbose  --color  --no-color
Perfiles: ${Object.keys(profiles).join(', ')}`;

const fail = (message, withUsage = false) => {
  console.error(withUsage ? `${message}\n\n${USAGE}` : message);
  process.exit(2);
};

const args = process.argv.slice(2);
const VALUE_OPTIONS = ['cwd', 'project'];
const FLAGS = ['json', 'verbose', 'color', 'no-color'];
for (let i = 1; i < args.length; i++) {
  if (!args[i].startsWith('--')) continue;
  const name = args[i].slice(2);
  if (VALUE_OPTIONS.includes(name)) i += 1;
  else if (!FLAGS.includes(name)) fail(`Opción desconocida: ${args[i]}`, true);
}
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
// Repo-level files (README, LICENSE, workflows...) are searched up to the git root. The manifest is not:
// it must be exactly in `start`, the folder given with --cwd (or the current one).
const root = findRepoRoot(start) ?? start;

// Nothing is audited unless the folder given has a manifest of its own (both modes).
function requireManifest() {
  if (!fs.existsSync(path.join(start, MANIFEST_FILE))) fail(missingManifestMessage(start));
}

let targets;
if (profile) {
  // Explicit mode: the folder and the profile come from the command line.
  if (!Object.hasOwn(profiles, profile)) fail(`Perfil desconocido: ${profile}`, true);
  if (option('project')) fail('--project solo se usa con el manifiesto (sin indicar perfil).', true);
  requireManifest();
  targets = [{ name: path.basename(start), path: posixRelative(root, start), dir: start, profile }];
} else {
  // Manifest mode: the manifest in the given folder declares where each project lives.
  requireManifest();
  const { projects, error } = loadManifest(start, Object.keys(profiles));
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

// Colors only on a real terminal (or when forced), and never when NO_COLOR is set.
const color = !flag('no-color') && (flag('color') || (process.stdout.isTTY && !process.env.NO_COLOR && process.env.TERM !== 'dumb'));
console.log(flag('json') ? JSON.stringify(report, null, 2) : formatText(report, { color, verbose: flag('verbose') }));
process.exitCode = report.projects.every((p) => p.results.every((r) => r.status === 'pass')) ? 0 : 1;
