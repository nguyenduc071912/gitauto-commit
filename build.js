#!/usr/bin/env node
// Build script - copies src to dist and makes executable
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, 'src', 'cli.js');
const distDir = path.join(__dirname, 'dist');
const dest = path.join(distDir, 'cli.js');

if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });

let code = fs.readFileSync(src, 'utf-8');
fs.writeFileSync(dest, code);

// Make executable on Unix
try {
  fs.chmodSync(dest, '755');
} catch {}

console.log('Build complete: dist/cli.js');
