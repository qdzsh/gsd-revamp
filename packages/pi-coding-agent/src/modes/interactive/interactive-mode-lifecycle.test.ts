// GSD-2 + packages/pi-coding-agent/src/modes/interactive/interactive-mode-lifecycle.test.ts - InteractiveMode lifecycle regression coverage.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { InteractiveMode } from "./interactive-mode.js";
import { initTheme } from "./theme/theme.js";

initTheme("dark", false);

type RuntimeInteractiveMode = {
	[key: string]: unknown;
	stop(): void;
	_branchChangeUnsub?: () => void;
	getMarkdownThemeWithSettings(): unknown;
};

describe("InteractiveMode lifecycle", () => {
	it("lets open overlays receive Escape before aborting active work", () => {
		const mode = Object.create(InteractiveMode.prototype) as RuntimeInteractiveMode;
		let abortCount = 0;
		let abortBashCount = 0;

		mode.keybindings = {
			matches: (data: string, action: string) => data === "\x1b" && action === "interrupt",
		};
		mode.ui = { hasOverlay: () => true };
		mode.session = {
			isStreaming: true,
			isBashRunning: true,
			abort: () => {
				abortCount++;
			},
			abortBash: () => {
				abortBashCount++;
			},
		};
		mode.pendingTools = new Map([["tool-1", {}]]);

		const result = (mode as any).handleGlobalInterrupt("\x1b");

		assert.equal(result, undefined);
		assert.equal(abortCount, 0);
		assert.equal(abortBashCount, 0);
	});

	it("aborts active tool work on Escape when no overlay is open", () => {
		const mode = Object.create(InteractiveMode.prototype) as RuntimeInteractiveMode;
		let abortArgs: unknown;

		mode.keybindings = {
			matches: (data: string, action: string) => data === "\x1b" && action === "interrupt",
		};
		mode.ui = { hasOverlay: () => false };
		mode.session = {
			isStreaming: false,
			isBashRunning: false,
			abort: (args: unknown) => {
				abortArgs = args;
			},
			abortBash: () => {
				throw new Error("abortBash should not be called for tool-only work");
			},
		};
		mode.pendingTools = new Map([["tool-1", {}]]);

		const result = (mode as any).handleGlobalInterrupt("\x1b");

		assert.deepEqual(result, { consume: true });
		assert.deepEqual(abortArgs, { origin: "user" });
	});

	it("aborts active bash work on Escape when no overlay is open", () => {
		const mode = Object.create(InteractiveMode.prototype) as RuntimeInteractiveMode;
		let abortBashCount = 0;

		mode.keybindings = {
			matches: (data: string, action: string) => data === "\x1b" && action === "interrupt",
		};
		mode.ui = { hasOverlay: () => false };
		mode.session = {
			isStreaming: false,
			isBashRunning: true,
			abort: () => {
				throw new Error("abort should not be called for bash-only work");
			},
			abortBash: () => {
				abortBashCount++;
			},
		};
		mode.pendingTools = new Map();

		const result = (mode as any).handleGlobalInterrupt("\x1b");

		assert.deepEqual(result, { consume: true });
		assert.equal(abortBashCount, 1);
	});

	it("calls and clears the branch-change unsubscriber on stop", () => {
		const mode = Object.create(InteractiveMode.prototype) as RuntimeInteractiveMode;
		let unsubscribeCount = 0;

		mode.loadingAnimation = undefined;
		mode.extensionTerminalInputUnsubscribers = new Set();
		mode.clearExtensionTerminalInputListeners = () => {};
		mode._branchChangeUnsub = () => {
			unsubscribeCount++;
		};
		mode.onInputCallback = undefined;
		mode.clearExtensionWidgets = () => {};
		mode.customFooter = undefined;
		mode.customHeader = undefined;
		mode.footer = { dispose() {} };
		mode.footerDataProvider = { dispose() {} };
		mode.unsubscribe = undefined;
		mode.isInitialized = false;

		mode.stop();

		assert.equal(unsubscribeCount, 1);
		assert.equal(mode._branchChangeUnsub, undefined);
	});

	it("caches markdown theme settings until the code block indent changes", () => {
		const mode = Object.create(InteractiveMode.prototype) as RuntimeInteractiveMode;
		let codeBlockIndent = "  ";
		mode.session = {
			settingsManager: {
				getCodeBlockIndent: () => codeBlockIndent,
			},
		};

		const first = mode.getMarkdownThemeWithSettings();
		assert.equal(mode.getMarkdownThemeWithSettings(), first);

		codeBlockIndent = "    ";
		const updated = mode.getMarkdownThemeWithSettings() as { codeBlockIndent: string };

		assert.notEqual(updated, first);
		assert.equal(updated.codeBlockIndent, "    ");
		assert.equal(mode.getMarkdownThemeWithSettings(), updated);
	});
});
