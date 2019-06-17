'use strict';

/**
 * @module dotdiff
 * @description Side-by-side diff of .env files with color-coded output.
 * @author idirdev
 */

const fs = require('fs');

/**
 * Parse a .env file into an ordered array of { key, value } pairs.
 *
 * @param {string} filePath - Path to the .env file.
 * @returns {{ key: string, value: string }[]}
 */
function parseEnvFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const vars = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const stripped = trimmed.replace(/^export\s+/, '');
    const eqIdx = stripped.indexOf('=');
    if (eqIdx === -1) continue;

    const key = stripped.slice(0, eqIdx).trim();
    let value = stripped.slice(eqIdx + 1);

    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1).replace(/\\"/g, '"');
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }

    if (key) vars.push({ key, value });
  }

  return vars;
}

/**
 * Diff two .env files and categorize each key.
 *
 * @param {string} pathA - Path to the first .env file.
 * @param {string} pathB - Path to the second .env file.
 * @returns {{
 *   added: string[],
 *   removed: string[],
 *   changed: { key: string, valueA: string, valueB: string }[],
 *   unchanged: string[]
 * }}
 */
function diffEnvFiles(pathA, pathB) {
  const aItems = parseEnvFile(pathA);
  const bItems = parseEnvFile(pathB);
  const aMap = Object.fromEntries(aItems.map(({ key, value }) => [key, value]));
  const bMap = Object.fromEntries(bItems.map(({ key, value }) => [key, value]));
  const allKeys = new Set([...Object.keys(aMap), ...Object.keys(bMap)]);

  const added = [];
  const removed = [];
  const changed = [];
  const unchanged = [];

  for (const key of allKeys) {
    const inA = Object.prototype.hasOwnProperty.call(aMap, key);
    const inB = Object.prototype.hasOwnProperty.call(bMap, key);

    if (inA && !inB) {
      removed.push(key);
    } else if (!inA && inB) {
      added.push(key);
    } else if (aMap[key] !== bMap[key]) {
      changed.push({ key, valueA: aMap[key], valueB: bMap[key] });
    } else {
      unchanged.push(key);
    }
  }

  return { added, removed, changed, unchanged };
}

/**
 * Mask the middle portion of a secret value with asterisks.
 *
 * @param {string} value - The value to mask.
 * @returns {string}
 */
function maskValue(value) {
  if (!value || value.length <= 4) return '****';
  const keep = Math.max(1, Math.floor(value.length * 0.2));
  const start = value.slice(0, keep);
  const end = value.slice(-keep);
  const stars = '*'.repeat(Math.max(3, value.length - keep * 2));
  return start + stars + end;
}

/**
 * ANSI color helpers.
 */
const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';

function colorize(str, color) {
  return color + str + RESET;
}

/**
 * Format diff as an ASCII table with aligned columns.
 *
 * @param {{ added: string[], removed: string[], changed: { key: string, valueA: string, valueB: string }[], unchanged: string[] }} diff
 * @param {{ mask?: boolean, color?: boolean }} [opts={}]
 * @returns {string}
 */
function formatTable(diff, opts) {
  const options = opts || {};
  const mask = options.mask || false;
  const color = options.color !== false;

  const rows = [];

  for (const key of diff.unchanged) {
    rows.push({ status: '=', key, left: '', right: '', type: 'unchanged' });
  }
  for (const key of diff.removed) {
    rows.push({ status: '-', key, left: '(present)', right: '(missing)', type: 'removed' });
  }
  for (const key of diff.added) {
    rows.push({ status: '+', key, left: '(missing)', right: '(present)', type: 'added' });
  }
  for (const { key, valueA, valueB } of diff.changed) {
    const lv = mask ? maskValue(valueA) : valueA;
    const rv = mask ? maskValue(valueB) : valueB;
    rows.push({ status: '~', key, left: lv, right: rv, type: 'changed' });
  }

  if (rows.length === 0) return 'No differences.';

  // Sort: removed, added, changed, unchanged
  const order = { '-': 0, '+': 1, '~': 2, '=': 3 };
  rows.sort((a, b) => order[a.status] - order[b.status]);

  const keyLen = Math.max(3, ...rows.map((r) => r.key.length));
  const leftLen = Math.max(5, ...rows.map((r) => r.left.length));
  const rightLen = Math.max(5, ...rows.map((r) => r.right.length));

  const hr = '+' + '-'.repeat(keyLen + 2) + '+' + '-'.repeat(leftLen + 2) + '+' + '-'.repeat(rightLen + 2) + '+';
  const header = '| ' + 'KEY'.padEnd(keyLen) + ' | ' + 'FILE A'.padEnd(leftLen) + ' | ' + 'FILE B'.padEnd(rightLen) + ' |';

  const lines = [hr, header, hr];

  for (const row of rows) {
    let line = '| ' + row.key.padEnd(keyLen) + ' | ' + row.left.padEnd(leftLen) + ' | ' + row.right.padEnd(rightLen) + ' |';

    if (color) {
      if (row.type === 'added') line = colorize(line, GREEN);
      else if (row.type === 'removed') line = colorize(line, RED);
      else if (row.type === 'changed') line = colorize(line, YELLOW);
      else line = colorize(line, DIM);
    }

    lines.push(line);
  }

  lines.push(hr);
  return lines.join('\n');
}

/**
 * Format diff as a JSON string.
 *
 * @param {{ added: string[], removed: string[], changed: object[], unchanged: string[] }} diff
 * @returns {string}
 */
function formatJson(diff) {
  return JSON.stringify(diff, null, 2);
}

/**
 * Format diff as a compact single-line-per-change output.
 *
 * @param {{ added: string[], removed: string[], changed: { key: string, valueA: string, valueB: string }[], unchanged: string[] }} diff
 * @param {{ mask?: boolean }} [opts={}]
 * @returns {string}
 */
function formatCompact(diff, opts) {
  const options = opts || {};
  const mask = options.mask || false;
  const lines = [];

  for (const key of diff.removed) lines.push(`- ${key}`);
  for (const key of diff.added) lines.push(`+ ${key}`);
  for (const { key, valueA, valueB } of diff.changed) {
    const lv = mask ? maskValue(valueA) : valueA;
    const rv = mask ? maskValue(valueB) : valueB;
    lines.push(`~ ${key}: ${lv} → ${rv}`);
  }

  return lines.length > 0 ? lines.join('\n') : 'No differences.';
}

/**
 * Return a numeric summary of diff results.
 *
 * @param {{ added: string[], removed: string[], changed: object[], unchanged: string[] }} diff
 * @returns {{ addedCount: number, removedCount: number, changedCount: number, unchangedCount: number, identical: boolean }}
 */
function summary(diff) {
  const addedCount = diff.added.length;
  const removedCount = diff.removed.length;
  const changedCount = diff.changed.length;
  const unchangedCount = diff.unchanged.length;
  const identical = addedCount === 0 && removedCount === 0 && changedCount === 0;
  return { addedCount, removedCount, changedCount, unchangedCount, identical };
}

module.exports = {
  parseEnvFile,
  diffEnvFiles,
  maskValue,
  formatTable,
  formatJson,
  formatCompact,
  summary,
};
