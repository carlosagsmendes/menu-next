import path from "node:path";
import { createRunDirectory, projectPath, runCommand } from "./utils";

function getTsxCliPath() {
  return projectPath("node_modules", "tsx", "dist", "cli.mjs");
}

async function runScript(scriptName: string, runDir: string) {
  const result = await runCommand({
    command: process.execPath,
    args: [getTsxCliPath(), projectPath("perf", scriptName), `--run-dir=${runDir}`],
  });

  if (result.exitCode !== 0) {
    throw new Error(`${scriptName} failed`);
  }
}

async function main() {
  const runDir = await createRunDirectory();
  await runScript("build.ts", runDir);
  await runScript("run-load.ts", runDir);
  await runScript("run-client.ts", runDir);
  await runScript("compare.ts", runDir);

  console.log(`\nPerf run complete. Results saved to ${runDir}`);
  console.log(`Summary: ${path.join(runDir, "summary.md")}`);
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Unknown perf:all error",
  );
  process.exit(1);
});
