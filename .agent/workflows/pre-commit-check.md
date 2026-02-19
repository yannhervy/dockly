---
description: Always review staged files before committing to git
---

## Pre-Commit Check

Before every `git commit`, you MUST run:

// turbo
1. `git status` — review the list of staged/modified files
2. Carefully check for:
   - Debug or log files (e.g. `deploy_debug.txt`, `*.log`)
   - Files containing credentials, API keys, or secrets
   - Build artifacts or generated files (e.g. `out/`, `.next/`, `node_modules/`)
   - Boilerplate or template files that shouldn't be tracked
   - Any file that is in `.gitignore` but was force-added
3. If any suspicious files are found, alert the user BEFORE committing
4. Only proceed with `git add` and `git commit` after confirming the file list is clean
