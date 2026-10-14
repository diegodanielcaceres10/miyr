function toRegex(pattern) {
  const body = pattern.replace(/\/+$/, '').replace(/^\*\*\//, '').replace(/^\//, '');
  const source = body
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '\u0000')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replace(/\u0000/g, '.*');
  return new RegExp(`^${source}$`);
}

/**
 * True when a top-level file or directory is ignored by the given .gitignore text.
 * Basic glob support and negations; global or nested ignore files are not considered.
 */
export function isIgnored(text, name) {
  let ignored = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const negated = line.startsWith('!');
    if (toRegex(negated ? line.slice(1) : line).test(name)) ignored = !negated;
  }
  return ignored;
}
