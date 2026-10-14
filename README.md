# miyr
Reusable AI audit prompts and commands to keep personal projects consistent, secure and well-tested. Stack profiles for Angular, Node, Flutter, frontend and backend. Read-only by design; reports stay local.

## Usage

```bash
node bin/miyr.mjs audit <profile> [--cwd <path>] [--json]
```

Profiles extend each other: `core` < `node` < `angular`. Exit code `0` when every check passes, `1` when any check fails, `2` on invalid usage. Run `npm test` to execute the test suite.

## Checks

Checks are grouped by area. The ID prefix is the area, and the profile is the lowest level that runs the check.

| ID | Profile | What it verifies |
|---|---|---|
| `config/editorconfig` | core | `.editorconfig` with `root = true` and the main keys in `[*]` |
| `config/package-scripts` | node | `start`, `build`, `test` and `lint` scripts exist in `package.json` |
| `config/node-version` | node | `engines.node`, a `.nvmrc` or `.node-version` file, and `packageManager` |
| `config/lockfile` | node | A single lockfile, committed, consistent with `packageManager` |
| `config/package-metadata` | node | `name`, semver `version`, `private` (apps) and a `license` that matches `LICENSE` |
| `config/dependencies` | node | No `*`/`latest` ranges, no duplicates, no dev tooling in `dependencies` |
| `config/gitignore` | node | `.gitignore` excludes `node_modules` |
| `typing/typescript-strict` | angular | Effective `strict: true` without weakened flags |
| `ci/workflow` | node | A workflow on `push` or `pull_request` that runs lint, test and build |
| `docs/readme` | core | README sections for installation, usage, build and tests |
| `docs/license` | core | A non-empty `LICENSE` file |
