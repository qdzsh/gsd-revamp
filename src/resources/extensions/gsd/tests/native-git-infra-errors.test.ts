import test from "node:test";
import assert from "node:assert/strict";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";

import { git } from "./test-utils.ts";
import { GSD_GIT_ERROR } from "../errors.js";
import { GIT_NO_PROMPT_ENV } from "../git-constants.js";

test("nativeAddAllWithExclusions preserves infrastructure failures from git add", async () => {
  const base = mkdtempSync(join(tmpdir(), "gsd-native-git-infra-"));
  const repo = join(base, "repo");
  const bin = join(base, "bin");
  mkdirSync(repo);
  mkdirSync(bin);

  if (process.platform === "win32") {
    writeFileSync(
      join(bin, "git.cmd"),
      "@echo off\r\n" +
        "echo fatal: ENFILE: file table overflow 1>&2\r\n" +
        "exit /b 1\r\n",
      "utf-8",
    );
  } else {
    const fakeGit = join(bin, "git");
    writeFileSync(
      fakeGit,
      "#!/bin/sh\n" +
        "echo 'fatal: ENFILE: file table overflow' >&2\n" +
        "exit 1\n",
      "utf-8",
    );
    chmodSync(fakeGit, 0o755);
  }

  const originalPath = process.env.PATH ?? "";
  const gitEnv = GIT_NO_PROMPT_ENV as NodeJS.ProcessEnv;
  const originalGitEnvPath = gitEnv.PATH;
  try {
    git(repo, "init");
    git(repo, "config", "user.email", "test@example.com");
    git(repo, "config", "user.name", "Test User");
    writeFileSync(join(repo, "README.md"), "# Test\n", "utf-8");

    process.env.PATH = `${bin}${delimiter}${originalPath}`;
    gitEnv.PATH = process.env.PATH;
    const { nativeAddAllWithExclusions } = await import("../native-git-bridge.ts");

    assert.throws(
      () => nativeAddAllWithExclusions(repo, [".gsd/activity/"]),
      (err) => {
        const shaped = err as { code?: string; stderr?: string; message?: string };
        assert.notEqual(shaped.code, GSD_GIT_ERROR);
        assert.match(`${shaped.stderr ?? ""}${shaped.message ?? ""}`, /ENFILE/);
        return true;
      },
    );
  } finally {
    process.env.PATH = originalPath;
    gitEnv.PATH = originalGitEnvPath;
    rmSync(base, { recursive: true, force: true });
  }
});
