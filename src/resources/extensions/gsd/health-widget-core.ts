/**
 * Pure GSD health widget logic.
 *
 * Separates project-state detection and line rendering from the widget's
 * runtime integrations so the regressions can be tested directly.
 */

import { existsSync } from "node:fs";
import { detectProjectState } from "./detection.js";
import { gsdRoot } from "./paths.js";

export type HealthWidgetProjectState = "none" | "initialized" | "active";

export interface HealthWidgetData {
  projectState: HealthWidgetProjectState;
  budgetCeiling: number | undefined;
  budgetSpent: number;
  providerIssue: string | null;
  environmentErrorCount: number;
  environmentWarningCount: number;
  /** Unix epoch (seconds) of the last commit, or null if unavailable. */
  lastCommitEpoch: number | null;
  /** Subject line of the last commit, or null if unavailable. */
  lastCommitMessage: string | null;
  lastRefreshed: number;
}

export function detectHealthWidgetProjectState(basePath: string): HealthWidgetProjectState {
  if (!existsSync(gsdRoot(basePath))) return "none";

  const { state } = detectProjectState(basePath);
  return state === "v2-gsd" ? "active" : "initialized";
}

function formatCost(n: number): string {
  const value = Number.isFinite(Number(n)) ? Number(n) : 0;
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Format a Unix epoch (seconds) as a human-readable relative time string.
 * Returns "just now" for <1m, "Xm ago" for <1h, "Xh ago" for <24h, "Xd ago" otherwise.
 */
export function formatRelativeTime(epochSeconds: number): string {
  const diffSeconds = Math.floor(Date.now() / 1000) - epochSeconds;
  if (diffSeconds < 60) return "just now";
  const minutes = Math.floor(diffSeconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Truncate a rendered widget line to fit the terminal width.
 */
function truncateLine(line: string, width: number): string {
  if (width <= 0) return "";
  if (line.length <= width) return line;
  if (width === 1) return "…";
  return line.slice(0, width - 1) + "…";
}

/**
 * Build compact health lines for the widget.
 * All parts render left-to-right on one compact line.
 */
export function buildHealthLines(data: HealthWidgetData, width?: number): string[] {
  if (data.projectState === "none") {
    return ["GSD  No project loaded — run /gsd to start"];
  }

  if (data.projectState === "initialized") {
    return ["GSD  Project Initialized"];
  }

  const leftParts: string[] = [];
  leftParts.push(`Spent: ${formatCost(data.budgetSpent)}`);

  if (data.lastCommitEpoch !== null && data.lastCommitEpoch > 0) {
    const relTime = formatRelativeTime(data.lastCommitEpoch);
    const msg = data.lastCommitMessage ? ` — ${data.lastCommitMessage}` : "";
    leftParts.push(`Last commit: ${relTime}${msg}`);
  }

  const line = leftParts.join(" │ ");
  return [width === undefined ? line : truncateLine(line, width)];
}
