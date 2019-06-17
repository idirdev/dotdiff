'use strict';

/**
 * @file tests/index.test.js
 * @description Tests for dotdiff.
 * @author idirdev
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  parseEnvFile,
  diffEnvFiles,
  maskValue,
  formatTable,
  formatJson,
  formatCompact,
  summary,
} = require('../src/index.js');

let tmpDir;

before(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dotdiff-test-'));
});

after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function write(name, content) {
  const p = path.join(tmpDir, name);
  fs.writeFileSync(p, content, 'utf8');
  return p;
}

describe('parseEnvFile', () => {
  it('parses basic key=value lines', () => {
    const f = write('basic.env', 'FOO=bar\nBAZ=123\n');
    const vars = parseEnvFile(f);
    assert.ok(vars.some((v) => v.key === 'FOO' && v.value === 'bar'));
    assert.ok(vars.some((v) => v.key === 'BAZ' && v.value === '123'));
  });

  it('skips comments and blank lines', () => {
    const f = write('skip.env', '# skip me\n\nFOO=bar\n');
    const vars = parseEnvFile(f);
    assert.equal(vars.length, 1);
    assert.equal(vars[0].key, 'FOO');
  });

  it('strips quoted values', () => {
    const f = write('quoted.env', 'MSG="hello world"\n');
    const vars = parseEnvFile(f);
    assert.equal(vars[0].value, 'hello world');
  });

  it('strips export prefix', () => {
    const f = write('export.env', 'export KEY=val\n');
    const vars = parseEnvFile(f);
    assert.equal(vars[0].key, 'KEY');
    assert.equal(vars[0].value, 'val');
  });
});

describe('diffEnvFiles', () => {
  it('detects added keys', () => {
    const a = write('add-a.env', 'FOO=1\n');
    const b = write('add-b.env', 'FOO=1\nBAR=2\n');
    const diff = diffEnvFiles(a, b);
    assert.ok(diff.added.includes('BAR'));
  });

  it('detects removed keys', () => {
    const a = write('rem-a.env', 'FOO=1\nBAR=2\n');
    const b = write('rem-b.env', 'FOO=1\n');
    const diff = diffEnvFiles(a, b);
    assert.ok(diff.removed.includes('BAR'));
  });

  it('detects changed values', () => {
    const a = write('ch-a.env', 'KEY=old\n');
    const b = write('ch-b.env', 'KEY=new\n');
    const diff = diffEnvFiles(a, b);
    assert.equal(diff.changed.length, 1);
    assert.equal(diff.changed[0].valueA, 'old');
    assert.equal(diff.changed[0].valueB, 'new');
  });

  it('detects unchanged keys', () => {
    const a = write('unch-a.env', 'FOO=1\n');
    const b = write('unch-b.env', 'FOO=1\n');
    const diff = diffEnvFiles(a, b);
    assert.ok(diff.unchanged.includes('FOO'));
  });

  it('handles empty files', () => {
    const a = write('empty-a.env', '');
    const b = write('empty-b.env', '');
    const diff = diffEnvFiles(a, b);
    assert.equal(diff.added.length, 0);
    assert.equal(diff.removed.length, 0);
  });
});

describe('maskValue', () => {
  it('masks the middle of a value', () => {
    const masked = maskValue('supersecretvalue');
    assert.ok(masked.includes('*'));
    assert.notEqual(masked, 'supersecretvalue');
  });

  it('returns **** for very short values', () => {
    assert.equal(maskValue('ab'), '****');
  });

  it('returns **** for empty string', () => {
    assert.equal(maskValue(''), '****');
  });
});

describe('formatTable', () => {
  it('returns a string containing table borders', () => {
    const a = write('tbl-a.env', 'FOO=1\nBAR=2\n');
    const b = write('tbl-b.env', 'FOO=changed\nBAZ=3\n');
    const diff = diffEnvFiles(a, b);
    const table = formatTable(diff, { color: false });
    assert.ok(table.includes('|'));
    assert.ok(table.includes('KEY'));
  });

  it('returns "No differences." when diff is empty', () => {
    const result = formatTable({ added: [], removed: [], changed: [], unchanged: [] }, { color: false });
    assert.equal(result, 'No differences.');
  });
});

describe('formatJson', () => {
  it('returns valid JSON', () => {
    const diff = { added: ['X'], removed: [], changed: [], unchanged: [] };
    const json = formatJson(diff);
    const parsed = JSON.parse(json);
    assert.ok(parsed.added.includes('X'));
  });
});

describe('formatCompact', () => {
  it('shows + for added keys', () => {
    const diff = { added: ['NEW_KEY'], removed: [], changed: [], unchanged: [] };
    const out = formatCompact(diff);
    assert.ok(out.includes('+ NEW_KEY'));
  });

  it('shows - for removed keys', () => {
    const diff = { added: [], removed: ['OLD_KEY'], changed: [], unchanged: [] };
    const out = formatCompact(diff);
    assert.ok(out.includes('- OLD_KEY'));
  });
});

describe('summary', () => {
  it('returns correct counts', () => {
    const diff = {
      added: ['A'],
      removed: ['B', 'C'],
      changed: [{ key: 'D', valueA: '1', valueB: '2' }],
      unchanged: ['E'],
    };
    const s = summary(diff);
    assert.equal(s.addedCount, 1);
    assert.equal(s.removedCount, 2);
    assert.equal(s.changedCount, 1);
    assert.equal(s.unchangedCount, 1);
    assert.equal(s.identical, false);
  });

  it('marks identical when no changes', () => {
    const diff = { added: [], removed: [], changed: [], unchanged: ['X'] };
    const s = summary(diff);
    assert.equal(s.identical, true);
  });
});
