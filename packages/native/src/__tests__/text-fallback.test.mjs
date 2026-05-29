import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

test("text helpers fall back to JS when native addon is unavailable", () => {
  const script = `
    const text = require("./dist/text");
    const result = {
      visible: text.visibleWidth("\\x1b[31mhello\\x1b[0m"),
      wide: text.visibleWidth("a世界"),
      sanitized: text.sanitizeText("he\\x01llo\\r\\n"),
      truncated: text.truncateToWidth("hello world", 6, text.EllipsisKind.Unicode, false),
      slice: text.sliceWithWidth("hello world", 6, 5, false),
      segments: text.extractSegments("hello world", 5, 6, 5, false),
      wrapped: text.wrapTextWithAnsi("hello world", 5),
    };
    process.stdout.write(JSON.stringify(result));
  `;

  const result = spawnSync(process.execPath, ["-e", script], {
    cwd: packageRoot,
    env: { ...process.env, GSD_NATIVE_DISABLE: "1" },
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.visible, 5);
  assert.equal(output.wide, 5);
  assert.equal(output.sanitized, "hello\n");
  assert.equal(output.truncated, "hello…");
  assert.deepEqual(output.slice, { text: "world", width: 5 });
  assert.deepEqual(output.segments, {
    before: "hello",
    beforeWidth: 5,
    after: "world",
    afterWidth: 5,
  });
  assert.deepEqual(output.wrapped, ["hello", "world"]);
});
