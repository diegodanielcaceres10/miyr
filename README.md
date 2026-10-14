# miyr
Reusable AI audit prompts and commands to keep personal projects consistent, secure and well-tested. Stack profiles for Angular, Node, Flutter, frontend and backend. Read-only by design; reports stay local.

## Usage

```bash
node bin/miyr.mjs audit <profile> [--cwd <path>] [--json]
```

Profiles: `core` (any project) and `angular` (includes `core`). Exit code `0` when every check passes, `1` when any check fails, `2` on invalid usage. Run `npm test` to execute the test suite.

## Checks

| ID | Profile | What it verifies |
|---|---|---|
| `core/package-scripts` | core | `start`, `build`, `test` and `lint` scripts exist in `package.json` |
| `core/editorconfig` | core | `.editorconfig` with `root = true` and the main keys in `[*]` |
| `core/readme` | core | README sections for installation, usage, build and tests |
| `core/license` | core | A non-empty `LICENSE` file |
| `core/ci-workflow` | core | A workflow on `push` or `pull_request` that runs lint, test and build |
| `angular/typescript-strict` | angular | Effective `strict: true` without weakened flags |
