import { spawnSync } from "node:child_process";

const result = spawnSync(
  process.execPath,
  ["./node_modules/vitest/vitest.mjs", "run", "tests/financial.test.ts", "tests/financial-parity.test.ts"],
  { stdio: "inherit" },
);

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
