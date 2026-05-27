# gitauto-commit

> **AI-powered git commit message generator** — Generate perfect [Conventional Commits](https://www.conventionalcommits.org/) from your staged changes in seconds.

[![npm version](https://img.shields.io/npm/v/gitauto-commit.svg)](https://www.npmjs.com/package/gitauto-commit)
[![npm downloads](https://img.shields.io/npm/dm/gitauto-commit.svg)](https://www.npmjs.com/package/gitauto-commit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub Sponsors](https://img.shields.io/github/sponsors/nguyenduc071912)](https://github.com/sponsors/nguyenduc071912)

---

## ✨ Features

- **Zero config** — Works out of the box with smart local analysis
- **AI-powered** — Optional free Gemini API key for smarter messages
- **Conventional Commits** — Always generates `feat:`, `fix:`, `docs:` etc.
- **Interactive** — Accept, edit, or regenerate before committing
- **Fast** — Runs locally, no build tools, no dependencies
- **Cross-platform** — Windows, macOS, Linux

---

## 📦 Install

```bash
npm install -g gitauto-commit
```

That's it. No setup required.

---

## 🚀 Usage

```bash
# Stage your changes
git add .

# Generate and commit
gac
```

### Commands

```
gac                 Generate commit message for staged changes
gac --setup         Configure Gemini API key (optional, for smarter messages)
gac --dry-run       Preview message without committing
gac --local         Use local analysis only (no API call)
gac --help          Show help
gac --version       Show version
```

### Example Output

```
 gitauto-commit  v1.0.0  AI commit message generator

Staged changes:
 3 files changed, 142 insertions(+), 5 deletions(-)

AI generated:
  feat(auth): add Google OAuth login with session management

[a]ccept  [e]dit  [r]egenerate  [c]ancel
Choice: a

✓ Committed: "feat(auth): add Google OAuth login with session management"
```

---

## 🔑 Optional: Free Gemini API (Better Messages)

For smarter, context-aware commit messages:

1. Get a **free** API key at [aistudio.google.com](https://aistudio.google.com)
2. Run `gac --setup` and paste your key
3. Done — AI messages from now on

> **Free tier:** 15 requests/minute, 1M tokens/day — more than enough for daily development.

---

## 🆚 Local vs AI Mode

| Feature | Local Mode | AI Mode (Gemini) |
|---------|-----------|-----------------|
| Speed | Instant | ~1-2 seconds |
| Internet required | No | Yes |
| Accuracy | Good | Excellent |
| Cost | Free | Free (with API key) |
| Works offline | ✅ | ❌ |

---

## 💡 How It Works

**Local mode (default):**
- Analyzes `git diff --cached --name-status`
- Detects change type from file extensions and directories
- Infers scope from directory structure
- Generates conventional commit format

**AI mode:**
- Sends diff summary to Gemini Flash API
- Returns context-aware message in <2 seconds
- Falls back to local mode on API error

---

## ⚙️ Configuration

Config is stored in `~/.gitauto-config.json`:

```json
{
  "geminiApiKey": "your-api-key-here"
}
```

Or use environment variable:

```bash
export GEMINI_API_KEY="your-key"
gac
```

---

## 📊 Why Conventional Commits?

- **Automated changelogs** with tools like `conventional-changelog`
- **Semantic versioning** — know when to bump major/minor/patch
- **Better git history** — understand changes at a glance
- **Required by** many popular open-source projects

---

## ❤️ Sponsor

If `gitauto-commit` saves you time, please consider sponsoring:

**[→ GitHub Sponsors](https://github.com/sponsors/nguyenduc071912)**

Even $1/month helps maintain and improve this tool.

---

## 🤝 Contributing

PRs welcome! See [CONTRIBUTING.md](CONTRIBUTING.md).

```bash
git clone https://github.com/nguyenduc071912/gitauto-commit.git
cd gitauto-commit
node src/cli.js --help
```

---

## 📄 License

MIT © [nguyenduc071912](https://github.com/nguyenduc071912)
