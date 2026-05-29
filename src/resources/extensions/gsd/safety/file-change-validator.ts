/**
 * Post-unit file change validator for auto-mode safety harness.
 * Compares actual git diff against the task plan's expected output files.
 *
 * Uses tasks.expected_output (DB column, populated from per-task ## Expected Output)
 * and tasks.files (from slice PLAN.md - Files: subline) as the expected set.
 * Prefers pending worktree/index changes and only falls back to HEAD when the
 * last commit can be attributed to the current unit.
 *
 * Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>
 */

import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { normalizePlannedFileReference } from "../files.js";
import { logWarning } from "../workflow-logger.js";

const _require = createRequire(import.meta.url);
type PicomatchMatcher = (input: string) => boolean;
type PicomatchFn = (pattern: string, opts?: { dot?: boolean }) => PicomatchMatcher;
const picomatch = _require("picomatch") as PicomatchFn;

// ─── Types ──────────────────────────────────────────────────────────────────

export interface FileViolation {
  severity: "info" | "warning";
  file: string;
  reason: string;
}

export interface FileChangeAudit {
  expectedFiles: string[];
  actualFiles: string[];
  unexpectedFiles: string[];
  missingFiles: string[];
  violations: FileViolation[];
}

type GitTextResult =
  | { ok: true; text: string }
  | { ok: false; reason: string };

type GitListResult =
  | { ok: true; files: string[] }
  | { ok: false; reason: string };

type CurrentUnitChangeSet =
  | { files: string[] }
  | { inspectionFailed: true; reason: string };

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Validate file changes after auto-commit for an execute-task unit.
 * Returns null if task data is unavailable or DB is not loaded.
 *
 * @param basePath - Working directory (worktree or project root)
 * @param expectedOutput - JSON array from tasks.expected_output DB column
 * @param plannedFiles - JSON array from tasks.files DB column
 */
export function validateFileChanges(
  basePath: string,
  expectedOutput: string[],
  plannedFiles: string[],
  fileChangeAllowlist: string[] = [],
  currentUnitId?: string,
  currentUnitStartedAt?: number,
): FileChangeAudit | null {
  const allExpected = new Set([...expectedOutput, ...plannedFiles]);

  // If no expected files were planned, skip validation
  if (allExpected.size === 0) return null;

  // Normalize expected paths (strip leading ./ or /)
  const normalizedExpected = new Set(
    [...allExpected].map((f) =>
      normalizePlannedFileReference(f).replace(/^\.\//, "").replace(/^\//, ""),
    ),
  );

  const changeSet = getChangedFilesForCurrentUnit(basePath, currentUnitId, currentUnitStartedAt);
  if (!changeSet) return null;
  if ("inspectionFailed" in changeSet) {
    return {
      expectedFiles: [...normalizedExpected],
      actualFiles: [],
      unexpectedFiles: [],
      missingFiles: [...normalizedExpected],
      violations: [{
        severity: "warning",
        file: "<git-inspection>",
        reason: `File-change validation unavailable: ${changeSet.reason}`,
      }],
    };
  }

  // Filter out .gsd/ internal files — only validate project source files
  const projectFiles = changeSet.files.filter(f => !f.startsWith(".gsd/") && !f.startsWith(".gsd\\"));

  // Build allowlist matchers once (dot: true so patterns like `**/.hidden` work).
  const allowlistMatchers = fileChangeAllowlist.map(p => picomatch(p, { dot: true }));
  const isAllowlisted = (f: string) => allowlistMatchers.some(m => m(f));

  // Compute symmetric difference, excluding allowlisted files
  const unexpectedFiles = projectFiles.filter(f => !normalizedExpected.has(f) && !isAllowlisted(f));
  const missingFiles = [...normalizedExpected].filter(f => !projectFiles.includes(f));

  const violations: FileViolation[] = [];

  for (const f of unexpectedFiles) {
    violations.push({
      severity: "warning",
      file: f,
      reason: "Modified but not in task plan's expected output",
    });
  }

  for (const f of missingFiles) {
    violations.push({
      severity: "info",
      file: f,
      reason: "Listed in task plan but not modified",
    });
  }

  return {
    expectedFiles: [...normalizedExpected],
    actualFiles: projectFiles,
    unexpectedFiles,
    missingFiles,
    violations,
  };
}

// ─── Internals ──────────────────────────────────────────────────────────────

function getChangedFilesForCurrentUnit(
  basePath: string,
  currentUnitId?: string,
  currentUnitStartedAt?: number,
): CurrentUnitChangeSet | null {
  const pendingFiles = getPendingChangedFiles(basePath);
  if ("inspectionFailed" in pendingFiles) return pendingFiles;
  if (pendingFiles.files.length > 0) return pendingFiles;

  if (!currentUnitId || !Number.isFinite(Number(currentUnitStartedAt))) {
    return getChangedFilesFromLastCommit(basePath);
  }

  const attribution = isLastCommitCurrentUnit(basePath, currentUnitId, currentUnitStartedAt);
  if (!attribution.ok) return { inspectionFailed: true, reason: attribution.reason };
  if (!attribution.matches) return null;

  return getChangedFilesFromLastCommit(basePath);
}

function getPendingChangedFiles(basePath: string): CurrentUnitChangeSet {
  const trackedFiles = runGitList(basePath, ["diff", "--name-only", "HEAD", "--"]);
  if (!trackedFiles.ok) return { inspectionFailed: true, reason: trackedFiles.reason };
  const untrackedFiles = runGitList(basePath, ["ls-files", "--others", "--exclude-standard"]);
  if (!untrackedFiles.ok) return { inspectionFailed: true, reason: untrackedFiles.reason };
  return { files: [...new Set([...trackedFiles.files, ...untrackedFiles.files])] };
}

function runGitList(basePath: string, args: string[]): GitListResult {
  const result = runGitText(basePath, args);
  if (!result.ok) return result;
  return { ok: true, files: result.text ? result.text.split("\n").filter(Boolean) : [] };
}

function runGitText(basePath: string, args: string[]): GitTextResult {
  try {
    const text = execFileSync(
      "git", args,
      {
        cwd: basePath,
        stdio: ["ignore", "pipe", "pipe"],
        encoding: "utf-8",
        timeout: 5000,
        maxBuffer: 10 * 1024 * 1024,
      },
    ).trim();
    return { ok: true, text };
  } catch (e) {
    const message = e instanceof Error ? e.message.split("\n", 1)[0] : String(e);
    const reason = `git ${args.join(" ")} failed: ${message}`;
    logWarning("safety", `${reason} in file-change-validator`);
    return { ok: false, reason };
  }
}

function isLastCommitCurrentUnit(
  basePath: string,
  currentUnitId?: string,
  currentUnitStartedAt?: number,
): { ok: true; matches: boolean } | { ok: false; reason: string } {
  const startedAt = Number(currentUnitStartedAt);
  if (!currentUnitId || !Number.isFinite(startedAt) || startedAt <= 0) {
    return { ok: true, matches: false };
  }

  const commitTime = runGitText(basePath, ["log", "-1", "--format=%ct"]);
  if (!commitTime.ok) return { ok: false, reason: commitTime.reason };
  const commitEpochSeconds = Number(commitTime.text);
  if (!Number.isFinite(commitEpochSeconds)) {
    return { ok: false, reason: "git log -1 --format=%ct returned a non-numeric timestamp" };
  }
  if (commitEpochSeconds < Math.floor(startedAt / 1000)) {
    return { ok: true, matches: false };
  }

  const message = runGitText(basePath, ["log", "-1", "--format=%B"]);
  if (!message.ok) return { ok: false, reason: message.reason };

  const parts = String(currentUnitId).split("/").filter(Boolean);
  const sliceTask = parts.length >= 3 ? `${parts[1]}/${parts[2]}` : undefined;
  const fullUnitTrailer = new RegExp(`^GSD-Unit:\\s*${escapeRegExp(String(currentUnitId))}\\s*$`, "m");
  if (fullUnitTrailer.test(message.text)) return { ok: true, matches: true };
  if (sliceTask) {
    const taskTrailer = new RegExp(`^GSD-Task:\\s*${escapeRegExp(sliceTask)}\\s*$`, "m");
    if (taskTrailer.test(message.text)) return { ok: true, matches: true };
  }
  return { ok: true, matches: false };
}

function getChangedFilesFromLastCommit(basePath: string): CurrentUnitChangeSet {
  const files = runGitList(basePath, ["diff-tree", "--root", "--no-commit-id", "-r", "--name-only", "HEAD"]);
  if (!files.ok) return { inspectionFailed: true, reason: files.reason };
  return { files: files.files };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
