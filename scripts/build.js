#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const target = process.argv[2];
const targets = new Set(['chrome', 'firefox']);

if (!targets.has(target)) {
  console.error('Usage: node scripts/build.js <chrome|firefox>');
  process.exit(1);
}

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'dist', target);
const manifestSource = target === 'firefox'
  ? 'manifest.firefox.json'
  : 'manifest.json';

const files = [
  'background.js',
  'content.js',
  'popup.css',
  'popup.html',
  'popup.js',
  'welcome.html',
  'welcome.js',
  'wayf.js',
  'PRIVACY.md'
];

const copyFile = (from, to) => {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
};

const copyDir = (from, to) => {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dest = path.join(to, entry.name);
    if (entry.isDirectory()) {
      copyDir(src, dest);
    } else if (entry.isFile()) {
      copyFile(src, dest);
    }
  }
};

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

for (const file of files) {
  copyFile(path.join(root, file), path.join(outDir, file));
}

copyDir(path.join(root, 'icons'), path.join(outDir, 'icons'));
copyFile(path.join(root, manifestSource), path.join(outDir, 'manifest.json'));

console.log(`Built ${target} extension in ${path.relative(root, outDir)}`);
