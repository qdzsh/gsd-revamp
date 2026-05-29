// Project/App: GSD-2
// File Purpose: Shared recommended transcript rendering primitives for assistant, tool, command, footer, and auto-mode TUI surfaces.

import { alignRight, padRight, truncateToWidth, visibleWidth, wrapTextWithAnsi } from "@gsd/pi-tui";
import { theme, type ThemeBg, type ThemeColor } from "../theme/theme.js";
import { formatTimestamp, type TimestampFormat } from "./timestamp.js";

export type StatusTone = "running" | "success" | "error" | "warning" | "muted";
export type TuiTone = "default" | "accent" | "success" | "warning" | "error" | "muted";
export type TuiBreakpoint = "compact" | "regular" | "wide";

/** Conversation/system surfaces that the chat frame distinguishes by color. */
export type FrameTone = "assistant" | "user" | "compaction" | "skill";

export function chatMessageWidth(width: number): number {
	return Math.max(24, Math.min(width, Math.floor(width * 0.72)));
}

function trimOuterBlankLines(lines: string[]): string[] {
	let start = 0;
	let end = lines.length;
	while (start < end && lines[start].trim().length === 0) start++;
	while (end > start && lines[end - 1].trim().length === 0) end--;
	return lines.slice(start, end);
}

function toneColor(tone: StatusTone): ThemeColor {
	switch (tone) {
		case "running": return "toolRunning";
		case "success": return "border";
		case "error": return "toolError";
		case "warning": return "warning";
		case "muted":
		default: return "toolMuted";
	}
}

function toneBg(tone: StatusTone): ThemeBg {
	switch (tone) {
		case "error": return "toolErrorBg";
		case "success": return "toolSuccessBg";
		case "running":
		case "warning":
		case "muted":
		default: return "toolPendingBg";
	}
}

const ANSI_RE = /\x1b\[[0-9;]*m/g;

function isBlankRow(line: string): boolean {
	return line.replace(ANSI_RE, "").trim().length === 0;
}

function collapseBlankRows(lines: string[]): string[] {
	const collapsed: string[] = [];
	let previousBlank = false;
	for (const line of lines) {
		const blank = isBlankRow(line);
		if (blank && previousBlank) continue;
		collapsed.push(line);
		previousBlank = blank;
	}
	return collapsed;
}

function trimBlankRows(lines: string[]): string[] {
	let start = 0;
	let end = lines.length;
	while (start < end && isBlankRow(lines[start])) start++;
	while (end > start && isBlankRow(lines[end - 1])) end--;
	return lines.slice(start, end);
}

function terminalPaintWidth(width: number): number {
	const terminalColumns = process.stdout.columns;
	return Math.max(1, Math.floor(Math.max(width, Number.isFinite(terminalColumns) ? terminalColumns : 0)));
}

export function renderToolBlock(rows: string[], width: number, tone: StatusTone, bgOverride?: ThemeBg): string[] {
	const outerWidth = Math.max(20, width);
	const innerWidth = Math.max(1, outerWidth - 2);
	const bg = bgOverride ?? toneBg(tone);
	let bgAnsi = "";
	try {
		const themeWithBg = theme as unknown as { getBgAnsi?: (color: ThemeBg) => string };
		bgAnsi = typeof themeWithBg.getBgAnsi === "function" ? themeWithBg.getBgAnsi(bg) : "";
	} catch {
		bgAnsi = "";
	}
	const paint = (line: string): string => `${bgAnsi}${line}\x1b[49m`;
	const blank = " ".repeat(outerWidth);
	const paddedRows = collapseBlankRows(trimBlankRows(rows)).flatMap((line) => {
		if (isBlankRow(line)) return [blank];
		return wrapTextWithAnsi(line, innerWidth).map((wrapped) => {
			const content = truncateToWidth(wrapped, innerWidth, "");
			return padRight(` ${content}`, outerWidth);
		});
	});
	return [blank, ...paddedRows, blank].map(paint);
}

export function breakpoint(width: number): TuiBreakpoint {
	if (width < 72) return "compact";
	if (width < 112) return "regular";
	return "wide";
}

function panelToneColor(tone: TuiTone): ThemeColor {
	switch (tone) {
		case "accent": return "borderAccent";
		case "success": return "success";
		case "warning": return "warning";
		case "error": return "error";
		case "muted": return "borderMuted";
		case "default":
		default: return "border";
	}
}

export function badge(text: string, tone: TuiTone = "default"): string {
	return theme.fg(panelToneColor(tone), text);
}

export function keyValue(label: string, value: string, valueColor: ThemeColor = "text", labelWidth = 10): string {
	return `${theme.fg("dim", padRight(label, labelWidth))}${theme.fg(valueColor, value)}`;
}

export function roundedPanel(
	lines: string[],
	width: number,
	opts: {
		tone?: TuiTone;
		title?: string;
		rightTitle?: string;
		paddingX?: number;
	} = {},
): string[] {
	const outerWidth = Math.max(1, width);
	const body = lines.length > 0 ? lines : [""];
	const padding = " ".repeat(Math.max(0, opts.paddingX ?? 0));
	const rows = body.map((line) => truncateToWidth(`${padding}${line}`, outerWidth, ""));
	if (!opts.title && !opts.rightTitle) return rows;
	const title = opts.title ? theme.fg("borderAccent", opts.title) : "";
	const right = opts.rightTitle ? theme.fg("dim", opts.rightTitle) : "";
	return [rightAlign(title, right, outerWidth), ...rows];
}

export function rightAlign(left: string, right: string, width: number): string {
	return alignRight(left, right, width);
}

/**
 * Render a copy-clean content surface (ADR-019): a titled top rule, body
 * lines emitted with no border column or leading glyph, and a closing rule.
 * Selecting a body line in the terminal copies only its content.
 *
 * This is the target surface for transcript messages, tool output, and
 * summaries. Migration steps 3–5 move existing renderers onto it.
 */
export function openSurface(
	lines: string[],
	width: number,
	opts: { title: string; right?: string; tone: StatusTone; paddingX?: number },
): string[] {
	const outerWidth = Math.max(20, width);
	const padding = " ".repeat(Math.max(0, opts.paddingX ?? 0));
	const header = rightAlign(theme.fg("borderAccent", opts.title), opts.right ? theme.fg(toneColor(opts.tone), opts.right) : "", outerWidth);
	const body = lines.map((line) => truncateToWidth(`${padding}${line}`, outerWidth, ""));
	return [header, ...body];
}

/**
 * Render a framed system/conversation surface (compaction notices, skill
 * invocations) as a copy-clean open surface (ADR-019): a titled top rule
 * body lines with no border column, and a closing rule. Replaces the former
 * chat-frame.ts.
 */
export function renderChatFrame(
	contentLines: string[],
	width: number,
	opts: {
		label: string;
		tone: FrameTone;
		timestamp?: number;
		timestampFormat: TimestampFormat;
		showTimestamp?: boolean;
	},
): string[] {
	const outerWidth = Math.max(20, width);
	const isPurple = opts.tone === "compaction" || opts.tone === "skill";
	const frameColor: ThemeColor = opts.tone === "user" ? "border" : isPurple ? "customMessageLabel" : "borderAccent";
	const bodyColor: ThemeColor =
		opts.tone === "user" ? "userMessageText" : isPurple ? "customMessageText" : "assistantMessageText";

	// A label may carry a " - " splitting a bold name from a dim detail.
	const dashIdx = opts.label.indexOf(" - ");
	const titleStyled =
		dashIdx >= 0
			? theme.fg(frameColor, theme.bold(opts.label.slice(0, dashIdx))) + theme.fg("dim", opts.label.slice(dashIdx))
			: theme.fg(frameColor, theme.bold(opts.label));
	const rightRaw =
		opts.showTimestamp === false || !opts.timestamp ? "" : formatTimestamp(opts.timestamp, opts.timestampFormat);

	const source = trimOuterBlankLines(contentLines);
	const body = (source.length > 0 ? source : [""]).map((line) => theme.fg(bodyColor, line));

	const header = rightAlign(titleStyled, rightRaw ? theme.fg("dim", rightRaw) : "", outerWidth);
	const footer = theme.fg(frameColor, "─".repeat(outerWidth));
	return [header, ...body.map((line) => truncateToWidth(line, outerWidth, "")), footer];
}

export function renderAssistantRail(
	lines: string[],
	width: number,
	_opts: { label: string; meta?: string; railColor?: ThemeColor; connected?: boolean } = { label: "GSD" },
): string[] {
	const source = trimOuterBlankLines(lines);
	const outerWidth = Math.max(1, width);
	return (source.length > 0 ? source : [""]).map((line) =>
		truncateToWidth(theme.fg("assistantMessageText", line.trimEnd()), outerWidth, ""),
	);
}

export function renderUserRail(
	lines: string[],
	width: number,
	_opts: { label: string; meta?: string },
): string[] {
	const source = trimOuterBlankLines(lines);
	const outerWidth = terminalPaintWidth(width);
	const innerWidth = Math.max(1, outerWidth - 2);
	const paddingX = 1;
	const body = (source.length > 0 ? source : [""]).map((line) =>
		padRight(
			truncateToWidth(`${" ".repeat(paddingX)}${theme.fg("userMessageText", line.trimEnd())}`, innerWidth + paddingX, ""),
			outerWidth,
		),
	);
	const blank = " ".repeat(outerWidth);
	return [blank, ...body, blank].map((line) => theme.bg("userMessageBg", padRight(line, outerWidth)));
}

function statusHeaderRows(left: string, right: string, width: number, tone: ThemeColor): string[] {
	const outerWidth = Math.max(1, width);
	const rightStyled = right ? theme.fg(tone, right) : "";
	const rightWidth = visibleWidth(rightStyled);
	if (!rightStyled) {
		return wrapTextWithAnsi(left, outerWidth);
	}

	if (rightWidth >= outerWidth - 4) {
		return [...wrapTextWithAnsi(left, outerWidth), truncateToWidth(rightStyled, outerWidth, "")];
	}

	const firstLineBudget = Math.max(1, outerWidth - rightWidth - 1);
	const wrapped = wrapTextWithAnsi(left, firstLineBudget);
	const first = rightAlign(wrapped[0] ?? "", rightStyled, outerWidth);
	const rest = wrapped.slice(1).flatMap((line) => wrapTextWithAnsi(line, outerWidth));
	return [first, ...rest];
}

function statusMarker(tone: StatusTone): string {
	switch (tone) {
		case "running": return "›";
		case "success": return "✓";
		case "error": return "✗";
		case "warning": return "!";
		case "muted":
		default: return "·";
	}
}

export function renderToolStatusRows(
	main: string,
	width: number,
	opts: {
		status: string;
		tone: StatusTone;
		marker?: string;
		hidden?: boolean;
		hiddenLabel?: string;
	},
): string[] {
	const outerWidth = Math.max(20, width);
	const innerWidth = Math.max(1, outerWidth - 2);
	const tone = toneColor(opts.tone);
	const marker = opts.marker ?? statusMarker(opts.tone);
	const markerText = theme.fg(tone, marker);
	const left = `${markerText} ${main}`;
	const top = statusHeaderRows(left, opts.status, innerWidth, tone);
	if (!opts.hidden) return top;

	const detail = theme.fg("dim", opts.hiddenLabel ?? "output hidden · ctrl+o expand");
	return [
		...top,
		detail,
	];
}

export function renderTranscriptCard(
	lines: string[],
	width: number,
	opts: {
		title: string;
		right?: string;
		tone: StatusTone;
		marker?: string;
		footerLeft?: string;
		footerRight?: string;
	},
): string[] {
	const outerWidth = Math.max(20, width);
	const innerWidth = Math.max(1, outerWidth - 2);
	const tone = toneColor(opts.tone);
	const marker = opts.marker ?? statusMarker(opts.tone);
	const title = marker
		? `${theme.fg(tone, marker)} ${theme.fg("borderAccent", opts.title)}`
		: theme.fg("borderAccent", opts.title);
	const body = [...lines];
	if (opts.footerLeft || opts.footerRight) {
		body.push("");
		body.push(
			rightAlign(theme.fg("dim", opts.footerLeft ?? ""), theme.fg("dim", opts.footerRight ?? ""), innerWidth),
		);
	}
	const output: string[] = [rightAlign(title, opts.right ? theme.fg(tone, opts.right) : "", innerWidth)];
	if (opts.right) {
		output[0] = rightAlign(title, theme.fg(tone, opts.right), innerWidth);
	}
	return renderToolBlock(
		[...output, ...body],
		outerWidth,
		opts.tone,
	);
}

export function renderToolLineCard(
	title: string,
	target: string | undefined,
	width: number,
	opts: { status: string; tone: StatusTone; hidden?: boolean; titlePrefix?: string; bg?: ThemeBg },
): string[] {
	const titleText = `${opts.titlePrefix ?? ""}${theme.fg("borderAccent", title)}${
		target ? ` ${theme.fg("text", target)}` : ""
	}`;
	const rows = renderToolStatusRows(titleText, width, {
		status: opts.status,
		tone: opts.tone,
		hidden: opts.hidden,
	});
	return renderToolBlock(rows, width, opts.tone, opts.bg);
}

export function renderCommandCard(
	command: string,
	width: number,
	opts: { status: string; tone: StatusTone; progress?: string },
): string[] {
	const titleText = theme.fg("text", command);
	const statusText = opts.progress
		? `${opts.progress} ${opts.status}`
		: opts.status;
	const rows = renderToolStatusRows(titleText, width, {
		status: statusText,
		tone: opts.tone,
		marker: "$",
		hidden: !opts.progress,
	});
	return renderToolBlock(rows, width, opts.tone);
}

export function renderProgressBar(done: number, total: number, width: number, tone: StatusTone = "success"): string {
	const clampedWidth = Math.max(0, width);
	const pct = total > 0 ? Math.max(0, Math.min(1, done / total)) : 0;
	const filled = Math.round(pct * clampedWidth);
	return (
		theme.fg(toneColor(tone), "█".repeat(filled)) +
		theme.fg("dim", "░".repeat(clampedWidth - filled))
	);
}

export function renderFooterStrip(leftSegments: string[], right: string, width: number): string[] {
	const outerWidth = Math.max(20, width);
	const innerWidth = Math.max(1, outerWidth - 2);
	const sep = theme.fg("dim", "  │  ");
	const rightStyled = theme.fg("dim", right);
	const rightWidth = visibleWidth(rightStyled);
	const leftBudget = right ? Math.max(1, innerWidth - rightWidth - 3) : innerWidth;
	const left = truncateToWidth(leftSegments.filter(Boolean).join(sep), leftBudget, "");
	const content = rightAlign(left, rightStyled, innerWidth);
	return [truncateToWidth(content, outerWidth, "")];
}
