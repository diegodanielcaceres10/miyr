import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEditorconfig } from '../../src/lib/editorconfig.mjs';

test('reads root and the keys of every section, lowercased', () => {
  const { root, sections } = parseEditorconfig('ROOT = true\n\n[*]\nIndent_Style = Space\nindent_size = 2\n\n[*.md]\nmax_line_length = off\n');
  assert.deepEqual(root, { root: 'true' });
  assert.deepEqual(sections['*'], { indent_style: 'space', indent_size: '2' });
  assert.deepEqual(sections['*.md'], { max_line_length: 'off' });
});

test('ignores comments, blank lines and CRLF, and accepts ":" as a separator', () => {
  const { sections } = parseEditorconfig('# top\r\n; also a comment\r\n\r\n[*]\r\nindent_size: 4\r\n');
  assert.deepEqual(sections['*'], { indent_size: '4' });
});

test('an empty file has no root and no sections', () => {
  assert.deepEqual(parseEditorconfig(''), { root: {}, sections: {} });
});
