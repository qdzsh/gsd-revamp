/**
 * ANSI-aware text measurement and slicing.
 *
 * High-performance UTF-16 native implementation with ASCII fast-paths,
 * single-pass ANSI scanning, and proper Unicode grapheme cluster support.
 */

import { native } from "../native.js";
import type { ExtractSegmentsResult, SliceResult } from "./types.js";

export type { ExtractSegmentsResult, SliceResult };
export { EllipsisKind } from "./types.js";

const ansiPattern = /\x1B(?:\][^\x07]*(?:\x07|\x1B\\)|\[[0-?]*[ -/]*[@-~]|[@-Z\\-_])/g;
const ansiAtPattern = /^\x1B(?:\][^\x07]*(?:\x07|\x1B\\)|\[[0-?]*[ -/]*[@-~]|[@-Z\\-_])/;
const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

function tabWidthOrDefault(tabWidth?: number): number {
  return Math.min(16, Math.max(1, Math.floor(tabWidth ?? 3)));
}

function stripAnsi(text: string): string {
  return text.replace(ansiPattern, "");
}

function ansiSequenceAt(text: string, index: number): string | null {
  if (text.charCodeAt(index) !== 0x1b) return null;
  const match = ansiAtPattern.exec(text.slice(index));
  return match?.[0] ?? "\x1b";
}

function nextGraphemeAt(text: string, index: number): string {
  const next = segmenter.segment(text.slice(index))[Symbol.iterator]().next();
  return next.done ? text[index] ?? "" : next.value.segment;
}

function graphemeWidth(grapheme: string, tabWidth?: number): number {
  if (grapheme === "\t") return tabWidthOrDefault(tabWidth);
  if (grapheme === "\n" || grapheme === "\r") return 0;
  const codePoint = grapheme.codePointAt(0) ?? 0;
  if (codePoint === 0) return 0;
  if (codePoint < 32 || (codePoint >= 0x7f && codePoint < 0xa0)) return 0;
  if (
    (codePoint >= 0x1100 && codePoint <= 0x115f) ||
    (codePoint >= 0x2329 && codePoint <= 0x232a) ||
    (codePoint >= 0x2e80 && codePoint <= 0xa4cf) ||
    (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
    (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
    (codePoint >= 0xfe10 && codePoint <= 0xfe19) ||
    (codePoint >= 0xfe30 && codePoint <= 0xfe6f) ||
    (codePoint >= 0xff00 && codePoint <= 0xff60) ||
    (codePoint >= 0xffe0 && codePoint <= 0xffe6) ||
    (codePoint >= 0x1f300 && codePoint <= 0x1faff)
  ) {
    return 2;
  }
  return 1;
}

function fallbackVisibleWidth(text: string, tabWidth?: number): number {
  let width = 0;
  for (let index = 0; index < text.length;) {
    const ansi = ansiSequenceAt(text, index);
    if (ansi) {
      index += ansi.length;
      continue;
    }
    const segment = nextGraphemeAt(text, index);
    if (segment.length === 0) break;
    width += graphemeWidth(segment, tabWidth);
    index += segment.length;
  }
  return width;
}

function fallbackSliceWithWidth(
  line: string,
  startCol: number,
  length: number,
  strict: boolean,
  tabWidth?: number,
): SliceResult {
  const start = Math.max(0, Math.floor(startCol));
  const end = start + Math.max(0, Math.floor(length));
  if (end <= start) return { text: "", width: 0 };

  let col = 0;
  let text = "";
  let width = 0;
  let prefixEscapes = "";
  let hasVisibleText = false;

  for (let index = 0; index < line.length;) {
    const ansi = ansiSequenceAt(line, index);
    if (ansi) {
      if (col < start) {
        prefixEscapes += ansi;
      } else if (col <= end) {
        text += ansi;
      }
      index += ansi.length;
      continue;
    }

    const segment = nextGraphemeAt(line, index);
    if (segment.length === 0) break;

    const segmentWidth = graphemeWidth(segment, tabWidth);
    const segmentStart = col;
    const segmentEnd = col + segmentWidth;
    col = segmentEnd;
    index += segment.length;

    if (segmentEnd <= start) continue;
    if (segmentStart >= end) break;
    if (strict && (segmentStart < start || segmentEnd > end)) continue;

    if (!hasVisibleText) {
      text += prefixEscapes;
      hasVisibleText = true;
    }
    text += segment;
    width += segmentWidth;
  }

  return { text, width };
}

function fallbackTruncateToWidth(
  text: string,
  maxWidth: number,
  ellipsisKind: number,
  pad: boolean,
  tabWidth?: number,
): string {
  const width = Math.max(0, Math.floor(maxWidth));
  const visible = fallbackVisibleWidth(text, tabWidth);
  if (visible <= width) {
    return pad ? text + " ".repeat(Math.max(0, width - visible)) : text;
  }

  const ellipsis = ellipsisKind === 0 ? "\u2026" : ellipsisKind === 1 ? "..." : "";
  const ellipsisWidth = fallbackVisibleWidth(ellipsis, tabWidth);
  const budget = Math.max(0, width - ellipsisWidth);
  const sliced = fallbackSliceWithWidth(text, 0, budget, true, tabWidth).text + ellipsis;
  return pad ? sliced + " ".repeat(Math.max(0, width - fallbackVisibleWidth(sliced, tabWidth))) : sliced;
}

function callNative<T>(name: string, args: unknown[], fallback: () => T): T {
  try {
    return (native as Record<string, Function>)[name](...args) as T;
  } catch {
    return fallback();
  }
}

/**
 * Word-wrap text to a visible width, preserving ANSI escape codes across
 * line breaks.
 *
 * Active SGR codes (colors, bold, etc.) are carried to continuation lines.
 * Underline and strikethrough are reset at line ends and restored on the
 * next line.
 */
export function wrapTextWithAnsi(
  text: string,
  width: number,
  tabWidth?: number,
): string[] {
  return callNative("wrapTextWithAnsi", [text, width, tabWidth], () => {
    const targetWidth = Math.max(1, Math.floor(width));
    const lines: string[] = [];
    for (const inputLine of text.split("\n")) {
      let remaining = inputLine;
      if (remaining.length === 0) {
        lines.push("");
        continue;
      }
      while (fallbackVisibleWidth(remaining, tabWidth) > targetWidth) {
        const slice = fallbackSliceWithWidth(remaining, 0, targetWidth, true, tabWidth).text;
        const plainSlice = stripAnsi(slice);
        const breakAt = plainSlice.lastIndexOf(" ");
        if (breakAt > 0) {
          lines.push(fallbackSliceWithWidth(remaining, 0, breakAt, true, tabWidth).text);
          remaining = fallbackSliceWithWidth(
            remaining,
            breakAt + 1,
            Number.MAX_SAFE_INTEGER,
            false,
            tabWidth,
          ).text.trimStart();
          continue;
        }

        lines.push(slice);
        remaining = fallbackSliceWithWidth(remaining, targetWidth, Number.MAX_SAFE_INTEGER, false, tabWidth).text.trimStart();
        if (remaining.length === 0) break;
      }
      if (remaining.length > 0) lines.push(remaining);
    }
    return lines;
  });
}

/**
 * Truncate text to a visible width with an optional ellipsis.
 *
 * @param text       Input string (may contain ANSI codes).
 * @param maxWidth   Maximum visible width in terminal cells.
 * @param ellipsisKind  0 = "\u2026", 1 = "...", 2 = none.
 * @param pad        When true, pad with spaces to exactly `maxWidth`.
 * @param tabWidth   Tab stop width (default 3, range 1-16).
 */
export function truncateToWidth(
  text: string,
  maxWidth: number,
  ellipsisKind: number,
  pad: boolean,
  tabWidth?: number,
): string {
  return callNative("truncateToWidth", [text, maxWidth, ellipsisKind, pad, tabWidth], () =>
    fallbackTruncateToWidth(text, maxWidth, ellipsisKind, pad, tabWidth),
  );
}

/**
 * Slice a range of visible columns from a line.
 *
 * Counts terminal cells (skipping ANSI escapes). When `strict` is true,
 * wide characters that would exceed the range are excluded.
 */
export function sliceWithWidth(
  line: string,
  startCol: number,
  length: number,
  strict: boolean,
  tabWidth?: number,
): SliceResult {
  return callNative("sliceWithWidth", [line, startCol, length, strict, tabWidth], () =>
    fallbackSliceWithWidth(line, startCol, length, strict, tabWidth),
  );
}

/**
 * Extract the before/after segments around an overlay region.
 *
 * ANSI state is tracked so the `after` segment renders correctly even when
 * the overlay truncates styled text.
 */
export function extractSegments(
  line: string,
  beforeEnd: number,
  afterStart: number,
  afterLen: number,
  strictAfter: boolean,
  tabWidth?: number,
): ExtractSegmentsResult {
  return callNative("extractSegments", [line, beforeEnd, afterStart, afterLen, strictAfter, tabWidth], () => {
    const before = fallbackSliceWithWidth(line, 0, beforeEnd, true, tabWidth);
    const after = fallbackSliceWithWidth(line, afterStart, afterLen, strictAfter, tabWidth);
    return {
      before: before.text,
      beforeWidth: before.width,
      after: after.text,
      afterWidth: after.width,
    };
  });
}

/**
 * Strip ANSI escape sequences, remove control characters and lone
 * surrogates, and normalize line endings (CR removed).
 *
 * Returns the original string when no changes are needed (zero-copy).
 */
export function sanitizeText(text: string): string {
  return callNative("sanitizeText", [text], () =>
    stripAnsi(text)
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "")
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ""),
  );
}

/**
 * Calculate visible width of text excluding ANSI escape sequences.
 *
 * Tabs count as `tabWidth` cells (default 3).
 */
export function visibleWidth(text: string, tabWidth?: number): number {
  return callNative("visibleWidth", [text, tabWidth], () =>
    fallbackVisibleWidth(text, tabWidth),
  );
}
