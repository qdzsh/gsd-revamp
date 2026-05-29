"""Canonical constants for GSD thinking policy.

Ported from quangdo126/gsd-2 fork (preferences-types.ts) — single source of
truth for both the user-facing `gsd-thinking` CLI and the bootstrap apply /
heal flow.

Keep this file dependency-free so any Python script in ~/.gsd/agent/bin/
can `import _thinking_constants` without extra setup.
"""

from __future__ import annotations

# All valid thinking levels (lowercase, case-sensitive).
# Mirrors KNOWN_THINKING_LEVELS in preferences-types.ts.
KNOWN_LEVELS: frozenset[str] = frozenset({
    "off",
    "minimal",
    "low",
    "medium",
    "high",
    "xhigh",
})

# Canonical list of all dispatch unit types.
# Mirrors KNOWN_UNIT_TYPES in preferences-types.ts.
# Update this list whenever upstream gsd adds new unit types.
KNOWN_UNIT_TYPES: frozenset[str] = frozenset({
    # slice / milestone lifecycle
    "research-milestone", "plan-milestone", "research-slice", "plan-slice",
    "refine-slice", "execute-task", "execute-task-simple", "reactive-execute",
    "gate-evaluate", "complete-slice", "replan-slice", "reassess-roadmap",
    "run-uat", "complete-milestone", "validate-milestone", "rewrite-docs",
    "discuss-milestone", "discuss-slice", "worktree-merge",
    # Deep planning mode (project-level) units
    "workflow-preferences", "discuss-project", "discuss-requirements",
    "research-decision", "research-project",
})

# Canonical prefixes recognised by gsd's dispatch system. Keys end with `-`.
# Bootstrap patch script also uses these as smart fallbacks when no policy
# rule matches.
KNOWN_PREFIXES: frozenset[str] = frozenset({
    "research-", "discuss-", "plan-", "execute-", "complete-", "validate-",
    "refine-", "reassess-", "rewrite-", "replan-", "run-", "gate-",
    "worktree-", "reactive-", "workflow-",
})


def is_valid_level(level: str) -> bool:
    """Check whether a string is one of the canonical thinking levels."""
    return level in KNOWN_LEVELS


def is_known_unit_type(unit_type: str) -> bool:
    """Check whether a string is one of the canonical dispatch unit types."""
    return unit_type in KNOWN_UNIT_TYPES


def is_known_prefix(prefix: str) -> bool:
    """Check whether a prefix matches a known canonical dispatch prefix."""
    return prefix in KNOWN_PREFIXES
