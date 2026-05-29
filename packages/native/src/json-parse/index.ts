/**
 * Streaming JSON parser via native Rust bindings with JS fallback.
 *
 * Provides fast JSON parsing with recovery for incomplete/partial JSON,
 * used during LLM streaming tool call argument parsing.
 *
 * Falls back to pure-JS implementation when native functions are not
 * available (e.g. addon was compiled before json-parse was added).
 */

import { native } from "../native.js";

type NativeJsonMethod = "parseJson" | "parsePartialJson" | "parseStreamingJson";

function callNativeJson<T>(method: NativeJsonMethod, text: string, fallback: () => T): T {
  try {
    const fn = (native as Record<string, unknown>)[method];
    if (typeof fn === "function") return fn(text) as T;
  } catch {
    // Native JSON helpers are optional per platform/build. Fall back to JS.
  }
  return fallback();
}

function coerceXmlParameterValue(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed === "") return "";
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

function promoteEmbeddedXmlParameters<T>(value: T): T {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const record = value as Record<string, unknown>;
  const promoted: Record<string, unknown> = { ...record };

  for (const [key, rawValue] of Object.entries(record)) {
    if (typeof rawValue !== "string" || !rawValue.includes("<parameter")) continue;

    let nextValue = rawValue;
    const danglingClose = nextValue.match(/^(?<prefix>[\s\S]*?)<\/[A-Za-z_][\w.-]*>\s*/);
    if (danglingClose?.groups?.prefix !== undefined) {
      promoted[key] = danglingClose.groups.prefix.trimEnd();
      nextValue = nextValue.slice(danglingClose[0].length);
    }

    const parameterPattern = /<parameter\s+name=(?:"([^"]+)"|'([^']+)')>([\s\S]*?)<\/parameter>/g;
    for (const match of nextValue.matchAll(parameterPattern)) {
      const name = match[1] ?? match[2];
      if (!name) continue;
      promoted[name] = coerceXmlParameterValue(match[3] ?? "");
    }
  }

  return promoted as T;
}

/**
 * JS fallback: attempt JSON.parse, return {} on failure.
 */
function jsFallbackStreamingJson<T>(text: string): T {
  try {
    return promoteEmbeddedXmlParameters(JSON.parse(text) as T);
  } catch {
    // Try to salvage partial JSON by closing open structures
    let patched = text.trim();
    // Close unclosed strings
    const quotes = (patched.match(/"/g) || []).length;
    if (quotes % 2 !== 0) patched += '"';
    // Close unclosed brackets/braces
    const opens = (patched.match(/[{[]/g) || []).length;
    const closes = (patched.match(/[}\]]/g) || []).length;
    for (let i = 0; i < opens - closes; i++) {
      // Guess which closer based on last opener
      const lastOpen = patched.lastIndexOf("{") > patched.lastIndexOf("[") ? "}" : "]";
      patched += lastOpen;
    }
    try {
      return promoteEmbeddedXmlParameters(JSON.parse(patched) as T);
    } catch {
      return {} as T;
    }
  }
}

/**
 * Parse a complete JSON string. Throws on invalid JSON.
 */
export function parseJson<T = unknown>(text: string): T {
  return callNativeJson("parseJson", text, () => JSON.parse(text) as T);
}

/**
 * Parse potentially incomplete JSON by closing unclosed structures.
 * Handles unclosed strings, objects, arrays, trailing commas, and truncated literals.
 */
export function parsePartialJson<T = unknown>(text: string): T {
  return callNativeJson("parsePartialJson", text, () => jsFallbackStreamingJson<T>(text));
}

/**
 * Try full JSON parse first; fall back to partial parse.
 * Returns `{}` on total failure. Drop-in replacement for the JS streaming parser.
 */
export function parseStreamingJson<T = unknown>(text: string | undefined): T {
  if (!text || text.trim() === "") {
    return {} as T;
  }
  return callNativeJson("parseStreamingJson", text, () => jsFallbackStreamingJson<T>(text));
}
