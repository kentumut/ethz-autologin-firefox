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
const sourceDir = path.join(root, 'src');
const outDir = path.join(root, 'dist', target);
const manifestSource = target === 'firefox'
  ? 'manifest.firefox.json'
  : 'manifest.json';

const files = [
  'background.js',
  'content.js',
  'logout-watch.js',
  'popup.css',
  'popup.html',
  'popup.js',
  'welcome.html',
  'welcome.js',
  'wayf.js'
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
  copyFile(path.join(sourceDir, file), path.join(outDir, file));
}

copyDir(path.join(sourceDir, 'icons'), path.join(outDir, 'icons'));
copyFile(path.join(sourceDir, manifestSource), path.join(outDir, 'manifest.json'));
copyFile(path.join(root, 'PRIVACY.md'), path.join(outDir, 'PRIVACY.md'));

console.log(`Built ${target} extension in ${path.relative(root, outDir)}`);
