import path from 'node:path';
import { readText } from './files.mjs';
import { parseJsonc } from './jsonc.mjs';

// The only options miyr looks at.
const WANTED = ['printWidth', 'tabWidth', 'useTabs', 'endOfLine'];
const CODE = /\.[cm]?[jt]s$/i;

function scalar(raw) {
  const value = raw.replace(/\s+#.*$/, '').trim();
  const unquoted = value.replace(/^(['"])(.*)\1$/, '$2');
  if (unquoted !== value) return unquoted;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return /^-?\d+(?:\.\d+)?$/.test(value) ? Number(value) : value;
}

// Top-level `key: value` (YAML) or `key = value` (TOML) lines; nested blocks and sections are skipped.
function simplePairs(text, separator, { stopAtSection }) {
  const pairs = {};
  for (const line of text.split(/\r?\n/)) {
    if (stopAtSection && /^\s*\[/.test(line)) break;
    const match = line.match(new RegExp(`^([A-Za-z]+)\\s*${separator}\\s*(.+?)\\s*$`));
    if (match && !match[2].startsWith('#')) pairs[match[1]] = scalar(match[2]);
  }
  return pairs;
}

const pick = (object) => Object.fromEntries(WANTED.filter((key) => key in object).map((key) => [key, object[key]]));

/**
 * The Prettier options miyr compares, read from a config file in `dir` or from the "prettier" key of package.json.
 * Returns { options } or { unreadable: reason }. Files of code are never executed.
 */
export function readPrettierOptions(dir, file) {
  const full = path.join(dir, file);
  try {
    if (file === 'package.json') {
      const value = parseJsonc(readText(full)).prettier;
      if (typeof value === 'string') return { unreadable: `usa una configuración compartida (${value})` };
      return typeof value === 'object' && value !== null ? { options: pick(value) } : { unreadable: 'no hay clave "prettier"' };
    }
    if (CODE.test(file)) return { unreadable: `${file} es un archivo de código y miyr no ejecuta código del proyecto` };

    const text = readText(full);
    if (/\.ya?ml$/i.test(file) || file === '.prettierrc') {
      if (file === '.prettierrc') {
        try {
          return { options: pick(parseJsonc(text)) };
        } catch {
          // Not JSON: it may be YAML.
        }
      }
      const pairs = simplePairs(text, ':', { stopAtSection: false });
      if (text.trim() !== '' && Object.keys(pairs).length === 0) return { unreadable: `no se pudo leer ${file}` };
      return { options: pick(pairs) };
    }
    if (/\.toml$/i.test(file)) return { options: pick(simplePairs(text, '=', { stopAtSection: true })) };
    return { options: pick(parseJsonc(text)) };
  } catch {
    return { unreadable: `no se pudo leer ${file}` };
  }
}
