import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
	formatDisplayModel,
	formatUsageCost,
	formatUsageContext,
	formatUsageDisplay,
} from "../usage-display.js";

describe("usage display formatting", () => {
	it("formats subagent usage with grouped tokens and cache hit", () => {
		assert.equal(
			formatUsageDisplay(
				{
					turns: 15,
					input: 108_800,
					output: 1_900,
					cacheRead: 1_090_000,
					cacheWrite: 0,
					cost: 1.14,
					contextTokens: 104_400,
					model: "openai-codex/gpt-5.5",
				},
				{ includeTurns: true, includeModel: true },
			),
			"15 turns · ↑109k ↓1.9k · Hit 100.0% · $1.14 · Ctx 104.4k · gpt-5.5",
		);
	});

	it("strips only the provider prefix from provider/model strings", () => {
		assert.equal(formatDisplayModel("openai-codex/gpt-5.5"), "gpt-5.5");
		assert.equal(formatDisplayModel("openrouter/deepseek/deepseek-r1"), "deepseek/deepseek-r1");
		assert.equal(formatDisplayModel("claude-sonnet-4-6"), "claude-sonnet-4-6");
	});

	it("formats context as percent over window when the window is known", () => {
		assert.equal(
			formatUsageContext({
				contextWindow: 400_000,
				contextPercent: 12.35,
			}),
			"12.3%/400k",
		);
	});

	it("formats money with two decimals and thousands separators", () => {
		assert.equal(formatUsageCost(99345.123), "$99,345.12");
		assert.equal(formatUsageCost(-12), "-$12.00");
	});
});
