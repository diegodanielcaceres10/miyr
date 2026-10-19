# miyr
Reusable AI audit prompts and commands to keep personal projects consistent, secure and well-tested. Stack profiles for Angular, Node, Flutter, frontend and backend. Read-only by design; reports stay local.

## Usage

```bash
node bin/miyr.mjs audit [folder] [--project <name> | --all | --choose]
```

`folder` is the folder that contains the `.miyr.json` manifest; without it the current folder is used. `--cwd <folder>` is an equivalent way to give it. Nothing is guessed: the folder and the project are explicit, and the profile of each project is declared in the manifest, not on the command line.

**The manifest is searched exactly in that folder, never in parent folders, and nothing is audited without it.** If it is missing, miyr stops with exit code `2`, names the folder it searched and analyzes nothing. Then the manifest is validated (every `path` must exist, every `profile` must be known, names must be unique) and the project is selected.

| Command | What happens |
|---|---|
| `audit ..\nura` and the manifest lists one project | That project is audited |
| `audit ..\nura` and it lists several, on a terminal | A numbered menu asks which one to audit, then continues with it |
| `audit ..\nura` and it lists several, without a terminal (CI, pipes) | Nothing is audited; the projects are listed with the commands to pick one (exit code `2`, on stderr) |
| `audit --project dashboard ..\nura` | Only the project named `dashboard` |
| `audit --all ..\nura` | Every project in the manifest |
| `audit --choose ..\nura` | Shows the menu even without a terminal; the answer is read from stdin |

The menu and the list of options go to stderr, so stdout only ever carries the report. In the menu, an empty answer or `q` cancels (exit code `2`).

A project of profile `node` or `angular` whose folder has no `package.json` gets a single failure (`config/project`) instead of one per check.

Profiles extend each other: `core` < `node` < `angular`. Exit code `0` when every check passes or is skipped, `1` when any check fails or errors, `2` on invalid usage or an invalid manifest. Run `npm test` to execute the test suite.

Repository-level files are looked up to the repository root, which is the nearest folder with `.git` above the folder given. Project files (`package.json`, lockfile, `tsconfig.json`) are read from the project folder. Searched from the project folder up to the repository root, nearest first: `README`, `LICENSE`, `.editorconfig`, `.nvmrc`, and every `.gitignore` in the chain. Workflows are only read from `<root>/.github/workflows`, as GitHub does.

### Network (`--online`)

By default miyr works only on your files, so a run is reproducible. A few checks can only be answered with outside data; they are skipped (`[SKIP]`) unless you pass `--online`. Today there is one: `config/angular-version`, which asks the npm registry for the latest stable version of `@angular/core` (the `latest` dist-tag, so prereleases never count). Only the public package name is sent; no code or results leave your machine. The registry is asked once per run, however many projects are audited, and only if a selected project needs it.

With `--online`, an unreachable or invalid registry is reported as an error (`[ERR ]`) rather than silently skipped, because you asked for the comparison. Set `MIYR_REGISTRY_URL` to use another registry, such as a corporate mirror.

### Output

The text report has one block per project, grouped by area (Configuración, Tipado, CI/CD, Documentación). Every check shows its status, its title and its stable id, so you can refer to it, for example `config/node-version`. Passing checks take a single line; failures always show the message, the evidence and the suggested fix, and their severity in brackets (`[crítica]`, `[alta]`, `[media]` or `[baja]`). A `[SKIP]` check could not be verified (for example, it needs the network); it shows why, does not fail the run and is counted apart. The last line is a `Resumen` with the totals.

| Option | Effect |
|---|---|
| `--online` | Let checks that need it query the npm registry (see below). Without it miyr never uses the network |
| `--verbose` | Also show the message of passing checks |
| `--color` / `--no-color` | Force or disable colors. By default they are used only on a terminal, and never when `NO_COLOR` is set |
| `--json` | Print `{ root, projects: [{ name, path, profile, results }] }`, never colored |

Colors only wrap the text, so the report is the same once they are removed. Unknown options are rejected.

## Project manifest

`.miyr.json` lives in the folder you give to miyr, normally the root of the audited repository, not in this repo. For a monorepo you run `audit <repo root>`; passing a subfolder such as `web` looks for a manifest inside `web`. It only says where each project lives and which profile applies. It cannot change rules. To keep it out of the audited repo's history, add it to `.git/info/exclude`.

```json
{
  "projects": [
    { "name": "web", "path": "web", "profile": "angular" },
    { "name": "landing", "path": "landing", "profile": "node" }
  ]
}
```

- `path` is relative to the folder that contains the manifest (`"."` is that folder) and must be an existing folder inside it.
- `profile` is one of the available profiles.
- `name` is optional (defaults to the path) and is what `--project` receives. Names and folders must be unique.
- Unknown keys are rejected, so a typo does not go unnoticed.
- The file may contain comments and trailing commas, like a hand-written `tsconfig.json`.

## Checks

Checks are grouped by area. The ID prefix is the area, and the profile is the lowest profile that runs the check. Every check has a level that sets its severity and the order in which results are listed, most important first:

| Level | Severity | Meaning |
|---|---|---|
| A | critical | Foundation of the environment: if it fails, nothing else is reliable |
| B | high | Build contract |
| C | medium | Code consistency |
| D | low | Repository hygiene |

The levels of `typing`, `ci` and `docs` checks are provisional until those areas are reviewed.

| ID | Profile | Level | What it verifies |
|---|---|---|---|
| `config/project` | node | A | The project folder has a `package.json` (a single failure instead of one per check) |
| `config/lockfile` | node | A | A single lockfile, committed, consistent with `packageManager` |
| `config/node-version` | node | A | `engines.node`, a `.nvmrc` or `.node-version` file, and `packageManager` |
| `config/dependencies` | node | A | No `*`/`latest` ranges, no duplicates, no dev tooling in `dependencies` |
| `config/angular-version` | angular | B | `@angular/core` is on the same major as the latest stable (needs `--online`; otherwise skipped, showing the version found). Fails, naming both versions and how many majors behind (medium severity for one, high for two or more). Also fails when another `@angular/*` package is on a different major. Reads the version from `package-lock.json`, or the declared range if there is none |
| `config/package-scripts` | node | B | `start`, `build`, `test` and `lint` scripts exist in `package.json` |
| `typing/typescript-strict` | angular | B | Effective `strict: true` without weakened flags |
| `ci/workflow` | node | B | A workflow on `push` or `pull_request` that runs lint, test and build |
| `docs/readme` | core | C | README sections for installation, usage, build and tests |
| `docs/license` | core | C | A non-empty `LICENSE` file |
| `config/gitignore` | node | D | `.gitignore` excludes `node_modules` |
| `config/package-metadata` | node | D | `name`, semver `version`, `private` (apps) and a `license` that matches `LICENSE` |
| `config/editorconfig` | core | D | `.editorconfig` with `root = true` and the main keys in `[*]` |
