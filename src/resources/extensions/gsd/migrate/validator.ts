// Old .planning directory validator
// Pre-flight checks for minimum viable .planning directory.
// Pure functions, zero Pi dependencies — uses only Node built-ins + exported helpers.

import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import type { ValidationResult, ValidationIssue, ValidationSeverity } from './types.js';

function issue(file: string, severity: ValidationSeverity, message: string): ValidationIssue {
  return { file, severity, message };
}

function isDir(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Validate that a .planning directory has the minimum required structure.
 * Returns structured issues with severity levels:
 * - fatal: directory doesn't exist (migration cannot proceed)
 * - warning: optional files missing (migration can proceed with reduced data)
 */
export async function validatePlanningDirectory(path: string): Promise<ValidationResult> {
  const issues: ValidationIssue[] = [];

  // Check directory exists
  if (!existsSync(path) || !statSync(path).isDirectory()) {
    issues.push(issue(path, 'fatal', 'Directory does not exist'));
    return { valid: false, issues };
  }

  // ROADMAP.md — warn if missing (transformer falls back to filesystem phases)
  if (!existsSync(join(path, 'ROADMAP.md'))) {
    issues.push(issue('ROADMAP.md', 'warning',
      'ROADMAP.md not found — milestone structure will be inferred from phases/ directory',
    ));
  }

  // Optional files — warn if missing
  if (!existsSync(join(path, 'PROJECT.md'))) {
    issues.push(issue('PROJECT.md', 'warning', 'PROJECT.md not found — project metadata will be empty'));
  }

  if (!existsSync(join(path, 'REQUIREMENTS.md'))) {
    issues.push(issue('REQUIREMENTS.md', 'warning', 'REQUIREMENTS.md not found — requirements will be empty'));
  }

  if (!existsSync(join(path, 'STATE.md'))) {
    issues.push(issue('STATE.md', 'warning', 'STATE.md not found — state information will be empty'));
  }

  if (!existsSync(join(path, 'phases')) || !statSync(join(path, 'phases')).isDirectory()) {
    issues.push(issue('phases/', 'warning', 'phases/ directory not found — no phase data will be parsed'));
  }

  const milestonesDir = join(path, 'milestones');
  if (isDir(milestonesDir)) {
    const milestonePhaseDirs = readdirSync(milestonesDir).filter((entry) => isDir(join(milestonesDir, entry)) && /-phases$/i.test(entry));
    if (milestonePhaseDirs.length > 0) {
      issues.push(issue('milestones/', 'warning', `${milestonePhaseDirs.length} milestone phase dir(s) will be migrated`));
    }
  }

  if (isDir(join(path, 'decisions'))) {
    issues.push(issue('decisions/', 'warning', 'decisions/ files will be migrated into DECISIONS.md'));
  }

  if (isDir(join(path, 'seeds'))) {
    issues.push(issue('seeds/', 'warning', 'seeds/ files will be preserved in the migration legacy archive'));
  }

  const hasFatal = issues.some(i => i.severity === 'fatal');
  return { valid: !hasFatal, issues };
}
