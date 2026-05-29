#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const version = pkg.version;
const optionalDependencies = pkg.optionalDependencies ?? {};
const enginePackages = Object.keys(optionalDependencies)
  .filter((name) => name.startsWith("@gsd-revamp/engine-"))
  .sort();

if (enginePackages.length === 0) {
  process.stderr.write("ERROR: no @gsd-revamp/engine-* optionalDependencies found\n");
  process.exit(1);
}

const allowAnyVersion = process.argv.includes("--any-version");
const missing = [];

for (const name of enginePackages) {
  const spec = allowAnyVersion ? name : `${name}@${version}`;
  const result = spawnSync("npm", ["view", spec, "version"], {
    encoding: "utf8",
    shell: process.platform === "win32",
  });

  if (result.status === 0 && result.stdout.trim()) {
    process.stdout.write(`verified ${spec}: ${result.stdout.trim()}\n`);
    continue;
  }

  missing.push(spec);
}

if (missing.length === 0) {
  process.stdout.write("Native platform package verification passed.\n");
  process.exit(0);
}

process.stderr.write("ERROR: missing native platform packages on npm:\n");
for (const spec of missing) {
  process.stderr.write(`  - ${spec}\n`);
}
process.stderr.write(
  allowAnyVersion
    ? "Publish the missing @gsd-revamp/engine-* packages before publishing gsd-revamp.\n"
    : "Run the native binary publish workflow for this version before publishing gsd-revamp.\n",
);
process.exit(1);
