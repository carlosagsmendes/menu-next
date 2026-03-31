import path from "node:path";
import { DEFAULT_ROUTE_MODES, PERF_BUILD_META_PATH } from "./config";
import {
  createRunDirectory,
  getArgumentValue,
  getNextBinaryPath,
  initializeRunMetadata,
  projectPath,
  runCommand,
  updateRunMetadata,
  writeJson,
} from "./utils";

const ROUTE_MODE_SYMBOLS: Record<string, string> = {
  "○": "static",
  "◐": "partial-prerender",
  "ƒ": "dynamic",
};

function parseRouteModes(output: string) {
  const routeModes = { ...DEFAULT_ROUTE_MODES } as Record<string, string>;

  for (const line of output.split("\n")) {
    const match = line.match(/^[\s├└│]*([○◐ƒ])\s+(\S+)\s*$/u);
    if (!match) {
      continue;
    }

    const [, symbol, route] = match;
    routeModes[route] = ROUTE_MODE_SYMBOLS[symbol] ?? "unknown";
  }

  return routeModes;
}

async function main() {
  const runDirArgument = getArgumentValue("run-dir");
  const nextBinary = getNextBinaryPath();
  const result = await runCommand({
    command: process.execPath,
    args: [nextBinary, "build"],
  });

  if (result.exitCode !== 0) {
    throw new Error("next build failed");
  }

  const routeModes = parseRouteModes(`${result.stdout}\n${result.stderr}`);
  const buildMetadata = {
    generatedAt: new Date().toISOString(),
    routeModes,
    buildCommand: [process.execPath, nextBinary, "build"],
  };

  await writeJson(projectPath(PERF_BUILD_META_PATH), buildMetadata);

  if (runDirArgument) {
    const runDir = await createRunDirectory(runDirArgument);
    await initializeRunMetadata(runDir);
    await updateRunMetadata(runDir, {
      routeModes,
      steps: ["build"],
    });
    await writeJson(path.join(runDir, "build.json"), buildMetadata);
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Unknown build error",
  );
  process.exit(1);
});
