import fs from 'node:fs';
import path from 'node:path';
import { KINDS } from './context.mjs';
import { readText } from './files.mjs';
import { parseJsonc } from './jsonc.mjs';

export const MANIFEST_FILE = '.miyr.json';

const TOP_KEYS = ['projects', 'shared'];
const PROJECT_KEYS = ['name', 'path', 'profile', 'locations', 'workflows'];
const WORKFLOW_FILE = /^[^/\\]+\.ya?ml$/i;
const NAME = /^[\w./-]+$/;
const posix = (p) => p.split(path.sep).join('/');
const isOutside = (rel) => rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel);

/** Message shown when the folder given to miyr has no manifest. */
export function missingManifestMessage(dir) {
  return [
    `No se encontró ${MANIFEST_FILE} en la carpeta indicada: ${dir}`,
    'miyr lo busca exactamente en la carpeta de --cwd (o en la actual), sin subir a carpetas superiores.',
  ].join('\n');
}

/** A folder named in the manifest: relative to the manifest folder, inside it, existing. `field` prefixes the first two problems. */
function resolveFolder(value, dir, field = '') {
  if (path.isAbsolute(value)) return { problem: `${field}debe ser relativo a la carpeta del manifiesto (${value})` };
  const resolved = path.resolve(dir, value);
  const rel = path.relative(dir, resolved);
  if (isOutside(rel)) return { problem: `${field}sale de la carpeta del manifiesto (${value})` };
  if (!fs.existsSync(resolved)) return { problem: `no existe la carpeta ${value}` };
  if (!fs.statSync(resolved).isDirectory()) return { problem: `"${value}" no es una carpeta` };
  return { resolved, rel };
}

/** `shared` or a project's `locations`: { kind: folder }. Returns { kind: absolute folder } for the valid entries. */
function readLocations(value, label, dir, errors) {
  if (value === undefined) return {};
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    errors.push(`${label}: debe ser un objeto con las claves ${KINDS.join(', ')}`);
    return {};
  }
  const result = {};
  for (const [kind, folder] of Object.entries(value)) {
    if (!KINDS.includes(kind)) {
      errors.push(`${label}: clave desconocida "${kind}" (válidas: ${KINDS.join(', ')})`);
      continue;
    }
    const folderResult =
      typeof folder === 'string' && folder.trim() !== ''
        ? resolveFolder(folder, dir)
        : { problem: 'debe ser la ruta de una carpeta relativa al manifiesto' };
    if (folderResult.problem) errors.push(`${label}.${kind}: ${folderResult.problem}`);
    else result[kind] = folderResult.resolved;
  }
  return result;
}

/**
 * Loads and validates <dir>/.miyr.json, where <dir> is exactly the folder given to miyr (it is never
 * searched in parent folders). The manifest only says WHERE each project lives, WHICH profile applies
 * and, in `shared` / `locations`, in which folder to look for the files that are not inside a project
 * folder. All paths are relative to <dir>; it cannot change rules. Returns { projects } or { error }.
 */
export function loadManifest(dir, profileNames) {
  const file = path.join(dir, MANIFEST_FILE);
  if (!fs.existsSync(file)) return { error: missingManifestMessage(dir) };

  let data;
  try {
    data = parseJsonc(readText(file));
  } catch (err) {
    return { error: `${MANIFEST_FILE} inválido: ${err.message}` };
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return { error: `${MANIFEST_FILE} inválido: debe ser un objeto JSON.` };
  }

  const errors = [];
  for (const key of Object.keys(data)) {
    if (!TOP_KEYS.includes(key)) errors.push(`clave desconocida "${key}"`);
  }
  const shared = readLocations(data.shared, 'shared', dir, errors);
  if (!Array.isArray(data.projects) || data.projects.length === 0) {
    errors.push('"projects" debe ser una lista con al menos un proyecto');
    return { error: `${MANIFEST_FILE} inválido:\n  - ${errors.join('\n  - ')}` };
  }

  const projects = [];
  const names = new Set();
  const dirs = new Set();

  data.projects.forEach((entry, i) => {
    const where = `projects[${i}]`;
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      errors.push(`${where}: debe ser un objeto`);
      return;
    }
    for (const key of Object.keys(entry)) {
      if (!PROJECT_KEYS.includes(key)) errors.push(`${where}: clave desconocida "${key}"`);
    }

    let projectDir = null;
    let rel = '';
    if (typeof entry.path !== 'string' || entry.path.trim() === '') {
      errors.push(`${where}: falta "path"`);
    } else {
      const folder = resolveFolder(entry.path, dir, '"path" ');
      if (folder.problem) errors.push(`${where}: ${folder.problem}`);
      else if (dirs.has(folder.resolved)) errors.push(`${where}: carpeta repetida (${entry.path})`);
      else {
        projectDir = folder.resolved;
        rel = folder.rel;
        dirs.add(folder.resolved);
      }
    }

    if (typeof entry.profile !== 'string') {
      errors.push(`${where}: falta "profile"`);
    } else if (!profileNames.includes(entry.profile)) {
      errors.push(`${where}: perfil desconocido "${entry.profile}" (disponibles: ${profileNames.join(', ')})`);
    }

    let name = null;
    if (entry.name !== undefined) {
      if (typeof entry.name !== 'string' || !NAME.test(entry.name)) {
        errors.push(`${where}: "name" solo admite letras, números, ".", "_", "-" y "/"`);
      } else {
        name = entry.name;
      }
    } else if (projectDir) {
      name = rel === '' ? path.basename(dir) : posix(rel);
    }
    if (name !== null && names.has(name)) errors.push(`${where}: nombre repetido "${name}"`);
    if (name !== null) names.add(name);

    // The workflow files of the shared CI that belong to this project (names only, no folders).
    let workflows;
    if (entry.workflows !== undefined) {
      if (!Array.isArray(entry.workflows) || entry.workflows.length === 0) {
        errors.push(`${where}: "workflows" debe ser una lista con al menos un archivo`);
      } else {
        const seen = new Set();
        workflows = [];
        for (const item of entry.workflows) {
          if (typeof item !== 'string' || !WORKFLOW_FILE.test(item)) {
            errors.push(`${where}: "workflows" solo admite nombres de archivo .yml o .yaml, sin carpetas (${JSON.stringify(item)})`);
          } else if (seen.has(item.toLowerCase())) {
            errors.push(`${where}: workflow repetido "${item}"`);
          } else {
            seen.add(item.toLowerCase());
            workflows.push(item);
          }
        }
      }
    }

    // What this project declares overrides what is shared, kind by kind.
    const locations = { ...shared, ...readLocations(entry.locations, `${where}.locations`, dir, errors) };
    if (projectDir) {
      for (const [kind, base] of Object.entries(locations)) {
        if (isOutside(path.relative(base, projectDir))) {
          errors.push(`${where}: la carpeta de "${kind}" (${posix(path.relative(dir, base)) || '.'}) no contiene al proyecto (${entry.path})`);
        }
      }
    }

    if (projectDir && name !== null && profileNames.includes(entry.profile)) {
      projects.push({ name, path: posix(rel) || '.', dir: projectDir, profile: entry.profile, locations, ...(workflows ? { workflows } : {}) });
    }
  });

  if (errors.length > 0) return { error: `${MANIFEST_FILE} inválido:\n  - ${errors.join('\n  - ')}` };
  return { projects };
}
