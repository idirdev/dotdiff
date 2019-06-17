#!/usr/bin/env node
'use strict';

/**
 * @file bin/cli.js
 * @description CLI for dotdiff — side-by-side diff of .env files.
 * @author idirdev
 */

const { diffEnvFiles, formatTable, formatJson, formatCompact, summary } = require('../src/index.js');
const fs = require('fs');

const args = process.argv.slice(2);

function hasFlag(flag) {
  return args.includes(flag);
}

function printUsage() {
  console.log('Usage: dotdiff <fileA> <fileB> [--mask] [--json] [--compact]');
  console.log('');
  console.log('Options:');
  console.log('  --mask     Mask secret values in output');
  console.log('  --json     Output as JSON');
  console.log('  --compact  Compact one-line-per-change output');
}

const files = args.filter((a) => !a.startsWith('--'));
const fileA = files[0];
const fileB = files[1];

if (!fileA || !fileB) {
  console.error('Error: two file paths are required.');
  printUsage();
  process.exit(1);
}

if (!fs.existsSync(fileA)) {
  console.error(`Error: file not found: ${fileA}`);
  process.exit(1);
}

if (!fs.existsSync(fileB)) {
  console.error(`Error: file not found: ${fileB}`);
  process.exit(1);
}

const mask = hasFlag('--mask');
const jsonMode = hasFlag('--json');
const compact = hasFlag('--compact');

const diff = diffEnvFiles(fileA, fileB);
const stats = summary(diff);

if (jsonMode) {
  console.log(formatJson(diff));
} else if (compact) {
  console.log(formatCompact(diff, { mask }));
} else {
  console.log(formatTable(diff, { mask, color: true }));
}

console.log('');
console.log(
  `Summary: +${stats.addedCount} added, -${stats.removedCount} removed, ~${stats.changedCount} changed, =${stats.unchangedCount} unchanged`
);

if (stats.identical) {
  console.log('Files are identical.');
}
