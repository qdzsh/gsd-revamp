// GSD2 TUI Tests - Built-in terminal theme palette coverage.
import test from "node:test";
import assert from "node:assert/strict";

const { builtinThemes } = await import("../../packages/pi-coding-agent/src/modes/interactive/theme/themes.ts");

test("dark is the only built-in theme and uses the standard terminal palette", () => {
	assert.deepEqual(Object.keys(builtinThemes), ["dark"]);
	assert.ok("dark" in builtinThemes, "dark should be available as a built-in theme");
	const theme = builtinThemes.dark;

	assert.equal(theme.vars?.accent, "#3b82f6");
	assert.equal(theme.vars?.line, "#2f8f46");
	assert.equal(theme.vars?.userMsgBg, "#232c3a");
	assert.equal(theme.vars?.toolPendingBg, "#171c26");
	assert.equal(theme.vars?.toolSuccessBg, "#171c26");
	assert.equal(theme.vars?.toolErrorBg, "#241b22");
	assert.equal(theme.colors.border, "line");
	assert.equal(theme.colors.borderAccent, "accent");
	assert.equal(theme.colors.toolRunning, "accent");
	assert.equal(theme.colors.toolSuccess, "green");
	assert.equal(theme.colors.toolError, "red");
});
