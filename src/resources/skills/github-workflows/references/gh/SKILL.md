---
name: gh
description: "Install and configure the GitHub CLI (gh) for AI agent environments where gh may not be pre-installed and git remotes use local proxies instead of github.com. Provides auto-install script with SHA256 verification and GITHUB_TOKEN auth with anonymous fallback. Use when gh command not found, shutil.which(\"gh\") returns None, need GitHub API access (issues, PRs, releases, workflow runs), or repository operations fail with \"failed to determine base repo\" error. Documents required -R flag for all gh commands in proxy environments. Includes project management: GitHub Projects V2 (gh project), milestones (REST API), issue stories (lifecycle and templates), and label taxonomy management."
---
# GitHub CLI (gh) — Setup and Usage

## Purpose

Ensures the GitHub CLI (`gh`) is available and provides correct usage patterns for AI agents operating in environments where `gh` may not be pre-installed and where git remotes point to local proxies instead of `github.com`.

## When to Use

- `gh` command not found or `shutil.which("gh")` returns None
- Need to interact with GitHub API (issues, PRs, releases, workflows)
- Repository remote does not point to `github.com` (proxy environments)
- Need authenticated GitHub operations with `GITHUB_TOKEN`
- Managing GitHub Issues, Projects V2, Milestones, or Labels

---

## Installation

`gh` is assumed to be already installed via the system package manager:

- **macOS**: `brew install gh`
- **Windows**: `winget install GitHub.cli`
- **Linux (Debian/Ubuntu)**: `apt install gh`

For CI monitoring operations (watching workflow runs, checking statuses, waiting for jobs), use `ci_monitor.cjs`:

```bash
node src/resources/skills/github-workflows/references/gh/scripts/ci_monitor.cjs
```

---

## Authentication

`GITHUB_TOKEN` environment variable provides automatic authentication. No manual `gh auth login` needed.

```bash
# Verify authentication
gh auth status
```

If `GITHUB_TOKEN` is set, `gh` authenticates automatically for all API calls.

---

## Repository Detection

<repo_detection>

Git remote points to a local proxy (`127.0.0.1`), NOT `github.com`. Every `gh` command fails without explicit repo specification:

```text
failed to determine base repo: none of the git remotes configured for this
repository point to a known GitHub host.
```

**RULE: Pass `-R` (or `--repo`) on EVERY `gh` command:**

```bash
gh <command> -R qdzsh/gsd-revamp
```

This applies to ALL `gh` subcommands: `pr`, `issue`, `run`, `api`, `release`, `project`, etc.

</repo_detection>

---

## Common Commands (v2.87.0)

<gh_commands>

### Pull Requests

```bash
# List open PRs
gh pr list -R qdzsh/gsd-revamp

# View PR details
gh pr view <number> -R qdzsh/gsd-revamp

# Check PR CI status
gh pr checks <number> -R qdzsh/gsd-revamp

# Create PR
gh pr create -R qdzsh/gsd-revamp --title "title" --body "body"

# View PR comments
gh api repos/qdzsh/gsd-revamp/pulls/<number>/comments
```

### Issues

```bash
# List issues
gh issue list -R qdzsh/gsd-revamp

# List by label
gh issue list -R qdzsh/gsd-revamp --label "priority:p1" --state open

# Create issue with labels and milestone
# NOTE: Do NOT use labels for issue classification (bug, feature, etc.)
# Use labels for metadata (priority, status, auto-generated) only.
# Issue classification uses GitHub Issue Types, set via GraphQL after creation.
gh issue create -R qdzsh/gsd-revamp \
  --title "feat: add feature X" \
  --label "priority:p1" \
  --milestone "v1.0"

# View issue
gh issue view <number> -R qdzsh/gsd-revamp

# Close issue with comment
gh issue close <number> -R qdzsh/gsd-revamp --comment "Implemented in PR #N"

# Edit labels on issue
gh issue edit <number> -R qdzsh/gsd-revamp \
  --add-label "status:in-progress" \
  --remove-label "status:needs-grooming"
```

### Issue Types (Classification)

`gh issue create` has no `--type` flag. Issue types (Bug, Feature Request, etc.) are set via GraphQL after creation:

```bash
# Step 1: Create the issue (returns URL)
ISSUE_URL=$(gh issue create -R qdzsh/gsd-revamp \
  --title "..." --body "...")

# Step 2: Set the issue type via GraphQL
ISSUE_NUM=$(echo "$ISSUE_URL" | grep -oE '[0-9]+$')
ISSUE_ID=$(gh api graphql -f query='{ repository(owner:"gsd-revamp",name:"gsd-revamp") { issue(number:'"$ISSUE_NUM"') { id } } }' --jq '.data.repository.issue.id')
TYPE_ID=$(gh api graphql -f query='{ repository(owner:"gsd-revamp",name:"gsd-revamp") { issueTypes(first:20) { nodes { id name } } } }' --jq '.data.repository.issueTypes.nodes[] | select(.name=="Bug") | .id')
gh api graphql -f query='mutation { updateIssue(input:{id:"'"$ISSUE_ID"'",issueTypeId:"'"$TYPE_ID"'"}) { issue { number } } }'
```

Replace `"Bug"` with the appropriate type name (`"Feature Request"`, `"Task"`, etc.).

### Labels

```bash
# List all labels
gh label list -R qdzsh/gsd-revamp

# Create label
gh label create "priority:p1" --color "E99695" \
  --description "High priority" -R qdzsh/gsd-revamp
```

See [labels.md](./references/labels.md) for the full taxonomy and color codes.

### Projects V2

```bash
# List projects
gh project list --owner gsd-revamp

# Create project
gh project create --owner gsd-revamp --title "gsd-revamp Backlog"

# Add issue to project
gh project item-add 1 --owner gsd-revamp \
  --url https://github.com/qdzsh/gsd-revamp/issues/42
```

See [projects-v2.md](./references/projects-v2.md) for field creation and item editing commands.

### Milestones

`gh` has no native `milestone` subcommand — use `gh api` with the REST endpoint:

```bash
# List milestones
gh api repos/qdzsh/gsd-revamp/milestones

# Create milestone
gh api repos/qdzsh/gsd-revamp/milestones \
  -X POST -f title="v1.0" -f due_on="2026-03-31T00:00:00Z"

# Assign milestone to issue
gh api repos/qdzsh/gsd-revamp/issues/42 \
  -X PATCH -F milestone=1
```

See [milestones.md](./references/milestones.md) for full CRUD reference.

### Workflow Runs

```bash
# List recent runs
gh run list -R qdzsh/gsd-revamp --limit 5

# View specific run
gh run view <run-id> -R qdzsh/gsd-revamp

# View failed job logs
gh run view <run-id> -R qdzsh/gsd-revamp --log-failed
```

### Releases

```bash
# List releases
gh release list -R qdzsh/gsd-revamp

# View latest release
gh release view --repo qdzsh/gsd-revamp
```

### API (Direct)

```bash
# GET request
gh api repos/qdzsh/gsd-revamp

# POST with fields
gh api repos/qdzsh/gsd-revamp/issues -f title="Bug" -f body="Details"

# GraphQL
gh api graphql -f query='{ viewer { login } }'

# Paginated results
gh api repos/qdzsh/gsd-revamp/contributors --paginate
```

### Repository

```bash
# Clone
gh repo clone qdzsh/gsd-revamp

# View repo info
gh repo view -R qdzsh/gsd-revamp
```

</gh_commands>

---

## Output Formatting

```bash
# JSON output
gh pr list -R qdzsh/gsd-revamp --json number,title,state

# JQ filtering
gh pr list -R qdzsh/gsd-revamp --json number,title --jq '.[].title'

# Template formatting
gh pr list -R qdzsh/gsd-revamp --json number,title \
  --template '{{range .}}#{{.number}} {{.title}}{{"\n"}}{{end}}'
```

---

## Reference Files

- [labels.md](./references/labels.md) — Label taxonomy (priority, type, status), color codes, bulk setup
- [milestones.md](./references/milestones.md) — Milestone CRUD via REST API, naming conventions
- [projects-v2.md](./references/projects-v2.md) — GitHub Projects V2 commands, custom fields, GraphQL queries
- [issue-stories.md](./references/issue-stories.md) — Issue as story format, body template, lifecycle, backlog item field mapping

---

## Sources

- [GitHub CLI Manual](https://cli.github.com/manual) — official reference
- [GitHub CLI Releases](https://github.com/cli/cli/releases) — binary downloads
- [GitHub REST API — Issues](https://docs.github.com/en/rest/issues) — milestones, labels, issues
- [GitHub Projects V2 API](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-api-to-manage-projects) — GraphQL API
- `gh version 2.87.2 (2026-02-20)` — version verified by installation test
