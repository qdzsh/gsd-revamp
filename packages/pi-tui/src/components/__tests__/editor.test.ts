// GSD-2 + packages/pi-tui/src/components/__tests__/editor.test.ts - Editor component regression tests.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { stripVTControlCharacters } from "node:util";

import { Editor, type EditorTheme } from "../editor.js";
import { CURSOR_MARKER, TUI } from "../../tui.js";
import type { Terminal } from "../../terminal.js";

function makeTerminal(): Terminal {
	return {
		isTTY: true,
		columns: 80,
		rows: 24,
		kittyProtocolActive: false,
		start() {},
		stop() {},
		drainInput: async () => {},
		write() {},
		moveBy() {},
		hideCursor() {},
		showCursor() {},
		clearLine() {},
		clearFromCursor() {},
		clearScreen() {},
		setTitle() {},
	};
}

const theme: EditorTheme = {
	borderColor: (text) => text,
	selectList: {
		selectedPrefix: (text) => text,
		selectedText: (text) => text,
		description: (text) => text,
		scrollInfo: (text) => text,
		noMatch: (text) => text,
	},
};

describe("Editor", () => {
	it("clears bracketed paste state when focus is lost", () => {
		const editor = new Editor(new TUI(makeTerminal()), theme);
		editor.focused = true;

		editor.handleInput("\x1b[200~partial");
		editor.focused = false;
		editor.focused = true;
		editor.handleInput("hello");

		assert.equal(editor.getText(), "hello");
	});

	it("keeps the hardware cursor marker visible while autocomplete is open", () => {
		const editor = new Editor(new TUI(makeTerminal()), theme);
		editor.focused = true;
		editor.setText("/se");

		(editor as any).autocompleteState = "regular";
		(editor as any).autocompleteList = { render: () => [] };

		const rendered = editor.render(40).join("\n");

		assert.ok(rendered.includes(CURSOR_MARKER));
	});

	it("keeps autocomplete height stable while suggestions shrink", () => {
		const editor = new Editor(new TUI(makeTerminal()), theme);
		editor.focused = true;
		editor.setText("/");

		let autocompleteRows = [
			"/gsd",
			"/git",
			"/grep",
			"/go",
			"/group",
			"(1/6)",
		];
		(editor as any).autocompleteState = "regular";
		(editor as any).autocompleteList = { render: () => autocompleteRows };

		const openLength = editor.render(40).length;

		autocompleteRows = ["/gsd"];
		const filteredLength = editor.render(40).length;

		assert.equal(
			filteredLength,
			openLength,
			"autocomplete should reserve rows during a completion session so filtering does not resize the TUI",
		);

		(editor as any).cancelAutocomplete();
		const closedLength = editor.render(40).length;
		assert.ok(
			closedLength < openLength,
			"autocomplete row reservation should clear when the completion session closes",
		);
	});

	it("renders an optional input prefix before the editable text", () => {
		const editor = new Editor(new TUI(makeTerminal()), theme, { inputPrefix: "❯ " });
		editor.focused = true;
		editor.setText("hello");

		const rendered = editor.render(20);

		assert.equal(rendered[1]?.startsWith(`❯ hello${CURSOR_MARKER}`), true);
		assert.equal(stripVTControlCharacters(rendered[0] ?? "").length, 20);
		assert.equal(stripVTControlCharacters((rendered[1] ?? "").replace(CURSOR_MARKER, "")).length, 20);
		assert.equal(stripVTControlCharacters(rendered[2] ?? "").length, 20);
	});

	it("renders the optional input prefix only on the first wrapped line", () => {
		const editor = new Editor(new TUI(makeTerminal()), theme, { inputPrefix: "❯ " });
		editor.focused = true;
		editor.setText("a".repeat(30));

		const rendered = editor.render(20).map((line) => stripVTControlCharacters(line.replace(CURSOR_MARKER, "")));

		assert.equal(rendered[1]?.startsWith("❯ "), true);
		assert.equal(rendered[2]?.startsWith("  "), true);
		assert.equal(rendered[2]?.startsWith("❯ "), false);
		assert.equal(rendered[1]?.length, 20);
		assert.equal(rendered[2]?.length, 20);
	});

	it("maps kitty keypad digits to plain editor text", () => {
		const editor = new Editor(new TUI(makeTerminal()), theme);
		editor.focused = true;

		editor.handleInput("\x1b[57404;129u");

		assert.equal(editor.getText(), "5");
	});

	it("does not insert kitty keypad navigation private-use glyphs into the editor", () => {
		const editor = new Editor(new TUI(makeTerminal()), theme);
		editor.focused = true;

		editor.handleInput("\x1b[57419u");

		assert.equal(editor.getText(), "");
	});
});
