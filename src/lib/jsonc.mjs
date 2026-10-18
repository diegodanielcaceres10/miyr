/**
 * Replaces JSONC extras (// and block comments, trailing commas) with spaces. Every character keeps its
 * position, so a JSON.parse error still points to the right line and column of the original file.
 * A UTF-8 BOM is dropped.
 */
export function stripJsonc(text) {
  const src = text.replace(/^\uFEFF/, '');
  const out = [];
  let inString = false;
  let lastComma = -1; // index in `out` of a comma with nothing but whitespace after it

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    const next = src[i + 1];

    if (inString) {
      out.push(c);
      if (c === '\\') out.push(src[++i] ?? '');
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '/' && next === '/') {
      while (i < src.length && src[i] !== '\n') {
        out.push(' ');
        i++;
      }
      i--; // leave the newline for the next iteration
      continue;
    }
    if (c === '/' && next === '*') {
      out.push(' ', ' ');
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) {
        out.push(src[i] === '\n' ? '\n' : ' ');
        i++;
      }
      if (i < src.length) {
        out.push(' ', ' ');
        i++;
      }
      continue;
    }
    if (c === '"') {
      inString = true;
      lastComma = -1;
      out.push(c);
      continue;
    }
    if (c === ',') {
      lastComma = out.length;
      out.push(c);
      continue;
    }
    if (c === '}' || c === ']') {
      if (lastComma >= 0) out[lastComma] = ' ';
      lastComma = -1;
      out.push(c);
      continue;
    }
    if (!/\s/.test(c)) lastComma = -1;
    out.push(c);
  }
  return out.join('');
}

export const parseJsonc = (text) => JSON.parse(stripJsonc(text));
