import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

import {
  ModelPolicyDispatchBlockedError,
  resolvePolicyThinkingLevel,
  resolvePreferredModelConfig,
  resolvePreferredThinkingLevel,
  resolveModelId,
  selectAndApplyModel,
} from "../auto-model-selection.js";

function makeTempDir(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

test("resolvePreferredModelConfig synthesizes heavy routing ceiling when models section is absent", () => {
  const originalCwd = process.cwd();
  const originalGsdHome = process.env.GSD_HOME;
  const tempProject = makeTempDir("gsd-routing-project-");
  const tempGsdHome = makeTempDir("gsd-routing-home-");

  try {
    mkdirSync(join(tempProject, ".gsd"), { recursive: true });
    writeFileSync(
      join(tempProject, ".gsd", "PREFERENCES.md"),
      [
        "---",
        "dynamic_routing:",
        "  enabled: true",
        "  tier_models:",
        "    light: claude-haiku-4-5",
        "    standard: claude-sonnet-4-6",
        "    heavy: claude-opus-4-6",
        "---",
      ].join("\n"),
      "utf-8",
    );
    process.env.GSD_HOME = tempGsdHome;
    process.chdir(tempProject);

    const config = resolvePreferredModelConfig("plan-slice", {
      provider: "anthropic",
      id: "claude-sonnet-4-6",
    });

    assert.deepEqual(config, {
      primary: "claude-opus-4-6",
      fallbacks: [],
      source: "synthesized",
    });
  } finally {
    process.chdir(originalCwd);
    if (originalGsdHome === undefined) delete process.env.GSD_HOME;
    else process.env.GSD_HOME = originalGsdHome;
    rmSync(tempProject, { recursive: true, force: true });
    rmSync(tempGsdHome, { recursive: true, force: true });
  }
});

test("resolvePreferredModelConfig falls back to auto start model when heavy tier is absent", () => {
  const originalCwd = process.cwd();
  const originalGsdHome = process.env.GSD_HOME;
  const tempProject = makeTempDir("gsd-routing-project-");
  const tempGsdHome = makeTempDir("gsd-routing-home-");

  try {
    mkdirSync(join(tempProject, ".gsd"), { recursive: true });
    writeFileSync(
      join(tempProject, ".gsd", "PREFERENCES.md"),
      [
        "---",
        "dynamic_routing:",
        "  enabled: true",
        "  tier_models:",
        "    light: claude-haiku-4-5",
        "    standard: claude-sonnet-4-6",
        "---",
      ].join("\n"),
      "utf-8",
    );
    process.env.GSD_HOME = tempGsdHome;
    process.chdir(tempProject);

    const config = resolvePreferredModelConfig("execute-task", {
      provider: "openai",
      id: "gpt-5.4",
    });

    assert.deepEqual(config, {
      primary: "openai/gpt-5.4",
      fallbacks: [],
      source: "synthesized",
    });
  } finally {
    process.chdir(originalCwd);
    if (originalGsdHome === undefined) delete process.env.GSD_HOME;
    else process.env.GSD_HOME = originalGsdHome;
    rmSync(tempProject, { recursive: true, force: true });
    rmSync(tempGsdHome, { recursive: true, force: true });
  }
});

test("resolvePreferredModelConfig keeps explicit phase models as the ceiling", () => {
  const originalCwd = process.cwd();
  const originalGsdHome = process.env.GSD_HOME;
  const tempProject = makeTempDir("gsd-routing-project-");
  const tempGsdHome = makeTempDir("gsd-routing-home-");

  try {
    mkdirSync(join(tempProject, ".gsd"), { recursive: true });
    writeFileSync(
      join(tempProject, ".gsd", "PREFERENCES.md"),
      [
        "---",
        "models:",
        "  planning: claude-sonnet-4-6",
        "dynamic_routing:",
        "  enabled: true",
        "  tier_models:",
        "    heavy: claude-opus-4-6",
        "---",
      ].join("\n"),
      "utf-8",
    );
    process.env.GSD_HOME = tempGsdHome;
    process.chdir(tempProject);

    const config = resolvePreferredModelConfig("plan-slice", {
      provider: "anthropic",
      id: "claude-opus-4-6",
    });

    assert.deepEqual(config, {
      primary: "claude-sonnet-4-6",
      fallbacks: [],
      source: "explicit",
    });
  } finally {
    process.chdir(originalCwd);
    if (originalGsdHome === undefined) delete process.env.GSD_HOME;
    else process.env.GSD_HOME = originalGsdHome;
    rmSync(tempProject, { recursive: true, force: true });
    rmSync(tempGsdHome, { recursive: true, force: true });
  }
});

test("resolvePolicyThinkingLevel prefers exact unit type over prefix policy", () => {
  assert.equal(
    resolvePolicyThinkingLevel("execute-task", {
      default: "high",
      prefixes: { "execute-": "medium" },
      unitTypes: { "execute-task": "off" },
    }),
    "off",
  );
});

test("resolvePolicyThinkingLevel uses the longest matching prefix", () => {
  assert.equal(
    resolvePolicyThinkingLevel("plan-slice-deep", {
      prefixes: {
        "plan-": "high",
        "plan-slice-": "xhigh",
      },
    }),
    "xhigh",
  );
});

test("resolvePreferredThinkingLevel applies policy before retry and routing fallbacks", () => {
  assert.equal(
    resolvePreferredThinkingLevel(
      "execute-task",
      "heavy",
      { isRetry: true },
      { unitTypes: { "execute-task": "off" }, default: "medium" },
    ),
    "off",
  );
});

test("resolvePreferredThinkingLevel falls back for planning, retry, heavy tier, and default", () => {
  assert.equal(resolvePreferredThinkingLevel("plan-slice", "light", undefined, null), "xhigh");
  assert.equal(resolvePreferredThinkingLevel("execute-task", "light", { isRetry: true }, null), "xhigh");
  assert.equal(resolvePreferredThinkingLevel("execute-task", "heavy", undefined, null), "xhigh");
  assert.equal(resolvePreferredThinkingLevel("execute-task", "light", undefined, { default: "low" }), "low");
});

test("resolvePreferredThinkingLevel reads thinking-policy.json from GSD_HOME", (t) => {
  const originalGsdHome = process.env.GSD_HOME;
  const tempGsdHome = makeTempDir("gsd-thinking-policy-home-");
  t.after(() => {
    if (originalGsdHome === undefined) delete process.env.GSD_HOME;
    else process.env.GSD_HOME = originalGsdHome;
    rmSync(tempGsdHome, { recursive: true, force: true });
  });

  mkdirSync(join(tempGsdHome, "agent"), { recursive: true });
  writeFileSync(
    join(tempGsdHome, "agent", "thinking-policy.json"),
    JSON.stringify({
      default: "high",
      prefixes: { "execute-": "low" },
      unitTypes: { "execute-task": "off" },
    }),
    "utf-8",
  );
  process.env.GSD_HOME = tempGsdHome;

  assert.equal(resolvePreferredThinkingLevel("execute-task", "heavy", { isRetry: true }), "off");
  assert.equal(resolvePreferredThinkingLevel("execute-task-simple", "light", undefined), "low");
});

test("selectAndApplyModel honors explicit phase models without downgrading (#3617)", async () => {
  const originalCwd = process.cwd();
  const originalGsdHome = process.env.GSD_HOME;
  const tempProject = makeTempDir("gsd-routing-project-");
  const tempGsdHome = makeTempDir("gsd-routing-home-");
  const setModelCalls: string[] = [];
  let beforeModelSelectCalled = false;

  try {
    mkdirSync(join(tempProject, ".gsd"), { recursive: true });
    writeFileSync(
      join(tempProject, ".gsd", "PREFERENCES.md"),
      [
        "---",
        "models:",
        "  planning: claude-opus-4-6",
        "dynamic_routing:",
        "  enabled: true",
        "  tier_models:",
        "    light: gpt-4o-mini",
        "    standard: claude-sonnet-4-6",
        "    heavy: claude-opus-4-6",
        "---",
      ].join("\n"),
      "utf-8",
    );
    process.env.GSD_HOME = tempGsdHome;
    process.chdir(tempProject);

    const availableModels = [
      { id: "claude-opus-4-6", provider: "anthropic", api: "anthropic-messages" },
      { id: "claude-sonnet-4-6", provider: "anthropic", api: "anthropic-messages" },
      { id: "gpt-4o-mini", provider: "openai", api: "responses" },
    ];

    const result = await selectAndApplyModel(
      {
        modelRegistry: { getAvailable: () => availableModels },
        sessionManager: { getSessionId: () => "test-session" },
        ui: { notify: () => {} },
        model: { provider: "anthropic", id: "claude-opus-4-6", api: "anthropic-messages" },
      } as any,
      {
        setModel: async (model: { provider: string; id: string }) => {
          setModelCalls.push(`${model.provider}/${model.id}`);
          return true;
        },
        emitBeforeModelSelect: async () => {
          beforeModelSelectCalled = true;
          return undefined;
        },
        getActiveTools: () => [],
        emitAdjustToolSet: async () => undefined,
        setActiveTools: () => {},
      } as any,
      "plan-slice",
      "slice-1",
      tempProject,
      undefined,
      false,
      { provider: "anthropic", id: "claude-opus-4-6" },
      undefined,
      true,
    );

    assert.equal(beforeModelSelectCalled, false, "explicit phase models should skip dynamic routing hooks");
    assert.deepEqual(setModelCalls, ["anthropic/claude-opus-4-6"]);
    assert.equal(result.routing, null, "explicit phase models should not record a routing downgrade");
    assert.equal(result.appliedModel?.provider, "anthropic");
    assert.equal(result.appliedModel?.id, "claude-opus-4-6");
  } finally {
    process.chdir(originalCwd);
    if (originalGsdHome === undefined) delete process.env.GSD_HOME;
    else process.env.GSD_HOME = originalGsdHome;
    rmSync(tempProject, { recursive: true, force: true });
    rmSync(tempGsdHome, { recursive: true, force: true });
  }
});

test("selectAndApplyModel lets explicit unit models bypass stale cross-provider lock (#116)", async () => {
  const originalCwd = process.cwd();
  const originalGsdHome = process.env.GSD_HOME;
  const tempProject = makeTempDir("gsd-explicit-cross-provider-project-");
  const tempGsdHome = makeTempDir("gsd-explicit-cross-provider-home-");
  const setModelCalls: string[] = [];

  try {
    mkdirSync(join(tempProject, ".gsd"), { recursive: true });
    writeFileSync(
      join(tempProject, ".gsd", "PREFERENCES.md"),
      [
        "---",
        "models:",
        "  research:",
        "    model: claude-opus-4-7",
        "    provider: claude-code",
        "    fallbacks:",
        "      - deepseek/deepseek-v4-pro-20260423",
        "dynamic_routing:",
        "  enabled: true",
        "  cross_provider: false",
        "uok:",
        "  model_policy:",
        "    enabled: true",
        "---",
      ].join("\n"),
      "utf-8",
    );
    process.env.GSD_HOME = tempGsdHome;
    process.chdir(tempProject);

    const availableModels = [
      { id: "gpt-5.5", provider: "openai-codex", api: "responses" },
      { id: "claude-opus-4-7", provider: "claude-code", api: "anthropic-messages" },
      { id: "deepseek-v4-pro-20260423", provider: "deepseek", api: "openai-chat" },
    ];

    let thrown: unknown;
    try {
      await selectAndApplyModel(
        {
          modelRegistry: { getAvailable: () => availableModels },
          sessionManager: { getSessionId: () => "test-session" },
          ui: { notify: () => {} },
          model: { provider: "openai-codex", id: "gpt-5.5", api: "responses" },
        } as any,
        {
          setModel: async (model: { provider: string; id: string }) => {
            setModelCalls.push(`${model.provider}/${model.id}`);
            return true;
          },
          emitBeforeModelSelect: async () => undefined,
          getActiveTools: () => [],
          emitAdjustToolSet: async () => undefined,
          setActiveTools: () => {},
        } as any,
        "research-slice",
        "M014-veveb9/parallel-research",
        tempProject,
        undefined,
        false,
        { provider: "openai-codex", id: "gpt-5.5" },
        undefined,
        true,
      );
    } catch (e) {
      thrown = e;
    }

    assert.ok(!(thrown instanceof ModelPolicyDispatchBlockedError), "explicit research config must not be blocked by stale provider");
    if (thrown) throw thrown;
    assert.deepEqual(setModelCalls, ["claude-code/claude-opus-4-7"]);
  } finally {
    process.chdir(originalCwd);
    if (originalGsdHome === undefined) delete process.env.GSD_HOME;
    else process.env.GSD_HOME = originalGsdHome;
    rmSync(tempProject, { recursive: true, force: true });
    rmSync(tempGsdHome, { recursive: true, force: true });
  }
});

test("selectAndApplyModel escalates dynamic routing tier when retry metadata is provided", async (t) => {
  const originalCwd = process.cwd();
  const originalGsdHome = process.env.GSD_HOME;
  const tempProject = makeTempDir("gsd-routing-retry-project-");
  const tempGsdHome = makeTempDir("gsd-routing-retry-home-");
  const setModelCalls: string[] = [];
  const notifications: Array<{ message: string; level: string }> = [];

  t.after(() => {
    process.chdir(originalCwd);
    if (originalGsdHome === undefined) delete process.env.GSD_HOME;
    else process.env.GSD_HOME = originalGsdHome;
    rmSync(tempProject, { recursive: true, force: true });
    rmSync(tempGsdHome, { recursive: true, force: true });
  });

  mkdirSync(join(tempProject, ".gsd"), { recursive: true });
  writeFileSync(
    join(tempProject, ".gsd", "PREFERENCES.md"),
    [
      "---",
      "dynamic_routing:",
      "  enabled: true",
      "  hooks: false",
      "  budget_pressure: false",
      "  tier_models:",
      "    light: claude-haiku-4-5",
      "    standard: claude-sonnet-4-6",
      "    heavy: claude-opus-4-6",
      "---",
    ].join("\n"),
    "utf-8",
  );
  process.env.GSD_HOME = tempGsdHome;
  process.chdir(tempProject);

  const availableModels = [
    { id: "claude-haiku-4-5", provider: "anthropic", api: "anthropic-messages" },
    { id: "claude-sonnet-4-6", provider: "anthropic", api: "anthropic-messages" },
    { id: "claude-opus-4-6", provider: "anthropic", api: "anthropic-messages" },
  ];

  const result = await selectAndApplyModel(
    {
      modelRegistry: { getAvailable: () => availableModels },
      sessionManager: { getSessionId: () => "test-session" },
      ui: { notify: (message: string, level: string) => notifications.push({ message, level }) },
      model: { provider: "anthropic", id: "claude-opus-4-6", api: "anthropic-messages" },
    } as any,
    {
      setModel: async (model: { provider: string; id: string }) => {
        setModelCalls.push(`${model.provider}/${model.id}`);
        return true;
      },
      emitBeforeModelSelect: async () => undefined,
      getActiveTools: () => [],
      emitAdjustToolSet: async () => undefined,
      setActiveTools: () => {},
    } as any,
    "execute-task",
    "M001/S01/T01",
    tempProject,
    undefined,
    false,
    { provider: "anthropic", id: "claude-opus-4-6" },
    { isRetry: true, previousTier: "light" },
    true,
  );

  assert.deepEqual(setModelCalls, ["anthropic/claude-sonnet-4-6"]);
  assert.deepEqual(result.routing, { tier: "standard", modelDowngraded: true });
  assert.equal(result.appliedModel?.id, "claude-sonnet-4-6");
  assert.ok(
    notifications.some(n => n.message.includes("Tier escalation: light") && n.message.includes("standard")),
    "retry metadata should produce a visible tier escalation notification",
  );
});

// ─── resolveModelId tests ─────────────────────────────────────────────────

test("resolveModelId: bare ID resolves to claude-code when session is claude-code (#3772)", () => {
  const availableModels = [
    { id: "claude-sonnet-4-6", provider: "anthropic" },
    { id: "claude-sonnet-4-6", provider: "claude-code" },
  ];

  // When currentProvider is "claude-code" (set by startup migration for subscription
  // users), bare IDs must resolve to claude-code to avoid the third-party block (#3772).
  const result = resolveModelId("claude-sonnet-4-6", availableModels, "claude-code");
  assert.ok(result, "should resolve a model");
  assert.equal(result.provider, "claude-code", "bare ID must resolve to claude-code when session provider is claude-code");
});

test("resolveModelId: bare ID still prefers current provider when it is a first-class API provider", () => {
  const availableModels = [
    { id: "claude-sonnet-4-6", provider: "anthropic" },
    { id: "claude-sonnet-4-6", provider: "bedrock" },
  ];

  const result = resolveModelId("claude-sonnet-4-6", availableModels, "bedrock");
  assert.ok(result, "should resolve a model");
  assert.equal(result.provider, "bedrock", "bare ID should prefer current provider when it is a real API provider");
});

test("resolveModelId: explicit provider/model format still resolves to claude-code when specified", () => {
  const availableModels = [
    { id: "claude-sonnet-4-6", provider: "anthropic" },
    { id: "claude-sonnet-4-6", provider: "claude-code" },
  ];

  const result = resolveModelId("claude-code/claude-sonnet-4-6", availableModels, "anthropic");
  assert.ok(result, "should resolve a model");
  assert.equal(result.provider, "claude-code", "explicit provider prefix must be respected");
});

test("resolveModelId: bare ID with only one provider works normally", () => {
  const availableModels = [
    { id: "claude-sonnet-4-6", provider: "anthropic" },
  ];

  const result = resolveModelId("claude-sonnet-4-6", availableModels, "anthropic");
  assert.ok(result, "should resolve a model");
  assert.equal(result.provider, "anthropic");
});

test("resolveModelId: bare ID with claude-code as only provider still resolves", () => {
  const availableModels = [
    { id: "claude-sonnet-4-6", provider: "claude-code" },
  ];

  // If claude-code is the ONLY provider for this model, it should still resolve
  const result = resolveModelId("claude-sonnet-4-6", availableModels, "claude-code");
  assert.ok(result, "should resolve even when only available via claude-code");
  assert.equal(result.provider, "claude-code");
});

// ─── selectAndApplyModel verbose-gating tests ──────────────────────────

test("model change notify in selectAndApplyModel is gated behind verbose flag", async (t) => {
  const originalCwd = process.cwd();
  const tempProject = makeTempDir("gsd-routing-verbose-project-");
  const notifications: Array<{ message: string; level: string }> = [];
  t.after(() => {
    process.chdir(originalCwd);
    rmSync(tempProject, { recursive: true, force: true });
  });

  mkdirSync(join(tempProject, ".gsd"), { recursive: true });
  writeFileSync(
    join(tempProject, ".gsd", "PREFERENCES.md"),
    ["---", "models:", "  planning: claude-sonnet-4-6", "---"].join("\n"),
    "utf-8",
  );
  process.chdir(tempProject);

  await selectAndApplyModel(
    {
      modelRegistry: { getAvailable: () => [{ id: "claude-sonnet-4-6", provider: "anthropic", api: "anthropic-messages" }] },
      sessionManager: { getSessionId: () => "test-session" },
      ui: { notify: (message: string, level: string) => notifications.push({ message, level }) },
      model: { provider: "anthropic", id: "claude-sonnet-4-6", api: "anthropic-messages" },
    } as any,
    {
      setModel: async () => true,
      emitBeforeModelSelect: async () => undefined,
      getActiveTools: () => [],
      emitAdjustToolSet: async () => undefined,
      setActiveTools: () => {},
    } as any,
    "plan-slice",
    "M001/S01",
    tempProject,
    undefined,
    false,
    { provider: "anthropic", id: "claude-sonnet-4-6" },
    undefined,
    true,
  );

  assert.deepEqual(notifications, []);
});

test("selectAndApplyModel applies preferred thinking level after setModel success", async (t) => {
  const originalCwd = process.cwd();
  const tempProject = makeTempDir("gsd-routing-thinking-project-");
  const thinkingLevels: unknown[] = [];
  t.after(() => {
    process.chdir(originalCwd);
    rmSync(tempProject, { recursive: true, force: true });
  });

  mkdirSync(join(tempProject, ".gsd"), { recursive: true });
  writeFileSync(
    join(tempProject, ".gsd", "PREFERENCES.md"),
    ["---", "models:", "  planning: claude-sonnet-4-6", "---"].join("\n"),
    "utf-8",
  );
  process.chdir(tempProject);

  await selectAndApplyModel(
    {
      modelRegistry: { getAvailable: () => [{ id: "claude-sonnet-4-6", provider: "anthropic", api: "anthropic-messages" }] },
      sessionManager: { getSessionId: () => "test-session" },
      ui: { notify: () => {} },
      model: { provider: "anthropic", id: "claude-sonnet-4-6", api: "anthropic-messages" },
    } as any,
    {
      setModel: async () => true,
      setThinkingLevel: (level: unknown) => { thinkingLevels.push(level); },
      emitBeforeModelSelect: async () => undefined,
      getActiveTools: () => [],
      emitAdjustToolSet: async () => undefined,
      setActiveTools: () => {},
    } as any,
    "plan-slice",
    "M001/S01",
    tempProject,
    undefined,
    false,
    { provider: "anthropic", id: "claude-sonnet-4-6" },
    undefined,
    true,
    undefined,
    { effort: "high" } as any,
  );

  assert.deepEqual(thinkingLevels, ["xhigh"]);
});

test("resolveModelId: anthropic wins over claude-code when session provider is not claude-code", () => {
  const availableModels = [
    { id: "claude-sonnet-4-6", provider: "claude-code" },
    { id: "claude-sonnet-4-6", provider: "anthropic" },
  ];

  // When the session is NOT on claude-code, bare IDs should resolve to
  // the canonical anthropic provider (original #2905 behavior preserved).
  const result = resolveModelId("claude-sonnet-4-6", availableModels, undefined);
  assert.ok(result, "should resolve a model");
  assert.equal(result.provider, "anthropic", "anthropic must win when session is not claude-code");
});

test("resolveModelId: claude-code wins when session is claude-code regardless of list order", () => {
  const availableModels = [
    { id: "claude-sonnet-4-6", provider: "claude-code" },
    { id: "claude-sonnet-4-6", provider: "anthropic" },
  ];

  // When session provider is claude-code (subscription user migration), it must
  // win regardless of candidate ordering to avoid the third-party block (#3772).
  const result = resolveModelId("claude-sonnet-4-6", availableModels, "claude-code");
  assert.ok(result, "should resolve a model");
  assert.equal(result.provider, "claude-code", "claude-code must win when it is the session provider");
});
