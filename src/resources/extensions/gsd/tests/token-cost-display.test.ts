/**
 * Tests for the show_token_cost preference (#1515).
 *
 * Covers:
 *   - Preference recognition and validation
 *   - Cost formatting accuracy (inline re-implementation for test isolation)
 *   - Disabled-by-default behavior
 *   - Preference parsing from markdown frontmatter
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  validatePreferences,
  parsePreferencesMarkdown,
} from "../preferences.ts";
import { KNOWN_PREFERENCE_KEYS } from "../preferences-types.ts";

// Re-implement formatPromptCost here for test isolation (avoids pi-coding-agent build dep).
// The canonical implementation lives in footer.ts.
function formatPromptCost(cost: number): string {
  const n = Number.isFinite(Number(cost)) ? Number(cost) : 0;
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// ── Preference recognition ──────────────────────────────────────────────────

test("show_token_cost is a known preference key", () => {
  assert.ok(KNOWN_PREFERENCE_KEYS.has("show_token_cost"));
});

test("show_token_cost: true validates without errors", () => {
  const { errors, preferences } = validatePreferences({ show_token_cost: true });
  assert.equal(errors.length, 0);
  assert.equal(preferences.show_token_cost, true);
});

test("show_token_cost: false validates without errors", () => {
  const { errors, preferences } = validatePreferences({ show_token_cost: false });
  assert.equal(errors.length, 0);
  assert.equal(preferences.show_token_cost, false);
});

test("show_token_cost: non-boolean produces validation error", () => {
  const { errors } = validatePreferences({ show_token_cost: "yes" as any });
  assert.ok(errors.length > 0);
  assert.ok(errors[0].includes("show_token_cost"));
  assert.ok(errors[0].includes("boolean"));
});

test("show_token_cost does not produce unknown-key warning", () => {
  const { warnings } = validatePreferences({ show_token_cost: true });
  const unknownWarnings = warnings.filter(w => w.includes("show_token_cost"));
  assert.equal(unknownWarnings.length, 0);
});

// ── Disabled by default ─────────────────────────────────────────────────────

test("show_token_cost defaults to undefined (disabled) when not set", () => {
  const { preferences } = validatePreferences({});
  assert.equal(preferences.show_token_cost, undefined);
});

test("empty PREFERENCES.md does not enable show_token_cost", () => {
  const prefs = parsePreferencesMarkdown("---\nversion: 1\n---\n");
  assert.ok(prefs);
  assert.equal(prefs.show_token_cost, undefined);
});

test("PREFERENCES.md with show_token_cost: true enables the preference", () => {
  const prefs = parsePreferencesMarkdown("---\nshow_token_cost: true\n---\n");
  assert.ok(prefs);
  assert.equal(prefs.show_token_cost, true);
});

// ── Cost formatting ─────────────────────────────────────────────────────────

test("formatPromptCost formats sub-cent amounts with 2 decimals", () => {
  assert.equal(formatPromptCost(0.0003), "$0.00");
  assert.equal(formatPromptCost(0.0009), "$0.00");
});

test("formatPromptCost formats cent-range amounts with 2 decimals", () => {
  assert.equal(formatPromptCost(0.003), "$0.00");
  assert.equal(formatPromptCost(0.012), "$0.01");
  assert.equal(formatPromptCost(0.1), "$0.10");
});

test("formatPromptCost formats dollar-range amounts with 2 decimals", () => {
  assert.equal(formatPromptCost(1.5), "$1.50");
  assert.equal(formatPromptCost(12.345), "$12.35");
  assert.equal(formatPromptCost(99345.12), "$99,345.12");
});

test("formatPromptCost handles zero", () => {
  assert.equal(formatPromptCost(0), "$0.00");
});

// ── Cost calculation correctness ────────────────────────────────────────────

test("cost calculation formula matches Model cost structure", () => {
  // Simulates: usage.input * model.cost.input / 1_000_000 + usage.output * model.cost.output / 1_000_000
  // Model.cost fields are $/million tokens
  const modelCost = { input: 15, output: 75, cacheRead: 1.5, cacheWrite: 18.75 }; // claude-opus-4 pricing
  const usage = { input: 2000, output: 500, cacheRead: 10000, cacheWrite: 1000 };

  const cost =
    (usage.input * modelCost.input / 1_000_000) +
    (usage.output * modelCost.output / 1_000_000) +
    (usage.cacheRead * modelCost.cacheRead / 1_000_000) +
    (usage.cacheWrite * modelCost.cacheWrite / 1_000_000);

  // 2000*15/1M + 500*75/1M + 10000*1.5/1M + 1000*18.75/1M
  // = 0.03 + 0.0375 + 0.015 + 0.01875 = 0.10125
  assert.ok(Math.abs(cost - 0.10125) < 0.0001, `Expected ~$0.10125 but got $${cost}`);
  assert.equal(formatPromptCost(cost), "$0.10");
});
