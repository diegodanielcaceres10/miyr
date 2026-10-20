import path from 'node:path';
import { findUp } from '../../lib/context.mjs';
import { LICENSE_FILES, readText } from '../../lib/files.mjs';
import { loadPackage } from '../../lib/package-json.mjs';

export const id = 'config/package-metadata';
export const title = 'Metadatos de package.json';
export const profile = 'node';
export const level = 'D';

// Text signatures of common licenses, used to compare package.json with the LICENSE file.
const SIGNATURES = {
  MIT: /Permission is hereby granted, free of charge/i,
  'Apache-2.0': /Apache License\s+Version 2\.0/i,
  ISC: /Permission to use, copy, modify, and\/or distribute this software/i,
  'GPL-3.0': /GNU GENERAL PUBLIC LICENSE\s+Version 3/i,
  'AGPL-3.0': /GNU AFFERO GENERAL PUBLIC LICENSE\s+Version 3/i,
  'MPL-2.0': /Mozilla Public License,? (?:Version|v\.) 2\.0/i,
  Unlicense: /This is free and unencumbered software/i,
  'BSD-2-Clause': /Redistribution and use in source and binary forms/i,
  'BSD-3-Clause': /Redistribution and use in source and binary forms/i,
};

const SEMVER = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)*$/;
const PUBLISHABLE_KEYS = ['main', 'module', 'exports', 'bin', 'types'];

export function run(ctx) {
  const { pkg, failure } = loadPackage(ctx.cwd);
  if (failure) return { id, title, ...failure };

  const problems = [];
  if (typeof pkg.name !== 'string' || pkg.name.trim() === '') problems.push('name');
  if (typeof pkg.version !== 'string' || !SEMVER.test(pkg.version)) problems.push('version (semver)');
  // Apps must be private; packages meant to be published expose an entry point instead.
  if (pkg.private !== true && !PUBLISHABLE_KEYS.some((key) => key in pkg)) problems.push('private: true');

  if (typeof pkg.license !== 'string' || pkg.license.trim() === '') {
    problems.push('license');
  } else {
    const spdx = pkg.license.trim().replace(/-(?:only|or-later)$/, '').replace(/\+$/, '');
    const signature = SIGNATURES[spdx];
    const file = findUp(ctx, 'license', LICENSE_FILES);
    if (signature && file && !signature.test(readText(file))) {
      problems.push(`license "${pkg.license}" no coincide con ${path.basename(file)}`);
    }
  }

  if (problems.length > 0) {
    return {
      id, title, status: 'fail', evidence: { problems },
      message: `Metadatos incompletos o incoherentes: ${problems.join(', ')}.`,
      fix: 'Completa esos campos en package.json y alinea "license" con el archivo LICENSE.',
    };
  }

  return { id, title, status: 'pass', message: 'Metadatos de package.json correctos.' };
}
