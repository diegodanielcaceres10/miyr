import fs from 'node:fs';
import path from 'node:path';
import { readText } from './files.mjs';
import { parseJsonc } from './jsonc.mjs';

export const MANIFEST_FILE = '.miyr.json';

const TOP_KEYS = ['projects'];
const PROJECT_KEYS = ['name', 'path', 'profile'];
const NAME = /^[\w./-]+$/;
const posix = (p) => p.split(path.sep).join('/');

/** Message shown when the folder given to miyr has no manifest. */
export function missingManifestMessage(dir) {
  return [
    `No se encontró ${MANIFEST_FILE} en la carpeta indicada: ${dir}`,
    'miyr lo busca exactamente en la carpeta de --cwd (o en la actual), sin subir a carpetas superiores.',
  ].join('\n');
}

/**
 * Loads and validates <dir>/.miyr.json, where <dir> is exactly the folder given to miyr (it is never
 * searched in parent folders). The manifest only says WHERE each project lives and WHICH profile
 * applies, relative to <dir>; it cannot change rules. Returns { projects } or { error }.
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
    } else if (path.isAbsolute(entry.path)) {
      errors.push(`${where}: "path" debe ser relativo a la carpeta del manifiesto (${entry.path})`);
    } else {
      const resolved = path.resolve(dir, entry.path);
      rel = path.relative(dir, resolved);
      if (rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
        errors.push(`${where}: "path" sale de la carpeta del manifiesto (${entry.path})`);
      } else if (!fs.existsSync(resolved)) {
        errors.push(`${where}: no existe la carpeta ${entry.path}`);
      } else if (!fs.statSync(resolved).isDirectory()) {
        errors.push(`${where}: "${entry.path}" no es una carpeta`);
      } else if (dirs.has(resolved)) {
        errors.push(`${where}: carpeta repetida (${entry.path})`);
      } else {
        projectDir = resolved;
        dirs.add(resolved);
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

    if (projectDir && name !== null && profileNames.includes(entry.profile)) {
      projects.push({ name, path: posix(rel) || '.', dir: projectDir, profile: entry.profile });
    }
  });

  if (errors.length > 0) return { error: `${MANIFEST_FILE} inválido:\n  - ${errors.join('\n  - ')}` };
  return { projects };
}
