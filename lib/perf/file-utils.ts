import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getPerfOutputDir } from "@/lib/perf/benchmark-env";

const writeQueues = new Map<string, Promise<void>>();

function queueWrite(filePath: string, writer: () => Promise<void>) {
  const previous = writeQueues.get(filePath) ?? Promise.resolve();
  const next = previous
    .catch(() => undefined)
    .then(writer)
    .finally(() => {
      if (writeQueues.get(filePath) === next) {
        writeQueues.delete(filePath);
      }
    });

  writeQueues.set(filePath, next);
  return next;
}

export function resolvePerfOutputPath(...segments: string[]) {
  const outputDir = getPerfOutputDir();
  if (!outputDir) {
    return null;
  }

  return path.join(outputDir, ...segments);
}

export async function ensurePerfDirectory(filePath: string) {
  await mkdir(path.dirname(filePath), { recursive: true });
}

export function appendPerfJsonLine(relativeFilePath: string, value: unknown) {
  const filePath = resolvePerfOutputPath(relativeFilePath);
  if (!filePath) {
    return Promise.resolve();
  }

  return queueWrite(filePath, async () => {
    await ensurePerfDirectory(filePath);
    await appendFile(filePath, `${JSON.stringify(value)}\n`, "utf8");
  });
}

export function writePerfJson(relativeFilePath: string, value: unknown) {
  const filePath = resolvePerfOutputPath(relativeFilePath);
  if (!filePath) {
    return Promise.resolve();
  }

  return queueWrite(filePath, async () => {
    await ensurePerfDirectory(filePath);
    await writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
  });
}

export async function readJsonFile<T>(filePath: string) {
  const contents = await readFile(filePath, "utf8");
  return JSON.parse(contents) as T;
}

export async function readNdjsonFile<T>(filePath: string) {
  const contents = await readFile(filePath, "utf8");
  return contents
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}
