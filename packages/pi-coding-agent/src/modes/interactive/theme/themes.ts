// Project/App: GSD-2
// File Purpose: Built-in terminal theme definitions for interactive TUI rendering.
/**
 * Built-in theme definitions.
 *
 * Each theme is a self-contained record of color values. Variable references
 * (e.g. "accent") are resolved against the `vars` map at load time by the
 * theme engine in theme.ts.
 *
 * To add a new built-in theme, add an entry to `builtinThemes` below.
 */

// Re-use the ThemeJson type from the schema module to avoid runtime cycles.
import type { ThemeJson } from "./theme-schema.js";

// ---------------------------------------------------------------------------
// Dark theme
// ---------------------------------------------------------------------------

const dark: ThemeJson = {
	name: "dark",
	vars: {
		cyan: "#0891b2",
		blue: "#3b82f6",
		green: "#2f8f46",
		red: "#b91c1c",
		yellow: "#b45309",
		gray: "#7d889f",
		dimGray: "#4d5870",
		darkGray: "#4e596d",
		line: "#2f8f46",
		lineSoft: "#4e596d",
		textSoft: "#dce4f2",
		accent: "#3b82f6",
		selectedBg: "#1d2430",
		userMsgBg: "#232c3a",
		toolPendingBg: "#171c26",
		toolSuccessBg: "#171c26",
		toolErrorBg: "#241b22",
		customMsgBg: "#171c26",
	},
	colors: {
		accent: "accent",
		logo: "green",
		border: "line",
		borderAccent: "accent",
		borderMuted: "lineSoft",
		success: "green",
		error: "red",
		warning: "yellow",
		muted: "gray",
		dim: "dimGray",
		text: "",
		thinkingText: "gray",

		selectedBg: "selectedBg",
		userMessageBg: "userMsgBg",
		userMessageText: "textSoft",
		assistantMessageText: "textSoft",
		customMessageBg: "customMsgBg",
		customMessageText: "textSoft",
		customMessageLabel: "blue",
		toolPendingBg: "toolPendingBg",
		toolSuccessBg: "toolSuccessBg",
		toolErrorBg: "toolErrorBg",
		toolTitle: "accent",
		toolOutput: "textSoft",
		surfaceTitle: "accent",
		surfaceAccent: "accent",
		toolRunning: "accent",
		toolSuccess: "green",
		toolError: "red",

		mdHeading: "#b45309",
		mdLink: "#3b82f6",
		mdLinkUrl: "dimGray",
		mdCode: "accent",
		mdCodeBlock: "green",
		mdCodeBlockBorder: "lineSoft",
		mdQuote: "gray",
		mdQuoteBorder: "gray",
		mdHr: "gray",
		mdListBullet: "accent",

		toolDiffAdded: "green",
		toolDiffRemoved: "red",
		toolDiffContext: "gray",

		syntaxComment: "#2f8f46",
		syntaxKeyword: "#3b82f6",
		syntaxFunction: "#b45309",
		syntaxVariable: "#3b82f6",
		syntaxString: "#fdba74",
		syntaxNumber: "#2f8f46",
		syntaxType: "#5eead4",
		syntaxOperator: "#d1d5db",
		syntaxPunctuation: "#d1d5db",

		thinkingOff: "darkGray",
		thinkingMinimal: "#8088a0",
		thinkingLow: "#3b82f6",
		thinkingMedium: "#2dd4bf",
		thinkingHigh: "#c084fc",
		thinkingXhigh: "#f472b6",

		bashMode: "line",
	},
	export: {
		pageBg: "#10141d",
		cardBg: "#171c26",
		infoBg: "#1d2430",
	},
};

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const builtinThemes: Record<string, ThemeJson> = {
	dark,
};
