import { spawn } from "node:child_process";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  BENCHMARK_DEFAULTS,
  PERF_BUILD_META_PATH,
  PERF_LATEST_RUN_PATH,
  PERF_RESULTS_DIR,
} from "./config";

export type BuildRouteModes = Record<string, string>;

export type BuildMetadata = {
  generatedAt: string;
  routeModes: BuildRouteModes;
  buildCommand: string[];
};

export type RunMetadata = {
  runId: string;
  runDir: string;
  createdAt: string;
  git: {
    branch: string | null;
    sha: string | null;
    dirty: boolean;
  };
  runtime: {
    nodeVersion: string;
    platform: NodeJS.Platform;
    arch: string;
    cpuModel: string | null;
    cpuCount: number;
  };
  benchmarkDefaults: typeof BENCHMARK_DEFAULTS;
  nextVersion: string;
  browserVersion?: string;
  routeModes: BuildRouteModes;
  steps?: string[];
};

type RunCommandOptions = {
  command: string;
  args: string[];
  cwd?: string;
  env?: Record<string, string | undefined>;
  printStdout?: boolean;
  printStderr?: boolean;
};

export type CommandResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

type StartServerOptions = {
  port: number;
  env: Record<string, string | undefined>;
  readyPath?: string;
  timeoutMs?: number;
  inspect?: boolean;
};

export function projectPath(...segments: string[]) {
  return path.join(process.cwd(), ...segments);
}

export async function ensureDirectory(directoryPath: string) {
  await mkdir(directoryPath, { recursive: true });
}

export async function writeJson(filePath: string, value: unknown) {
  await ensureDirectory(path.dirname(filePath));
  await writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

export async function readJson<T>(filePath: string) {
  const contents = await readFile(filePath, "utf8");
  return JSON.parse(contents) as T;
}

export async function readNdjson<T>(filePath: string) {
  const contents = await readFile(filePath, "utf8");
  return contents
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

export async function fileExists(filePath: string) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function clearDirectory(directoryPath: string) {
  await rm(directoryPath, { recursive: true, force: true });
  await ensureDirectory(directoryPath);
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runCommand({
  command,
  args,
  cwd = process.cwd(),
  env,
  printStdout = true,
  printStderr = true,
}: RunCommandOptions): Promise<CommandResult> {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      stdout += text;
      if (printStdout) {
        process.stdout.write(text);
      }
    });

    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      if (printStderr) {
        process.stderr.write(text);
      }
    });

    child.on("error", reject);
    child.on("close", (exitCode) => {
      resolve({
        exitCode: exitCode ?? 1,
        stdout,
        stderr,
      });
    });
  });
}

export async function getGitMetadata() {
  const branchResult = await runCommand({
    command: "git",
    args: ["branch", "--show-current"],
    printStdout: false,
    printStderr: false,
  });
  const shaResult = await runCommand({
    command: "git",
    args: ["rev-parse", "HEAD"],
    printStdout: false,
    printStderr: false,
  });
  const dirtyResult = await runCommand({
    command: "git",
    args: ["status", "--porcelain"],
    printStdout: false,
    printStderr: false,
  });

  return {
    branch: branchResult.exitCode === 0 ? branchResult.stdout.trim() || null : null,
    sha: shaResult.exitCode === 0 ? shaResult.stdout.trim() || null : null,
    dirty: dirtyResult.stdout.trim().length > 0,
  };
}

export async function getNextVersion() {
  const packageJson = await readJson<{ dependencies?: Record<string, string> }>(
    projectPath("package.json"),
  );
  return packageJson.dependencies?.next ?? "unknown";
}

export function getRuntimeMetadata() {
  const cpus = os.cpus();
  return {
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    cpuModel: cpus[0]?.model ?? null,
    cpuCount: cpus.length,
  };
}

export function createRunId(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

export async function createRunDirectory(explicitRunDir?: string) {
  const runDir = explicitRunDir
    ? path.isAbsolute(explicitRunDir)
      ? explicitRunDir
      : projectPath(explicitRunDir)
    : projectPath(PERF_RESULTS_DIR, createRunId());

  await ensureDirectory(runDir);
  await writeFile(projectPath(PERF_LATEST_RUN_PATH), `${runDir}\n`, "utf8");
  return runDir;
}

export async function resolveLatestRunDirectory() {
  const latestRunPath = projectPath(PERF_LATEST_RUN_PATH);
  const latestRun = await readFile(latestRunPath, "utf8");
  return latestRun.trim();
}

export async function updateRunMetadata(
  runDir: string,
  updater: Partial<RunMetadata>,
) {
  const metadataPath = path.join(runDir, "meta.json");
  const current = (await fileExists(metadataPath))
    ? await readJson<RunMetadata>(metadataPath)
    : null;

  const nextMetadata = current
    ? { ...current, ...updater }
    : (updater as RunMetadata);

  await writeJson(metadataPath, nextMetadata);
  return nextMetadata;
}

export async function initializeRunMetadata(runDir: string) {
  const git = await getGitMetadata();
  const nextVersion = await getNextVersion();
  const buildMetadata = await readBuildMetadata();
  const runMetadata: RunMetadata = {
    runId: path.basename(runDir),
    runDir,
    createdAt: new Date().toISOString(),
    git,
    runtime: getRuntimeMetadata(),
    benchmarkDefaults: BENCHMARK_DEFAULTS,
    nextVersion,
    routeModes: buildMetadata?.routeModes ?? {},
    steps: [],
  };

  await updateRunMetadata(runDir, runMetadata);
  return runMetadata;
}

export async function readBuildMetadata() {
  const buildMetadataPath = projectPath(PERF_BUILD_META_PATH);
  if (!(await fileExists(buildMetadataPath))) {
    return null;
  }

  return await readJson<BuildMetadata>(buildMetadataPath);
}

export function getNextBinaryPath() {
  return projectPath("node_modules", "next", "dist", "bin", "next");
}

export async function waitForServer(
  url: string,
  timeoutMs: number = BENCHMARK_DEFAULTS.serverReadyTimeoutMs,
) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, {
        headers: {
          "cache-control": "no-cache",
        },
      });

      if (response.ok || response.status < 500) {
        return;
      }
    } catch {
      // Keep polling until timeout.
    }

    await sleep(250);
  }

  throw new Error(`Timed out waiting for server readiness at ${url}`);
}

export async function startNextServer({
  port,
  env,
  readyPath = "/",
  timeoutMs = BENCHMARK_DEFAULTS.serverReadyTimeoutMs,
  inspect = false,
}: StartServerOptions) {
  const nextBinary = getNextBinaryPath();
  const args: string[] = [];
  if (inspect) {
    args.push("--inspect");
  }
  args.push(nextBinary, "start", "--port", String(port));
  const child = spawn(process.execPath, args, {
    cwd: process.cwd(),
    env: { ...process.env, ...env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => {
    process.stdout.write(chunk.toString());
  });
  child.stderr.on("data", (chunk) => {
    process.stderr.write(chunk.toString());
  });

  await waitForServer(`http://127.0.0.1:${port}${readyPath}`, timeoutMs);

  return {
    child,
    baseUrl: `http://127.0.0.1:${port}`,
    async stop() {
      if (child.killed) {
        return;
      }

      const stopped = new Promise<void>((resolve) => {
        child.once("close", () => resolve());
      });

      child.kill("SIGTERM");
      const timeout = setTimeout(() => {
        if (!child.killed) {
          child.kill("SIGKILL");
        }
      }, 5_000);
      timeout.unref();

      await stopped;
      clearTimeout(timeout);
    },
  };
}

export async function commandExists(command: string) {
  const result = await runCommand({
    command: "which",
    args: [command],
    printStdout: false,
    printStderr: false,
  });

  return result.exitCode === 0;
}

export function getArgumentValue(name: string) {
  const argument = process.argv.find((entry) => entry.startsWith(`--${name}=`));
  return argument ? argument.slice(name.length + 3) : null;
}
