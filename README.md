<!-- GSD Revamp - Project overview and setup guide -->

# GSD Revamp

GSD Revamp is a local-first coding agent for planning, implementing, verifying, and tracking software work from the command line.

This project is a standalone fork of GSD Pi. It keeps the practical GSD workflow, but moves the product direction toward a smaller, cleaner, and easier-to-maintain runtime.

The command remains `gsd`, and the in-session workflow command remains `/gsd`.

## Direction

GSD Revamp is built around a few constraints:

- Keep the workflow local-first and project-owned.
- Keep the runtime lightweight, explicit, and understandable.
- Prefer simple primitives over broad platform expansion.
- Avoid adding systems that make the project grow harder to reason about over time.
- Preserve the GSD workflow shape: milestones, slices, tasks, verification, and durable project state.
- Treat generated planning artifacts as project records, not hidden service state.

This is not a cosmetic rename of GSD Pi. Active development should treat `gsd-revamp` as its own product line.

## Status

The active baseline starts at version `1.0.0`.

Older upstream history may exist for traceability, but this repository should be reviewed and released from the `gsd-revamp` baseline forward.

## Install

Install from npm:

```bash
npm install -g gsd-revamp@latest
```

Run:

```bash
gsd
```

Source: [`qdzsh/gsd-revamp`](https://github.com/qdzsh/gsd-revamp).

## Migrate From Older Installs

If you previously installed `gsd-pi`, remove it first so the old global binary does not shadow the new package.

macOS / Linux:

```bash
npm uninstall -g gsd-pi
rm -f ~/.gsd/.update-check ~/.gsd/agent/managed-resources.json
npm install -g gsd-revamp@latest
which gsd
gsd --version
```

Windows PowerShell:

```powershell
npm uninstall -g gsd-pi
Remove-Item "$env:USERPROFILE\.gsd\.update-check" -Force -ErrorAction SilentlyContinue
Remove-Item "$env:USERPROFILE\.gsd\agent\managed-resources.json" -Force -ErrorAction SilentlyContinue
npm install -g gsd-revamp@latest
where.exe gsd
gsd --version
```

Routine upgrades use:

```bash
gsd upgrade
```

## Quick Start

Start GSD Revamp from your shell:

```bash
gsd
```

Then use slash commands inside the session:

```text
/gsd config
/gsd auto
/gsd quick "Describe the task"
/gsd status
```

GSD Revamp stores project planning and runtime state in `.gsd/`.

## What It Does

- Plans work into milestones, slices, and tasks.
- Runs coding sessions with project context and verification steps.
- Uses Git worktrees to isolate implementation work.
- Tracks project state in a local database with markdown projections for review.
- Supports provider integrations without making the workflow dependent on a hosted service.
- Produces artifacts such as plans, summaries, validation notes, and reports.

## Repository Layout

| Path | Purpose |
| --- | --- |
| `src/` | Core runtime resources and bundled extensions |
| `packages/` | Workspace packages used by the CLI, agent, TUI, RPC, and native bridge |
| `native/` | Native engine packaging and platform binaries |
| `docs/` | User and developer documentation |
| `scripts/` | Build, release, migration, and maintenance scripts |

## Development

```bash
npm ci
npm run build
npm test
```

For faster local checks:

```bash
npm run test:compile
npm run test:unit:compiled
npm run test:packages:compiled
```

Before opening a pull request, run:

```bash
npm run verify:fast
npm run verify:pr
```

## Versioning

The active public baseline starts at `1.0.0`.

Release notes should describe changes from the `gsd-revamp` baseline forward. Historical upstream refs are useful for auditing, but they are not the product narrative for this fork.

## License

MIT
