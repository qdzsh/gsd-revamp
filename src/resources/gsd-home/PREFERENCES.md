---
version: 1
models:
  research: openai-codex/gpt-5.5
  planning: openai-codex/gpt-5.5
  discuss: openai-codex/gpt-5.5
  execution: openai-codex/gpt-5.5
  execution_simple: openai-codex/gpt-5.5
  validation: openai-codex/gpt-5.5
  completion: openai-codex/gpt-5.5
  subagent: openai-codex/gpt-5.5
unique_milestone_ids: true
service_tier: priority
verification_commands:
  - npm run lint
  - npm run test
verification_auto_fix: true
verification_max_retries: 3
context_management:
  compaction_threshold_percent: 0.75
---
# GSD Skill Preferences

See `~/.gsd/agent/extensions/gsd/docs/preferences-reference.md` for full field documentation and examples.
