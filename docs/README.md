# GSD Documentation

Welcome to the GSD documentation. This covers everything from getting started to advanced configuration, auto-mode internals, and extending GSD with the Pi SDK.

## User Documentation

Guides for installing, configuring, and using GSD day-to-day. Located in [`user-docs/`](./user-docs/).

| Guide | Description |
|-------|-------------|
| [Getting Started](./user-docs/getting-started.md) | Installation, first run, and basic usage |
| [Auto Mode](./user-docs/auto-mode.md) | How autonomous execution works — the state machine, crash recovery, and steering |
| [Commands Reference](./user-docs/commands.md) | All commands, keyboard shortcuts, and CLI flags |
| [Remote Questions](./user-docs/remote-questions.md) | Discord and Slack integration for headless auto-mode |
| [Configuration](./user-docs/configuration.md) | Preferences, model selection, git settings, and token profiles |
| [Provider Setup](./user-docs/providers.md) | Step-by-step setup for OpenRouter, Ollama, LM Studio, vLLM, and all supported providers |
| [Custom Models](./user-docs/custom-models.md) | Advanced model configuration — models.json schema, compat flags, overrides |
| [Token Optimization](./user-docs/token-optimization.md) | Token profiles, context compression, complexity routing, and adaptive learning (v2.17) |
| [Dynamic Model Routing](./user-docs/dynamic-model-routing.md) | Complexity-based model selection, cost tables, escalation, and budget pressure (v2.19) |
| [Captures & Triage](./user-docs/captures-triage.md) | Fire-and-forget thought capture during auto-mode with automated triage (v2.19) |
| [Workflow Visualizer](./user-docs/visualizer.md) | Interactive TUI overlay for progress, dependencies, metrics, and timeline (v2.19) |
| [Cost Management](./user-docs/cost-management.md) | Budget ceilings, cost tracking, projections, and enforcement modes |
| [Git Strategy](./user-docs/git-strategy.md) | Worktree isolation, branching model, and merge behavior |
| [Parallel Orchestration](./user-docs/parallel-orchestration.md) | Run multiple milestones simultaneously with worker isolation and coordination |
| [Subagents](./user-docs/subagents.md) | Delegate, inspect, and resume isolated child-agent runs |
| [Working in Teams](./user-docs/working-in-teams.md) | Unique milestone IDs, `.gitignore` setup, and shared planning artifacts |
| [Skills](./user-docs/skills.md) | Bundled skills, skill discovery, and custom skill authoring |
| [Migration from v1](./user-docs/migration.md) | Migrating `.planning` directories from the original GSD |
| [Troubleshooting](./user-docs/troubleshooting.md) | Common issues, `/gsd doctor` (real-time visibility v2.40), `/gsd forensics` (full debugger v2.40), and recovery procedures |
| [Release Notes](../CHANGELOG.md) | Current v2.81 release notes and full version history |
