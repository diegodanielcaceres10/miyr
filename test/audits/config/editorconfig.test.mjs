import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../../../src/audits/config/editorconfig.mjs';
import { EDITORCONFIG, project } from '../../../test-support/project.mjs';

test('fails when .editorconfig is missing', () => {
  assert.equal(run({ cwd: project() }).status, 'fail');
});

test('passes with a complete configuration', () => {
  assert.equal(run({ cwd: project({ '.editorconfig': EDITORCONFIG }) }).status, 'pass');
});

test('fails when root = true is missing', () => {
  const content = EDITORCONFIG.replace('root = true', '');
  const result = run({ cwd: project({ '.editorconfig': content }) });
  assert.equal(result.status, 'fail');
  assert.match(result.message, /root = true/);
});

test('fails and lists the keys missing from the [*] section', () => {
  const content = 'root = true\n\n[*]\nindent_style = space\n';
  const result = run({ cwd: project({ '.editorconfig': content }) });
  assert.equal(result.status, 'fail');
  for (const key of ['indent_size', 'end_of_line', 'charset', 'insert_final_newline']) {
    assert.match(result.message, new RegExp(key));
  }
  assert.doesNotMatch(result.message, /indent_style/);
});

test('ignores keys defined only in other sections', () => {
  const content = `${EDITORCONFIG.split('[*]')[0]}[*.md]\ncharset = utf-8\nend_of_line = lf\nindent_style = space\nindent_size = 2\ninsert_final_newline = true\n`;
  assert.equal(run({ cwd: project({ '.editorconfig': content }) }).status, 'fail');
});

test('handles comments, CRLF line endings and key case', () => {
  const content = '# top\r\nROOT = true\r\n\r\n[*]\r\n; comment\r\nCharset = utf-8\r\nend_of_line = crlf\r\nindent_style = tab\r\nindent_size = 4\r\ninsert_final_newline = true\r\n';
  assert.equal(run({ cwd: project({ '.editorconfig': content }) }).status, 'pass');
});
