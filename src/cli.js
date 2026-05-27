#!/usr/bin/env node
// gitauto-commit - AI-powered conventional commit message generator
// Uses Google Gemini API (free tier) or falls back to smart local analysis

'use strict';

const { execSync, spawnSync } = require('child_process');
const https = require('https');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

// ─── Configuration ────────────────────────────────────────────────────────────
const CONFIG_FILE = path.join(process.env.HOME || process.env.USERPROFILE || '.', '.gitauto-config.json');
const VERSION = '1.0.0';
const GEMINI_API_BASE = 'generativelanguage.googleapis.com';

// ─── Colors ───────────────────────────────────────────────────────────────────
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgBlue: '\x1b[44m',
};

function colorize(text, ...colors) {
  return colors.map(color => c[color] || '').join('') + text + c.reset;
}

// ─── Config Management ────────────────────────────────────────────────────────
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    }
  } catch {}
  return {};
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// ─── Git Utilities ────────────────────────────────────────────────────────────
function isGitRepo() {
  try {
    execSync('git rev-parse --git-dir', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function getStagedDiff() {
  try {
    return execSync('git diff --cached --stat', { encoding: 'utf-8' }).trim();
  } catch {
    return '';
  }
}

function getStagedDiffDetailed() {
  try {
    // Limit diff size to avoid huge API calls
    const diff = execSync('git diff --cached', { encoding: 'utf-8' });
    return diff.slice(0, 4000); // Max 4000 chars
  } catch {
    return '';
  }
}

function getStagedFiles() {
  try {
    return execSync('git diff --cached --name-status', { encoding: 'utf-8' }).trim();
  } catch {
    return '';
  }
}

function doCommit(message) {
  try {
    const result = spawnSync('git', ['commit', '-m', message], {
      stdio: 'inherit',
      encoding: 'utf-8',
    });
    return result.status === 0;
  } catch {
    return false;
  }
}

// ─── Local AI Analysis (Fallback) ─────────────────────────────────────────────
function analyzeLocalChanges(files, stat) {
  const lines = files.split('\n').filter(Boolean);
  const types = {
    feat: 0, fix: 0, docs: 0, style: 0, refactor: 0, test: 0, chore: 0
  };
  const scopes = new Set();
  const changed = [];

  for (const line of lines) {
    const [status, ...fileParts] = line.split('\t');
    const file = fileParts.join('\t');
    if (!file) continue;
    changed.push({ status, file });

    const ext = path.extname(file).toLowerCase();
    const base = path.basename(file).toLowerCase();
    const dir = path.dirname(file).split('/')[0];

    // Detect scope from directory
    if (dir && dir !== '.') scopes.add(dir);

    // Detect type from file patterns
    if (base.includes('test') || base.includes('spec') || dir === 'test' || dir === '__tests__') {
      types.test++;
    } else if (['.md', '.txt', '.rst', '.adoc'].includes(ext) || base === 'readme') {
      types.docs++;
    } else if (['.css', '.scss', '.sass', '.less', '.styl'].includes(ext)) {
      types.style++;
    } else if (base.includes('config') || base.includes('setup') || base === '.gitignore' || base === 'package.json') {
      types.chore++;
    } else if (status === 'A') {
      types.feat++;
    } else if (status === 'M') {
      types.fix++;
    } else if (status === 'D') {
      types.refactor++;
    }
  }

  // Determine primary type
  const type = Object.entries(types).sort((a, b) => b[1] - a[1])[0][0];
  const scope = scopes.size === 1 ? [...scopes][0] : scopes.size > 1 ? 'multiple' : '';

  // Build description
  const addedFiles = changed.filter(f => f.status === 'A').map(f => path.basename(f.file));
  const modifiedFiles = changed.filter(f => f.status === 'M').map(f => path.basename(f.file));
  const deletedFiles = changed.filter(f => f.status === 'D').map(f => path.basename(f.file));

  let desc = '';
  if (addedFiles.length > 0 && type === 'feat') {
    desc = `add ${addedFiles.slice(0, 2).join(', ')}`;
    if (addedFiles.length > 2) desc += ` and ${addedFiles.length - 2} more`;
  } else if (modifiedFiles.length > 0 && type === 'fix') {
    desc = `update ${modifiedFiles.slice(0, 2).join(', ')}`;
    if (modifiedFiles.length > 2) desc += ` and ${modifiedFiles.length - 2} more`;
  } else if (type === 'docs') {
    desc = 'update documentation';
  } else if (type === 'test') {
    desc = 'add tests';
  } else if (type === 'chore') {
    desc = 'update configuration';
  } else {
    desc = 'update code';
  }

  const prefix = scope ? `${type}(${scope})` : type;
  return `${prefix}: ${desc}`;
}

// ─── Gemini API ───────────────────────────────────────────────────────────────
async function generateWithGemini(apiKey, diff, stat, files) {
  const prompt = `You are a git commit message generator. Generate a concise conventional commit message.

Rules:
- Format: <type>(<scope>): <description>
- Types: feat, fix, docs, style, refactor, test, chore, perf, ci, build, revert
- Scope is optional, use if clear from files
- Description: imperative mood, max 60 chars, no period
- Output ONLY the commit message, nothing else

Git stats:
${stat}

Changed files:
${files}

Diff (truncated):
${diff}

Commit message:`;

  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 100 }
    });

    const req = https.request({
      hostname: GEMINI_API_BASE,
      path: `/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) {
            reject(new Error(json.error.message));
            return;
          }
          const text = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          resolve(text || null);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ─── Interactive Prompt ───────────────────────────────────────────────────────
function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// ─── Display Helpers ──────────────────────────────────────────────────────────
function printBanner() {
  console.log('');
  console.log(colorize(' gitauto-commit ', 'bold', 'bgBlue', 'white') +
    colorize(` v${VERSION} `, 'dim') +
    colorize('AI commit message generator', 'cyan'));
  console.log('');
}

function printHelp() {
  console.log(`
${colorize('USAGE', 'bold', 'yellow')}
  ${colorize('gac', 'cyan')}                Generate commit message for staged changes
  ${colorize('gac --setup', 'cyan')}        Configure Gemini API key (free at aistudio.google.com)
  ${colorize('gac --dry-run', 'cyan')}      Preview message without committing
  ${colorize('gac --local', 'cyan')}        Use local analysis only (no API)
  ${colorize('gac --version', 'cyan')}      Show version
  ${colorize('gac --help', 'cyan')}         Show this help

${colorize('QUICK START', 'bold', 'yellow')}
  1. ${colorize('git add .', 'dim')}                    Stage your changes
  2. ${colorize('gac', 'dim')}                           Generate & commit

${colorize('FREE GEMINI API', 'bold', 'yellow')}
  Get a free API key at: ${colorize('https://aistudio.google.com', 'cyan')}
  Then run: ${colorize('gac --setup', 'cyan')}

${colorize('SPONSOR', 'bold', 'yellow')}
  If this tool saves you time, please sponsor:
  ${colorize('https://github.com/sponsors/nguyenduc071912', 'cyan')}
`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--version') || args.includes('-v')) {
    console.log(`gitauto-commit v${VERSION}`);
    return;
  }

  if (args.includes('--help') || args.includes('-h')) {
    printBanner();
    printHelp();
    return;
  }

  if (args.includes('--setup')) {
    printBanner();
    console.log(colorize('Setup Gemini API Key', 'bold', 'yellow'));
    console.log('Get a FREE key at: ' + colorize('https://aistudio.google.com', 'cyan'));
    console.log('');
    const key = await ask('Enter your Gemini API key: ');
    if (key) {
      const config = loadConfig();
      config.geminiApiKey = key;
      saveConfig(config);
      console.log(colorize('✓ API key saved! Run `gac` to generate commit messages.', 'green'));
    } else {
      console.log(colorize('No key entered. Using local analysis mode.', 'yellow'));
    }
    return;
  }

  // ── Check git repo
  if (!isGitRepo()) {
    console.error(colorize('Error: Not a git repository.', 'red'));
    process.exit(1);
  }

  const isDryRun = args.includes('--dry-run');
  const isLocal = args.includes('--local');

  printBanner();

  // ── Get staged changes
  const stat = getStagedDiff();
  const files = getStagedFiles();
  const diff = getStagedDiffDetailed();

  if (!stat && !files) {
    console.log(colorize('No staged changes found.', 'yellow'));
    console.log(colorize('Run `git add .` or `git add <file>` first.', 'dim'));
    process.exit(0);
  }

  // Show what's staged
  console.log(colorize('Staged changes:', 'bold'));
  console.log(colorize(stat || files, 'dim'));
  console.log('');

  // ── Generate commit message
  let message = null;
  const config = loadConfig();
  const apiKey = process.env.GEMINI_API_KEY || config.geminiApiKey;

  if (!isLocal && apiKey) {
    process.stdout.write(colorize('Generating with Gemini AI...', 'cyan'));
    try {
      message = await generateWithGemini(apiKey, diff, stat, files);
      process.stdout.write('\r' + ' '.repeat(40) + '\r'); // Clear line
      console.log(colorize('AI generated:', 'green', 'bold'));
    } catch (err) {
      process.stdout.write('\r' + ' '.repeat(40) + '\r');
      console.log(colorize(`Gemini failed (${err.message}), using local analysis...`, 'yellow'));
    }
  }

  if (!message) {
    message = analyzeLocalChanges(files, stat);
    console.log(colorize('Local analysis:', 'yellow', 'bold'));
  }

  // Show generated message
  console.log('  ' + colorize(message, 'cyan', 'bold'));
  console.log('');

  if (isDryRun) {
    console.log(colorize('[Dry run] Would commit with message above.', 'dim'));
    return;
  }

  // ── Ask for confirmation
  const answer = await ask(
    colorize('[a]', 'green') + 'ccept  ' +
    colorize('[e]', 'yellow') + 'dit  ' +
    colorize('[r]', 'cyan') + 'egenerate  ' +
    colorize('[c]', 'red') + 'ancel\n' +
    'Choice: '
  );

  if (answer === 'e' || answer === 'edit') {
    const edited = await ask(colorize('Edit message: ', 'yellow') + '\n> ');
    message = edited || message;
    if (doCommit(message)) {
      console.log(colorize(`✓ Committed: "${message}"`, 'green'));
    }
  } else if (answer === 'r' || answer === 'regenerate') {
    // Simple regeneration: re-run local with different heuristic
    message = analyzeLocalChanges(files, stat) + ' [updated]';
    console.log(colorize('Regenerated: ', 'cyan') + message);
    const confirm = await ask('Commit? [y/n]: ');
    if (confirm === 'y' && doCommit(message)) {
      console.log(colorize(`✓ Committed!`, 'green'));
    }
  } else if (answer === 'a' || answer === 'accept' || answer === '') {
    if (doCommit(message)) {
      console.log(colorize(`✓ Committed: "${message}"`, 'green'));
      console.log('');
      if (!apiKey) {
        console.log(colorize('Tip: ', 'dim') + 'Get better AI messages with `gac --setup` (free Gemini API)');
        console.log(colorize('Tip: ', 'dim') + 'Sponsor at https://github.com/sponsors/nguyenduc071912');
      }
    } else {
      console.log(colorize('Commit failed.', 'red'));
    }
  } else {
    console.log(colorize('Cancelled.', 'dim'));
  }
}

main().catch(err => {
  console.error(colorize(`Error: ${err.message}`, 'red'));
  process.exit(1);
});
