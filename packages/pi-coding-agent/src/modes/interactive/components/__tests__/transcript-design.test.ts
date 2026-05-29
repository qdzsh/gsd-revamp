// Project/App: GSD-2
// File Purpose: Visual contract tests for shared transcript/tool block surfaces.

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { stripVTControlCharacters } from "node:util";

import { visibleWidth } from "@gsd/pi-tui";
import { initTheme } from "../../theme/theme.js";
import { renderCommandCard, renderToolBlock } from "../transcript-design.js";

initTheme("dark", false);

describe("transcript design surfaces", () => {
	test("tool blocks use one-column horizontal padding without extra line clears", () => {
		const lines = renderToolBlock(["hello"], 40, "running");
		const contentLine = lines.find((line) => stripVTControlCharacters(line).includes("hello"));

		assert.ok(contentLine, `expected content row:\n${lines.join("\n")}`);
		assert.doesNotMatch(contentLine, /\x1b\[K/, "tool row should not emit redundant clear-to-end-line");
		assert.match(contentLine, /\x1b\[49m$/, "tool row should reset background after the padded line");

		const plain = stripVTControlCharacters(contentLine);
		assert.equal(plain.length, 40);
		assert.equal(plain[0], " ");
		assert.equal(plain.at(-1), " ");
	});

	test("long collapsed command rows wrap inside the block instead of truncating", () => {
		const command = `ls && find tbot -maxdepth 3 -type f | sort | head -120 && rg -n "${"license|tenant|bot_token|database|dashboard|admin".repeat(2)}"`;
		const lines = renderCommandCard(command, 60, {
			status: "running · 123ms",
			tone: "running",
		});
		const plain = lines.map((line) => stripVTControlCharacters(line));
		const contentRows = plain.filter((line) => line.trim().length > 0);

		assert.ok(contentRows.length > 2, `expected wrapped command rows:\n${plain.join("\n")}`);
		assert.ok(contentRows.some((line) => line.includes("bot_token")), `expected wrapped command content:\n${plain.join("\n")}`);
		assert.ok(!plain.join("\n").includes("..."), `command should wrap instead of ellipsizing:\n${plain.join("\n")}`);
		for (const line of lines) {
			assert.ok(visibleWidth(line) <= 60, `line should fit width 60: ${JSON.stringify(stripVTControlCharacters(line))}`);
		}
	});
});
