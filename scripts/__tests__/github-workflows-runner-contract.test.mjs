// Open GSD - GitHub workflow runner contract tests.
// File Purpose: Ensure active workflows use GitHub-hosted runners and cache actions.

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import YAML from "yaml";

const WORKFLOW_DIR = ".github/workflows";
const GITHUB_HOSTED_RUNNERS = new Set([
  "ubuntu-latest",
  "windows-latest",
  "macos-14",
]);

function loadWorkflows() {
  return readdirSync(WORKFLOW_DIR)
    .filter((entry) => entry.endsWith(".yml") || entry.endsWith(".yaml"))
    .map((entry) => {
      const path = join(WORKFLOW_DIR, entry);
      return {
        path,
        document: YAML.parse(readFileSync(path, "utf8")),
      };
    });
}

function visit(value, onValue) {
  onValue(value);
  if (Array.isArray(value)) {
    for (const item of value) visit(item, onValue);
    return;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) visit(item, onValue);
  }
}

test("active workflows use GitHub-hosted runners", () => {
  for (const workflow of loadWorkflows()) {
    const jobs = workflow.document.jobs ?? {};
    for (const [jobName, job] of Object.entries(jobs)) {
      const runner = job["runs-on"];
      if (!runner || String(runner).includes("${{")) continue;

      assert.ok(
        GITHUB_HOSTED_RUNNERS.has(runner),
        `${workflow.path} job ${jobName} uses non-hosted runner ${runner}`,
      );
    }
  }
});

test("active workflows use the standard cache action", () => {
  for (const workflow of loadWorkflows()) {
    visit(workflow.document, (value) => {
      if (!value || typeof value !== "object" || !("uses" in value)) return;

      assert.notEqual(
        value.uses,
        "useblacksmith/cache@v5",
        `${workflow.path} still uses the custom cache action`,
      );
    });
  }
});

test("native Linux ARM64 build matrix uses a Rust target triple", () => {
  const workflow = YAML.parse(readFileSync(".github/workflows/build-native.yml", "utf8"));
  const entries = workflow.jobs.build.strategy.matrix.include;
  const linuxArm64 = entries.find((entry) => entry.platform === "linux-arm64-gnu");

  assert.equal(linuxArm64.target, "aarch64-unknown-linux-gnu");
});
