import { lockedVersions } from '../../lib/lockfile-versions.mjs';
import { loadPackage } from '../../lib/package-json.mjs';

export const id = 'config/angular-version';
export const title = 'Angular en la última versión estable';
export const profile = 'angular';
export const level = 'B';
// Packages whose latest stable version must be fetched when miyr runs with --online.
export const latestPackages = ['@angular/core'];

const CORE = '@angular/core';
// Versioned on their own, so they are not compared with @angular/core.
const INDEPENDENT = new Set(['@angular/fire']);

// Major version of an exact version or of a range (its lower bound); null for tags, URLs or wildcards.
const majorOf = (text) => {
  const match = /^[\s^~>=<v]*(\d+)/.exec(String(text).trim());
  return match ? Number(match[1]) : null;
};
const majors = (count) => (count === 1 ? '1 versión mayor' : `${count} versiones mayores`);

export function run(ctx) {
  const { pkg, failure } = loadPackage(ctx.cwd);
  if (failure) return { id, title, ...failure };

  const declared = (name) => pkg.dependencies?.[name] ?? pkg.devDependencies?.[name];
  if (declared(CORE) === undefined) {
    return {
      id, title, status: 'fail',
      message: 'El proyecto no declara @angular/core.',
      fix: 'Revisa el perfil de este proyecto en .miyr.json o añade Angular al package.json.',
    };
  }

  const others = [...new Set([...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})])].filter(
    (name) => name.startsWith('@angular/') && name !== CORE && !INDEPENDENT.has(name),
  );
  const lock = lockedVersions(ctx.cwd, [CORE, ...others]);

  // The version the lockfile resolved wins over the range declared in package.json.
  const resolve = (name) => {
    const locked = lock?.versions[name];
    if (locked) return { text: locked, source: lock.file, major: majorOf(locked) };
    const text = declared(name);
    return { text, source: 'rango declarado en package.json', major: majorOf(text) };
  };

  const core = resolve(CORE);
  if (core.major === null) {
    return {
      id, title, status: 'skip',
      message: `No se pudo determinar la versión de @angular/core (${core.text}).`,
      fix: 'Fija una versión en package.json o instala las dependencias para generar el lockfile.',
    };
  }
  const current = `${core.text} (${core.source})`;

  const mismatched = others
    .map((name) => ({ name, ...resolve(name) }))
    .filter((p) => p.major !== null && p.major !== core.major)
    .map((p) => `${p.name} ${p.text} (${p.source}): otra versión mayor que @angular/core ${core.text}`);
  const evidence = mismatched.length > 0 ? { details: mismatched } : undefined;

  let behind = 0;
  let latest;
  if (ctx.online) {
    const entry = ctx.latest?.[CORE];
    if (!entry) return { id, title, status: 'error', message: 'No se consultó la última versión estable de @angular/core.' };
    if (entry.error) return { id, title, status: 'error', message: `No se pudo consultar la última versión estable: ${entry.error}.` };
    latest = entry.version;
    behind = majorOf(latest) - core.major;
  }

  if (behind >= 1) {
    return {
      id, title, status: 'fail', evidence,
      // One major behind is a warning sign; two or more, or a mixed set of packages, can break the build.
      severity: behind >= 2 || mismatched.length > 0 ? 'high' : 'medium',
      message: `Proyecto: ${current}. Última estable: ${latest}. Atraso: ${majors(behind)}.`,
      fix: 'Actualiza con "ng update @angular/core @angular/cli", una versión mayor cada vez.',
    };
  }
  if (mismatched.length > 0) {
    return {
      id, title, status: 'fail', evidence, severity: 'high',
      message: `Los paquetes @angular/* no comparten versión mayor con @angular/core ${core.text}.`,
      fix: 'Alinea esos paquetes con la versión de @angular/core (ng update).',
    };
  }
  if (!ctx.online) {
    return {
      id, title, status: 'skip',
      message: `Angular ${current}. No se comparó con la última estable: sin --online no se consulta el registro de npm.`,
      fix: 'Ejecuta con --online para compararla.',
    };
  }
  if (behind < 0) return { id, title, status: 'pass', message: `Angular ${current} está por delante de la última estable ${latest}.` };
  if (core.text === latest) return { id, title, status: 'pass', message: `Angular ${current} es la última estable.` };
  return { id, title, status: 'pass', message: `Angular ${current}; la última estable es ${latest} (misma versión mayor).` };
}
