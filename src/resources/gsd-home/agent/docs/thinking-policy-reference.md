# GSD Thinking Policy Reference

Single source of truth for per-unit thinking levels. Current `gsd-pi` reads
`~/.gsd/agent/thinking-policy.json` natively during auto model selection.

## Files

| Path | Role |
|------|------|
| `~/.gsd/agent/thinking-policy.json` | User policy (canonical) |
| `~/.gsd/agent/bin/gsd-thinking` | CLI to view/edit/validate the policy |
| `~/.gsd/agent/bin/_thinking_constants.py` | Shared canonical constants |
| `~/.gsd/agent/extensions/gsd/auto-model-selection.js` | Runtime reader for the policy |

## Levels

`off`, `minimal`, `low`, `medium`, `high`, `xhigh` (lowercase, case-sensitive).

## Resolution order

When GSD picks a thinking level for a unit type, the patched runtime applies:

1. `unitTypes[unitType]` — exact match (highest priority).
2. `prefixes` — longest matching key wins (e.g. `plan-slice` matches `plan-slice-` over `plan-`).
3. Hardcoded fallback for `research-`, `discuss-`, `plan-` prefixes → `xhigh`
   (only fires when no policy entry matches; lets the patch behave sensibly even
   if the policy file is wiped).
4. Retry context (`isRetry: true`) → `xhigh`.
5. Heavy routing tier → `xhigh`.
6. `policy.default` → otherwise `medium`.

The `off` level is treated as a real value, not "no override": setting
`execute-task: off` deliberately disables thinking for that unit.

## Known unit types (exact-match keys for `unitTypes`)

```
research-milestone, plan-milestone, research-slice, plan-slice,
refine-slice, execute-task, execute-task-simple, reactive-execute,
gate-evaluate, complete-slice, replan-slice, reassess-roadmap,
run-uat, complete-milestone, validate-milestone, rewrite-docs,
discuss-milestone, discuss-slice, worktree-merge,
workflow-preferences, discuss-project, discuss-requirements,
research-decision, research-project
```

Add a typo and `gsd-thinking set` rejects it; pass `--force` to override.

## Known prefixes (keys for `prefixes`, must end with `-`)

```
research-, discuss-, plan-, execute-, complete-, validate-,
refine-, reassess-, rewrite-, replan-, run-, gate-,
worktree-, reactive-, workflow-
```

## Default policy (seeded on first patch run)

```json
{
  "default": "medium",
  "prefixes": {
    "research-": "medium",
    "discuss-": "high",
    "plan-": "xhigh"
  },
  "unitTypes": {
    "execute-task": "off",
    "execute-task-simple": "off",
    "reactive-execute": "off",
    "replan-slice": "high"
  }
}
```

## CLI

```sh
gsd-thinking show                 # print current policy
gsd-thinking set plan xhigh       # shortcut: prefixes.plan- -> xhigh
gsd-thinking set plan-slice high  # exact unit type
gsd-thinking set worktree- low    # custom prefix (must be in KNOWN_PREFIXES)
gsd-thinking set foo high --force # override KNOWN_* validation
gsd-thinking remove execute-task  # drop one override
gsd-thinking validate             # report invalid entries (non-mutating)
gsd-thinking lint                 # auto-prune invalid entries
gsd-thinking reset                # restore default policy
```

Shortcuts: `default`, `research`, `discuss`, `plan`, `execute`, `replan`.

## Verification

Run a normal GSD unit and inspect the selected model/reasoning lines in the
session output or logs.
