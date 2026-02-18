---
description: PowerShell command chaining rules
---

# PowerShell Command Chaining

**CRITICAL**: This workspace runs on Windows with PowerShell.

- **NEVER** use `&&` to chain commands — it is NOT valid in PowerShell.
- **ALWAYS** use `;` (semicolon) to chain multiple commands.

## Examples

```powershell
# ✅ CORRECT
git add -A; git status
git commit -m "message"; git push

# ❌ WRONG — will fail with "not a valid statement separator"
git add -A && git status
git commit -m "message" && git push
```
