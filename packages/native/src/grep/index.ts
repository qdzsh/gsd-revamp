/**
 * Native ripgrep wrapper using N-API.
 *
 * High-performance regex search backed by Rust's grep-* crates
 * (the same internals as ripgrep).
 */

import { native } from "../native.js";
import type {
  ContextLine,
  GrepMatch,
  GrepOptions,
  GrepResult,
  SearchMatch,
  SearchOptions,
  SearchResult,
} from "./types.js";

export type {
  ContextLine,
  GrepMatch,
  GrepOptions,
  GrepResult,
  SearchMatch,
  SearchOptions,
  SearchResult,
};

function searchContentFallback(
  content: Buffer | Uint8Array,
  options: SearchOptions,
): SearchResult {
  const text = Buffer.from(content).toString("utf8");
  const lines = text.split("\n");
  const flags = `${options.ignoreCase ? "i" : ""}${options.multiline ? "m" : ""}`;
  const re = new RegExp(options.pattern, flags);
  const maxCount = options.maxCount ?? Number.POSITIVE_INFINITY;
  const matches: SearchMatch[] = [];
  let matchCount = 0;
  let limitReached = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (!re.test(line)) continue;
    matchCount++;
    if (matches.length < maxCount) {
      matches.push({
        lineNumber: i + 1,
        line,
        contextBefore: [],
        contextAfter: [],
        truncated: false,
      });
    } else {
      limitReached = true;
    }
  }

  return { matches, matchCount, limitReached };
}

/**
 * Search in-memory content for a regex pattern.
 *
 * Accepts a Buffer/Uint8Array of UTF-8 encoded content.
 */
export function searchContent(
  content: Buffer | Uint8Array,
  options: SearchOptions,
): SearchResult {
  try {
    return native.search(content, options) as SearchResult;
  } catch {
    return searchContentFallback(content, options);
  }
}

/**
 * Search files on disk for a regex pattern.
 *
 * Walks the directory tree respecting .gitignore and optional glob filters.
 * Runs on the native blocking worker pool and resolves asynchronously.
 */
export function grep(options: GrepOptions): Promise<GrepResult> {
  return native.grep(options) as Promise<GrepResult>;
}
