# miyr
Reusable AI audit prompts and commands to keep personal projects consistent, secure and well-tested. Stack profiles for Angular, Node, Flutter, frontend and backend. Read-only by design; reports stay local.

## Usage

Two ways to say which project to audit. Neither guesses anything: the folder and the profile are always explicit.

```bash
# 1. In the command: one folder, one profile
node bin/miyr.mjs audit <profile> [--cwd <path>] [--json]

# 2. In the manifest (.miyr.json at the repository root): every project listed there
node bin/miyr.mjs audit [--project <name>] [--cwd <path>] [--json]
```

Profiles extend each other: `core` < `node` < `angular`. Exit code `0` when every check passes, `1` when any check fails, `2` on invalid usage or an invalid manifest. Run `npm test` to execute the test suite.

The repository root is the nearest folder with `.git`, looking upwards from `--cwd` (or from the current folder). Project files (`package.json`, lockfile, `tsconfig.json`) are read from the project folder. Repository-level files are searched from the project folder up to the repository root, nearest first: `README`, `LICENSE`, `.editorconfig`, `.nvmrc`, and every `.gitignore` in the chain. Workflows are only read from `<root>/.github/workflows`, as GitHub does.

### Output

The text report has one block per project, grouped by area (Configuración, Tipado, CI/CD, Documentación). Every check shows its status, its title and its stable id, so you can refer to it, for example `config/node-version`. Passing checks take a single line; failures always show the message, the evidence and the suggested fix. The last line is a `Resumen` with the totals.

| Option | Effect |
|---|---|
| `--verbose` | Also show the message of passing checks |
| `--color` / `--no-color` | Force or disable colors. By default they are used only on a terminal, and never when `NO_COLOR` is set |
| `--json` | Print `{ root, projects: [{ name, path, profile, results }] }`, never colored |

Colors only wrap the text, so the report is the same once they are removed. Unknown options are rejected.

## Project manifest

`.miyr.json` only says where each project lives and which profile applies. It cannot change rules.

```json
{
  "projects": [
    { "name": "web", "path": "web", "profile": "angular" },
    { "name": "landing", "path": "landing", "profile": "node" }
  ]
}
```

- `path` is relative to the repository root (`"."` is the root itself) and must be an existing folder inside the repository.
- `profile` is one of the available profiles.
- `name` is optional (defaults to the path) and is what `--project` receives. Names and folders must be unique.
- Unknown keys are rejected, so a typo does not go unnoticed.

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
