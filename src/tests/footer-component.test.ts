// Project/App: GSD-2
// File Purpose: Regression tests for the interactive terminal footer renderer.

import test from "node:test";
import assert from "node:assert/strict";
import { stripVTControlCharacters } from "node:util";
import { FooterComponent } from "../../packages/pi-coding-agent/src/modes/interactive/components/footer.ts";
import { initTheme } from "../../packages/pi-coding-agent/src/modes/interactive/theme/theme.ts";

initTheme("dark", false);

test("FooterComponent renders a plain Pi-style footer with extension statuses on the pwd row", () => {
  const footer = new FooterComponent(
    {
      state: {
        model: { id: "test-model", provider: "test", contextWindow: 1000 },
      },
      sessionManager: {
        getUsageTotals: () => ({ input: 1200, output: 340, cacheRead: 300, cacheWrite: 100, cost: 0 }),
        getSessionName: () => undefined,
      },
      getContextUsage: () => ({ percent: 12.5, contextWindow: 1000 }),
      getLastTurnCost: () => 0,
      modelRegistry: {
        isUsingOAuth: () => false,
        getProviderAuthMode: () => "apiKey",
      },
    } as any,
    {
      getGitBranch: () => "main",
      getExtensionStatuses: () => new Map([["one", "ready"], ["two", "synced"]]),
      getAvailableProviderCount: () => 1,
    } as any,
  );

  const lines = footer.render(160).map((line) => stripVTControlCharacters(line));

  assert.equal(lines.length, 2);
  assert.doesNotMatch(lines.join("\n"), /[╭╮╰╯]/);
  assert.doesNotMatch(lines.join("\n"), /● GSD/);
  assert.match(lines[0], /\(main\)/);
  assert.match(lines[0], /ready synced\s*$/);
  assert.match(lines[1], /↑1\.2k/);
  assert.match(lines[1], /↓340/);
  assert.doesNotMatch(lines[1], /R300/);
  assert.doesNotMatch(lines[1], /W100/);
  assert.match(lines[1], /Hit 75\.0%/);
  assert.match(lines[1], /↑1\.2k ↓340 · Hit 75\.0%/);
  assert.match(lines[1], /12\.5%\/1\.0k/);
  assert.match(lines[1], /collapsed mode │ test-model\s*$/);
});

test("FooterComponent renders expanded display mode and model thinking without provider auth prefix", () => {
  const footer = new FooterComponent(
    {
      state: {
        model: { id: "gpt-5.5", provider: "openai-codex", contextWindow: 1000, reasoning: true },
        thinkingLevel: "high",
      },
      sessionManager: {
        getUsageTotals: () => ({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 }),
        getSessionName: () => undefined,
      },
      getContextUsage: () => ({ percent: 0, contextWindow: 1000 }),
      getLastTurnCost: () => 0,
      modelRegistry: {
        isUsingOAuth: () => false,
        getProviderAuthMode: () => "apiKey",
      },
    } as any,
    {
      getGitBranch: () => undefined,
      getExtensionStatuses: () => new Map(),
      getAvailableProviderCount: () => 3,
    } as any,
  );

  footer.setToolOutputExpanded(true);
  const lines = footer.render(120).map((line) => stripVTControlCharacters(line));

  assert.match(lines[1], /expanded mode │ gpt-5\.5 · high\s*$/);
  assert.doesNotMatch(lines[1], /openai-codex/);
  assert.doesNotMatch(lines[1], /API key/);
});
